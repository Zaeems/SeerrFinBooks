using Jellyfin.Plugin.BetterSeerrTabs.Model;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.BetterSeerrTabs.Services;

public class LetterboxdBulkRequestService
{
    // Map jw tier labels to common the Seerr profile name variants.
    private static readonly Dictionary<string, string[]> QualityLabelAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Ultra-HD"] = new[] { "Ultra-HD", "Ultra HD", "4K", "UHD", "2160p" },
        ["HD - 720p/1080p"] = new[] { "HD - 720p/1080p", "HD", "720p", "1080p", "HD-720p/1080p" },
        ["SD"] = new[] { "SD", "DVD", "480p" }
    };

    private readonly JellyseerrRequestService _requestService;
    private readonly JustWatchQualitiesService _qualitiesService;
    private readonly ILogger<LetterboxdBulkRequestService> _logger;

    public LetterboxdBulkRequestService(
        JellyseerrRequestService requestService,
        JustWatchQualitiesService qualitiesService,
        ILogger<LetterboxdBulkRequestService> logger)
    {
        _requestService = requestService;
        _qualitiesService = qualitiesService;
        _logger = logger;
    }

    public async Task<LetterboxdBulkRequestResultDto> SubmitBulkRequestAsync(
        string username,
        LetterboxdBulkRequestPayload payload,
        CancellationToken cancellationToken = default)
    {
        LetterboxdBulkRequestResultDto result = new();
        if (payload.TmdbIds == null || payload.TmdbIds.Count == 0)
        {
            return result;
        }

        JArray requestOptions = _requestService.GetRequestOptions(username, "movie");
        if (requestOptions.Count == 0)
        {
            foreach (int tmdbId in payload.TmdbIds.Distinct())
            {
                result.Results.Add(new LetterboxdBulkRequestItemResult
                {
                    TmdbId = tmdbId,
                    Status = "failed",
                    Message = "No Radarr quality profiles available."
                });
                result.Failed++;
            }

            return result;
        }

        string qualityMode = NormalizeQualityMode(payload.QualityMode);
        if (qualityMode == "singleprofile" &&
            (payload.ServerId == null || payload.ProfileId == null))
        {
            throw new ArgumentException("ServerId and ProfileId are required for single profile mode.");
        }

        foreach (int tmdbId in payload.TmdbIds.Distinct())
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                (int? serverId, int? profileId, string? rootFolder, bool is4k, string? warning) =
                    await ResolveRequestOptionAsync(
                        qualityMode,
                        tmdbId,
                        payload,
                        requestOptions,
                        cancellationToken).ConfigureAwait(false);

                if (serverId == null || profileId == null)
                {
                    result.Results.Add(new LetterboxdBulkRequestItemResult
                    {
                        TmdbId = tmdbId,
                        Status = "failed",
                        Message = warning ?? "Could not resolve a quality profile."
                    });
                    result.Failed++;
                    continue;
                }

                DiscoverRequestPayload requestPayload = new()
                {
                    MediaType = "movie",
                    MediaId = tmdbId,
                    ServerId = serverId,
                    ProfileId = profileId,
                    RootFolder = rootFolder,
                    Is4k = is4k
                };

                (int statusCode, string body, _) = await _requestService
                    .SubmitRequestAsync(username, requestPayload, cancellationToken)
                    .ConfigureAwait(false);

                // Seerr returns 409 when the title is already requested.
                if (IsAlreadyRequested(statusCode, body))
                {
                    result.Results.Add(new LetterboxdBulkRequestItemResult
                    {
                        TmdbId = tmdbId,
                        Status = "skipped",
                        Message = warning ?? "Already requested."
                    });
                    result.Skipped++;
                    continue;
                }

                if (statusCode >= 200 && statusCode < 300)
                {
                    result.Results.Add(new LetterboxdBulkRequestItemResult
                    {
                        TmdbId = tmdbId,
                        Status = "requested",
                        Message = warning
                    });
                    result.Requested++;
                    continue;
                }

                result.Results.Add(new LetterboxdBulkRequestItemResult
                {
                    TmdbId = tmdbId,
                    Status = "failed",
                    Message = ExtractErrorMessage(body) ?? $"Request failed with status {statusCode}."
                });
                result.Failed++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Bulk request failed for TMDB movie {TmdbId}", tmdbId);
                result.Results.Add(new LetterboxdBulkRequestItemResult
                {
                    TmdbId = tmdbId,
                    Status = "failed",
                    Message = ex.Message
                });
                result.Failed++;
            }
        }

        return result;
    }

    private async Task<(int? ServerId, int? ProfileId, string? RootFolder, bool Is4k, string? Warning)> ResolveRequestOptionAsync(
        string qualityMode,
        int tmdbId,
        LetterboxdBulkRequestPayload payload,
        JArray requestOptions,
        CancellationToken cancellationToken)
    {
        // User picked one quality profile for every selected movie.
        if (qualityMode == "singleprofile")
        {
            return (payload.ServerId, payload.ProfileId, payload.RootFolder, payload.Is4k, null);
        }

        // Per movie: ask jw which tier fits, then match to the quality profile.
        JustWatchQualitiesDto? qualities = await _qualitiesService
            .GetQualitiesAsync("movie", tmdbId, cancellationToken)
            .ConfigureAwait(false);

        string? targetLabel = qualityMode switch
        {
            "highestavailable" => qualities?.HighestReleasedQuality,
            "mostcommon" => qualities?.MostCommonQuality,
            _ => null
        };

        if (string.IsNullOrWhiteSpace(targetLabel))
        {
            JObject? fallback = GetDefaultProfileOption(requestOptions, prefer4k: false);
            return (
                fallback?.Value<int?>("serverId"),
                fallback?.Value<int?>("profileId"),
                fallback?.Value<string>("rootFolder"),
                fallback?.Value<bool?>("is4k") ?? false,
                "Quality recommendation unavailable; used default profile.");
        }

        bool prefer4k = string.Equals(targetLabel, "Ultra-HD", StringComparison.OrdinalIgnoreCase);
        JObject? matched = FindProfileOption(requestOptions, targetLabel, prefer4k);
        if (matched != null)
        {
            return (
                matched.Value<int?>("serverId"),
                matched.Value<int?>("profileId"),
                matched.Value<string>("rootFolder"),
                matched.Value<bool?>("is4k") ?? false,
                null);
        }

        // No profile name matched the jw tier so fall back to server default (or maybe Any? idk whats more fitting.)
        JObject? defaultOption = GetDefaultProfileOption(requestOptions, prefer4k);
        return (
            defaultOption?.Value<int?>("serverId"),
            defaultOption?.Value<int?>("profileId"),
            defaultOption?.Value<string>("rootFolder"),
            defaultOption?.Value<bool?>("is4k") ?? false,
            $"Could not match {targetLabel}; used default profile.");
    }

    private static string NormalizeQualityMode(string? mode)
    {
        string normalized = (mode ?? "singleProfile").Trim();
        return normalized.Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .ToLowerInvariant();
    }

    private static JObject? FindProfileOption(JArray options, string targetLabel, bool prefer4k)
    {
        IEnumerable<JObject> candidates = options.OfType<JObject>();
        if (prefer4k)
        {
            // Ultra-HD targets should land on a 4K Radarr server when one exists.
            IEnumerable<JObject> fourK = candidates.Where(o => o.Value<bool?>("is4k") == true);
            JObject? fourKMatch = MatchByLabel(fourK, targetLabel);
            if (fourKMatch != null)
            {
                return fourKMatch;
            }
        }
        else
        {
            candidates = candidates.Where(o => o.Value<bool?>("is4k") != true);
        }

        // Try non-4K (or any) profiles, then widen search if nothing matched.
        return MatchByLabel(candidates, targetLabel) ?? MatchByLabel(options.OfType<JObject>(), targetLabel);
    }

    private static JObject? MatchByLabel(IEnumerable<JObject> options, string targetLabel)
    {
        if (QualityLabelAliases.TryGetValue(targetLabel, out string[]? aliases))
        {
            foreach (string alias in aliases)
            {
                JObject? exact = options.FirstOrDefault(option =>
                    ProfileNamesMatch(option.Value<string>("profileName"), alias));
                if (exact != null)
                {
                    return exact;
                }
            }
        }

        return options.FirstOrDefault(option => ProfileNamesMatch(option.Value<string>("profileName"), targetLabel));
    }

    private static bool ProfileNamesMatch(string? profileName, string target)
    {
        if (string.IsNullOrWhiteSpace(profileName))
        {
            return false;
        }

        string normalizedProfile = NormalizeProfileName(profileName);
        string normalizedTarget = NormalizeProfileName(target);
        return normalizedProfile.Contains(normalizedTarget, StringComparison.Ordinal)
               || normalizedTarget.Contains(normalizedProfile, StringComparison.Ordinal);
    }

    private static string NormalizeProfileName(string value) =>
        value.Replace("-", " ", StringComparison.Ordinal)
            .Replace("/", " ", StringComparison.Ordinal)
            .Trim()
            .ToLowerInvariant();

    private static JObject? GetDefaultProfileOption(JArray options, bool prefer4k)
    {
        IEnumerable<JObject> candidates = options.OfType<JObject>();
        if (prefer4k)
        {
            JObject? fourKDefault = candidates.FirstOrDefault(o =>
                o.Value<bool?>("is4k") == true && o.Value<bool?>("isDefaultProfile") == true);
            if (fourKDefault != null)
            {
                return fourKDefault;
            }
        }

        return candidates.FirstOrDefault(o =>
                   o.Value<bool?>("is4k") != true && o.Value<bool?>("isDefaultProfile") == true)
               ?? candidates.FirstOrDefault(o => o.Value<bool?>("is4k") != true)
               ?? candidates.FirstOrDefault();
    }

    private static bool IsAlreadyRequested(int statusCode, string body)
    {
        if (statusCode == 409)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            return false;
        }

        return body.Contains("already been requested", StringComparison.OrdinalIgnoreCase)
               || body.Contains("already requested", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ExtractErrorMessage(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            JObject json = JObject.Parse(body);
            JArray? errors = json.Value<JArray>("errors");
            if (errors != null && errors.Count > 0)
            {
                return string.Join("; ", errors.Select(error => error.ToString()));
            }

            return json.Value<string>("message");
        }
        catch
        {
            return null;
        }
    }
}
