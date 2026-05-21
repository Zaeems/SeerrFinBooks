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

    public QueryResult<BaseItemDto> GetAnimeRow(string username, int startIndex = 0, int? limit = null) =>
        GetDiscoverRow(username, "/api/v1/discover/tv?genre=16&keywords=210024", "tv", startIndex, limit, useSeerrMapping: true);

    public QueryResult<BaseItemDto> GetDiscoverRow(string username, string jellyseerrPath, string? mediaTypeFilter = null, int startIndex = 0, int? limit = null, bool useSeerrMapping = false)
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

        // Seerr mapping needs to be used for Anime discovery because of Seerr's default filters applied on their direct API.
        DiscoverItemFilterOptions mapping = useSeerrMapping
            ? DiscoverItemFilterOptions.Seerr
            : DiscoverItemFilterOptions.Default;

        List<BaseItemDto> items = new();
        int jellyseerrPage = 1;
        int targetLimit = Math.Max(1, limit ?? config.RowItemLimit);
        int skipped = 0;
        int totalResults = 0;
        bool isGridRequest = limit.HasValue;
        int maxJellyseerrPages = isGridRequest ? 20 : 5;

        // Paginate until we have enough items or hit the max pages
        while (items.Count < targetLimit && jellyseerrPage <= maxJellyseerrPages)
        {
            string path = jellyseerrPath.Contains('?', StringComparison.Ordinal)
                ? $"{jellyseerrPath}&page={jellyseerrPage}"
                : $"{jellyseerrPath}?page={jellyseerrPage}";

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

                totalResults = json?.Value<int?>("totalResults") ?? totalResults;

                foreach (JObject item in results.OfType<JObject>())
                {
                    if (items.Count >= targetLimit)
                    {
                        break;
                    }

                    string? itemMediaType = item.Value<string>("mediaType");
                    if (!string.IsNullOrEmpty(mediaTypeFilter) &&
                        !string.Equals(itemMediaType, mediaTypeFilter, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    BaseItemDto? dto = MapDiscoverItem(item, mapping);
                    if (dto == null)
                    {
                        continue;
                    }

                    if (skipped < startIndex)
                    {
                        skipped++;
                        continue;
                    }

                    items.Add(dto);
                }

                int totalPages = json?.Value<int?>("totalPages") ?? jellyseerrPage;
                if (jellyseerrPage >= totalPages)
                {
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Jellyseerr path {Path}", path);
                break;
            }

            jellyseerrPage++;
        }

        return new QueryResult<BaseItemDto>
        {
            Items = items,
            StartIndex = startIndex,
            TotalRecordCount = isGridRequest ? totalResults : items.Count
        };
    }

    public JArray GetGenreSlider(string mediaType, string username)
    {
        string path = mediaType == "movie"
            ? "/api/v1/discover/genreslider/movie"
            : "/api/v1/discover/genreslider/tv";
        return GetJsonArray(path, username);
    }

    public JArray GetWatchProviders(string mediaType, string username)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        string region = string.IsNullOrWhiteSpace(config.WatchRegion) ? "US" : config.WatchRegion;
        string path = mediaType == "movie"
            ? $"/api/v1/watchproviders/movies?watchRegion={Uri.EscapeDataString(region)}"
            : $"/api/v1/watchproviders/tv?watchRegion={Uri.EscapeDataString(region)}";
        return GetJsonArray(path, username);
    }

    public JArray GetStudios() => ToBrowseArray(MovieStudios);

    public JArray GetNetworks() => ToBrowseArray(TvNetworks);

    private static JArray ToBrowseArray(IEnumerable<(int Id, string Name)> items)
    {
        JArray array = new();
        foreach ((int id, string name) in items)
        {
            array.Add(new JObject
            {
                ["id"] = id,
                ["name"] = name
            });
        }

        return array;
    }

    private static readonly (int Id, string Name)[] MovieStudios =
    {
        (2, "Disney"),
        (127928, "20th Century Studios"),
        (34, "Sony Pictures"),
        (174, "Warner Bros. Pictures"),
        (33, "Universal"),
        (4, "Paramount"),
        (3, "Pixar"),
        (521, "Dreamworks"),
        (420, "Marvel Studios"),
        (9993, "DC"),
        (41077, "A24")
    };

    private static readonly (int Id, string Name)[] TvNetworks =
    {
        (213, "Netflix"),
        (2739, "Disney+"),
        (1024, "Prime Video"),
        (2552, "Apple TV+"),
        (453, "Hulu"),
        (49, "HBO"),
        (4353, "Discovery+"),
        (2, "ABC"),
        (19, "FOX"),
        (359, "Cinemax"),
        (174, "AMC"),
        (67, "Showtime"),
        (318, "Starz"),
        (71, "The CW"),
        (6, "NBC"),
        (16, "CBS"),
        (4330, "Paramount+"),
        (4, "BBC One"),
        (56, "Cartoon Network"),
        (80, "Adult Swim"),
        (13, "Nickelodeon"),
        (3353, "Peacock")
    };

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

    private JArray GetJsonArray(string path, string username)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        if (string.IsNullOrWhiteSpace(config.JellyseerrUrl) || string.IsNullOrWhiteSpace(config.JellyseerrApiKey))
        {
            return new JArray();
        }

        using HttpClient client = CreateClient(config);
        if (!string.IsNullOrWhiteSpace(username))
        {
            int? jellyseerrUserId = ResolveJellyseerrUserId(client, username);
            if (jellyseerrUserId != null)
            {
                client.DefaultRequestHeaders.Add("X-Api-User", jellyseerrUserId.ToString());
            }
        }

        try
        {
            HttpResponseMessage response = client.GetAsync(path).GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Jellyseerr request failed for {Path} with status {StatusCode}", path, response.StatusCode);
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

    private BaseItemDto? MapDiscoverItem(JObject item, DiscoverItemFilterOptions filterOptions)
    {
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;

        if (item.Value<bool?>("adult") == true)
        {
            return null;
        }

        string? language = item.Value<string>("originalLanguage");
        if (filterOptions.ApplyLanguageFilter &&
            !string.IsNullOrEmpty(config.JellyseerrPreferredLanguages) &&
            !string.IsNullOrEmpty(language) &&
            !config.JellyseerrPreferredLanguages.Split(',')
                .Select(x => x.Trim())
                .Contains(language, StringComparer.OrdinalIgnoreCase))
        {
            return null;
        }

        // Match Seerr default (hideAvailable=false): only hide available titles when configured.
        if (filterOptions.HideAvailableInLibrary && IsAvailableInLibrary(item))
        {
            return null;
        }

        if (filterOptions.HideRequestedMedia && item.Value<JObject>("mediaInfo") != null)
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

    private static bool IsAvailableInLibrary(JObject item)
    {
        string? status = item.Value<JObject>("mediaInfo")?.Value<string>("status");
        return string.Equals(status, "AVAILABLE", StringComparison.OrdinalIgnoreCase) || string.Equals(status, "PARTIALLY_AVAILABLE", StringComparison.OrdinalIgnoreCase);
    }

    private sealed class DiscoverItemFilterOptions
    {
        public static DiscoverItemFilterOptions Default { get; } = new()
        {
            ApplyLanguageFilter = true,
            HideRequestedMedia = true,
            HideAvailableInLibrary = false
        };

        // Pass TMDB filters through and show all results.
        public static DiscoverItemFilterOptions Seerr { get; } = new()
        {
            ApplyLanguageFilter = false,
            HideRequestedMedia = false,
            HideAvailableInLibrary = false
        };

        public bool ApplyLanguageFilter { get; init; }

        public bool HideRequestedMedia { get; init; }

        public bool HideAvailableInLibrary { get; init; }
    }

    private static QueryResult<BaseItemDto> EmptyResult() => new()
    {
        Items = Array.Empty<BaseItemDto>(),
        StartIndex = 0,
        TotalRecordCount = 0
    };
}
