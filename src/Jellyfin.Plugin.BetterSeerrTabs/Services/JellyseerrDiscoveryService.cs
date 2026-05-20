using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using Jellyfin.Plugin.BetterSeerrTabs.Helpers;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Querying;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.BetterSeerrTabs.Services;

public class JellyseerrDiscoveryService
{
    private readonly ImageCacheService _imageCacheService;
    private readonly ILogger<JellyseerrDiscoveryService> _logger;

    public JellyseerrDiscoveryService(
        ImageCacheService imageCacheService,
        ILogger<JellyseerrDiscoveryService> logger)
    {
        _imageCacheService = imageCacheService;
        _logger = logger;
    }

    public QueryResult<BaseItemDto> GetDiscoverRow(string username, string jellyseerrPath, string? mediaTypeFilter = null)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        if (string.IsNullOrWhiteSpace(config.JellyseerrUrl) || string.IsNullOrWhiteSpace(config.JellyseerrApiKey))
        {
            return EmptyResult();
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            return EmptyResult();
        }

        using HttpClient client = CreateClient(config);
        int? jellyseerrUserId = ResolveJellyseerrUserId(client, username);
        if (jellyseerrUserId == null)
        {
            return EmptyResult();
        }

        client.DefaultRequestHeaders.Add("X-Api-User", jellyseerrUserId.ToString());

        List<BaseItemDto> items = new();
        int page = 1;
        int limit = Math.Max(1, config.RowItemLimit);

        // Paginate until RowItemLimit is met. cap at 5 pages to avoid long Seerr chains
        while (items.Count < limit && page <= 5)
        {
            string path = jellyseerrPath.Contains('?', StringComparison.Ordinal)
                ? $"{jellyseerrPath}&page={page}"
                : $"{jellyseerrPath}?page={page}";

            try
            {
                HttpResponseMessage response = client.GetAsync(path).GetAwaiter().GetResult();
                if (!response.IsSuccessStatusCode)
                {
                    break;
                }

                string jsonRaw = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                JObject? json = JObject.Parse(jsonRaw);
                JArray? results = json?.Value<JArray>("results");
                if (results == null || results.Count == 0)
                {
                    break;
                }

                foreach (JObject item in results.OfType<JObject>())
                {
                    if (items.Count >= limit)
                    {
                        break;
                    }

                    string? itemMediaType = item.Value<string>("mediaType");
                    if (!string.IsNullOrEmpty(mediaTypeFilter) &&
                        !string.Equals(itemMediaType, mediaTypeFilter, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    BaseItemDto? dto = MapDiscoverItem(item);
                    if (dto != null)
                    {
                        items.Add(dto);
                    }
                }

                int totalPages = json?.Value<int?>("totalPages") ?? page;
                if (page >= totalPages)
                {
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Jellyseerr path {Path}", path);
                break;
            }

            page++;
        }

        return new QueryResult<BaseItemDto>
        {
            Items = items,
            StartIndex = 0,
            TotalRecordCount = items.Count
        };
    }

    public JArray GetGenreSlider(string mediaType)
    {
        string path = mediaType == "movie"
            ? "/api/v1/discover/genreslider/movie"
            : "/api/v1/discover/genreslider/tv";
        return GetJsonArray(path);
    }

    public JArray GetWatchProviders(string mediaType)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        string region = string.IsNullOrWhiteSpace(config.WatchRegion) ? "US" : config.WatchRegion;
        string path = mediaType == "movie"
            ? $"/api/v1/watchproviders/movies?watchRegion={Uri.EscapeDataString(region)}"
            : $"/api/v1/watchproviders/tv?watchRegion={Uri.EscapeDataString(region)}";
        return GetJsonArray(path);
    }

    public JObject? GetMediaDetails(string username, string mediaType, int mediaId)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        if (string.IsNullOrWhiteSpace(config.JellyseerrUrl) || string.IsNullOrWhiteSpace(config.JellyseerrApiKey))
        {
            return null;
        }

        return FetchJellyseerrDetails(username, config, mediaType, mediaId);
    }

    private JObject? FetchJellyseerrDetails(string username, PluginConfiguration config, string mediaType, int mediaId)
    {
        using HttpClient client = CreateClient(config);
        if (!string.IsNullOrWhiteSpace(username))
        {
            int? jellyseerrUserId = ResolveJellyseerrUserId(client, username);
            if (jellyseerrUserId != null)
            {
                client.DefaultRequestHeaders.Add("X-Api-User", jellyseerrUserId.ToString());
            }
        }

        string path = mediaType == "tv"
            ? $"/api/v1/tv/{mediaId}"
            : $"/api/v1/movie/{mediaId}";

        try
        {
            HttpResponseMessage response = client.GetAsync(path).GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            string jsonRaw = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return JObject.Parse(jsonRaw);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Jellyseerr details for {MediaType}/{MediaId}", mediaType, mediaId);
            return null;
        }
    }

    private JArray GetJsonArray(string path)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        if (string.IsNullOrWhiteSpace(config.JellyseerrUrl) || string.IsNullOrWhiteSpace(config.JellyseerrApiKey))
        {
            return new JArray();
        }

        using HttpClient client = CreateClient(config);
        try
        {
            HttpResponseMessage response = client.GetAsync(path).GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode)
            {
                return new JArray();
            }

            string jsonRaw = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            JToken? token = JToken.Parse(jsonRaw);
            // Endpoints return either a bare array or { results: [...] }
            return token switch
            {
                JArray array => array,
                JObject obj when obj["results"] is JArray results => results,
                _ => new JArray()
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Jellyseerr array from {Path}", path);
            return new JArray();
        }
    }

    private BaseItemDto? MapDiscoverItem(JObject item)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;

        if (item.Value<bool?>("adult") == true)
        {
            return null;
        }

        string? language = item.Value<string>("originalLanguage");
        // Optional comma-separated language allowlist from plugin config
        if (!string.IsNullOrEmpty(config.JellyseerrPreferredLanguages) &&
            !string.IsNullOrEmpty(language) &&
            !config.JellyseerrPreferredLanguages.Split(',')
                .Select(x => x.Trim())
                .Contains(language, StringComparer.OrdinalIgnoreCase))
        {
            return null;
        }

        // Skip titles already in the library. Discovery rows are for new requests only
        if (item.Value<JObject>("mediaInfo") != null)
        {
            return null;
        }

        string dateTimeString = item.Value<string>("firstAirDate")
                                ?? item.Value<string>("releaseDate")
                                ?? "1970-01-01";
        if (string.IsNullOrWhiteSpace(dateTimeString))
        {
            dateTimeString = "1970-01-01";
        }

        string posterPath = item.Value<string>("posterPath") ?? string.Empty;
        string posterUrl = string.IsNullOrEmpty(posterPath)
            ? string.Empty
            : ImageCacheHelper.GetCachedImageUrl(
                _imageCacheService,
                $"https://image.tmdb.org/t/p/w600_and_h900_bestv2{posterPath}",
                _logger);

        float rating = item.Value<float?>("vote_average") ?? item.Value<float?>("voteAverage") ?? 0f;
        string? mediaType = item.Value<string>("mediaType");

        return new BaseItemDto
        {
            Name = item.Value<string>("title") ?? item.Value<string>("name"),
            OriginalTitle = item.Value<string>("originalTitle") ?? item.Value<string>("originalName"),
            SourceType = mediaType,
            CommunityRating = rating > 0 ? rating : null,
            ProviderIds = new Dictionary<string, string>
            {
                { "Jellyseerr", item.Value<int>("id").ToString() },
                { "JellyseerrPoster", posterUrl },
                { "Tmdb", item.Value<int?>("tmdbId")?.ToString() ?? string.Empty }
            },
            PremiereDate = DateTime.TryParse(dateTimeString, out DateTime dt) ? dt : DateTime.Parse("1970-01-01")
        };
    }

    private static HttpClient CreateClient(PluginConfiguration config)
    {
        HttpClient client = new() { BaseAddress = new Uri(config.JellyseerrUrl!) };
        client.DefaultRequestHeaders.Add("X-Api-Key", config.JellyseerrApiKey);
        return client;
    }

    // Match Jellyfin username to linked Jellyseerr user for per-user X-Api-User header.
    private static int? ResolveJellyseerrUserId(HttpClient client, string username)
    {
        HttpResponseMessage usersResponse = client.GetAsync($"/api/v1/user?q={Uri.EscapeDataString(username)}").GetAwaiter().GetResult();
        string userResponseRaw = usersResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult();
        return JObject.Parse(userResponseRaw).Value<JArray>("results")?
            .OfType<JObject>()
            .FirstOrDefault(x => string.Equals(x.Value<string>("jellyfinUsername"), username, StringComparison.OrdinalIgnoreCase))
            ?.Value<int>("id");
    }

    private static QueryResult<BaseItemDto> EmptyResult() => new()
    {
        Items = Array.Empty<BaseItemDto>(),
        StartIndex = 0,
        TotalRecordCount = 0
    };
}
