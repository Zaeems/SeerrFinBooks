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

    public JArray GetMovieStreamingServices() => ToBrowseArray(MovieStreamingServices);

    public JArray GetTvStreamingServices() => ToBrowseArray(TvStreamingServices);

    private static JArray ToBrowseArray(IEnumerable<(int Id, string Name, string Logo, bool WeirdSize)> items)
    {
        JArray array = new();
        foreach ((int id, string name, string logo, bool weirdSize) in items)
        {
            array.Add(new JObject
            {
                ["id"] = id,
                ["name"] = name,
                ["logo"] = logo,
                ["weirdSize"] = weirdSize
            });
        }

        return array;
    }

    private static readonly (int Id, string Name, string Logo, bool WeirdSize)[] MovieStudios =
    {
        (2, "Disney", "/wdrCwmRnLFJhEoH8GSfymY85KHT.png", true),
        (127928, "20th Century Studios", "/h0rjX5vjW5r8yEnUBStFarjcLT4.png", true),
        (34, "Sony Pictures", "/mtp1fvZbe4H991Ka1HOORl572VH.png", true),
        (174, "Warner Bros. Pictures", "/zhD3hhtKB5qyv7ZeL4uLpNxgMVU.png", true),
        (33, "Universal", "/8lvHyhjr8oUKOOy2dKXoALWKdp0.png", true),
        (4, "Paramount", "/jay6WcMgagAklUt7i9Euwj1pzTF.png", true),
        (3, "Pixar", "/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png", false),
        (521, "Dreamworks", "/3BPX5VGBov8SDqTV7wC1L1xShAS.png", true),
        (420, "Marvel Studios", "/hUzeosd33nzE5MCNsZxCGEKTXaQ.png", false),
        (9993, "DC", "not found", false),
        (41077, "A24", "/1ZXsGaFPgrgS6ZZGS37AqD5uU12.png", false)
    };

    private static readonly (int Id, string Name, string Logo, bool WeirdSize)[] TvNetworks =
    {
        (213, "Netflix", "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", false),
        (2739, "Disney+", "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png", true),
        (1024, "Prime Video", "/w7HfLNm9CWwRmAMU58udl2L7We7.png", false),
        (2552, "Apple TV+", "/bngHRFi794mnMq34gfVcm9nDxN1.png", false),
        (453, "Hulu", "/pqUTCleNUiTLAVlelGxUgWn1ELh.png", false),
        (49, "HBO", "/tuomPhY2UtuPTqqFnKMVHvSb724.png", false),
        (4353, "Discovery+", "/1D1bS3Dyw4ScYnFWTlBOvJXC3nb.png", false),
        (2, "ABC", "/2uy2ZWcplrSObIyt4x0Y9rkG6qO.png", true),
        (19, "FOX", "/1DSpHrWyOORkL9N2QHX7Adt31mQ.png", false),
        (359, "Cinemax", "not found", false),
        (174, "AMC", "/pmvRmATOCaDykE6JrVoeYxlFHw3.png", false),
        (67, "Showtime", "/Allse9kbjiP6ExaQrnSpIhkurEi.png", true),
        (318, "Starz", "/qx3Y9LCaK4mq1ykFuDIfjshlo3U.png", false),
        (71, "The CW", "/hEpcdJ4O6eitG9ADSnDXNUrlovS.png", false),
        (6, "NBC", "/cm111bsDVlYaC1foL0itvEI4yLG.png", false),
        (16, "CBS", "/wju8KhOUsR5y4bH9p3Jc50hhaLO.png", false),
        (4330, "Paramount+", "/fi83B1oztoS47xxcemFdPMhIzK.png", false),
        (4, "BBC One", "/uJjcCg3O4DMEjM0xtno9OWFciRP.png", false),
        (56, "Cartoon Network", "/c5OC6oVCg6QP4eqzW6XIq17CQjI.png", false),
        (80, "Adult Swim", "/tHZPHOLc6iF27G34cAZGPsMtMSy.png", false),
        (13, "Nickelodeon", "/aYkLXz4dxHgOrFNH7Jv7Cpy56Ms.png", false),
        (3353, "Peacock", "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png", false)
    };

    private static readonly (int Id, string Name, string Logo, bool WeirdSize)[] MovieStreamingServices =
    {
        (8, "Netflix", "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", false),
        (350, "Apple TV", "/bngHRFi794mnMq34gfVcm9nDxN1.png", false),
        (9, "Amazon Prime Video", "/w7HfLNm9CWwRmAMU58udl2L7We7.png", false),
        (337, "Disney Plus", "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png", true),
        (15, "Hulu", "/pqUTCleNUiTLAVlelGxUgWn1ELh.png", false),
        (2303, "Paramount Plus Premium", "/fi83B1oztoS47xxcemFdPMhIzK.png", false),
        (386, "Peacock Premium", "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png", false),
        (1899, "HBO Max", "/rAb4M1LjGpWASxpk6Va791A7Nkw.png", false),
        (526, "AMC+", "/pmvRmATOCaDykE6JrVoeYxlFHw3.png", false),
        (83, "The CW", "/hEpcdJ4O6eitG9ADSnDXNUrlovS.png", false),
        (43, "Starz", "/qx3Y9LCaK4mq1ykFuDIfjshlo3U.png", false),
        (209, "PBS", "/4Fn4eQmEmJZ9YWjiIhZ6cF1QHAi.png", false),
        (79, "NBC", "/cm111bsDVlYaC1foL0itvEI4yLG.png", false),
        (34, "MGM Plus", "/usUnaYV6hQnlVAXP6r4HwrlLFPG.png", true)
    };

    private static readonly (int Id, string Name, string Logo, bool WeirdSize)[] TvStreamingServices =
    {
        (8, "Netflix", "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", false),
        (350, "Apple TV", "/bngHRFi794mnMq34gfVcm9nDxN1.png", false),
        (9, "Amazon Prime Video", "/w7HfLNm9CWwRmAMU58udl2L7We7.png", false),
        (337, "Disney Plus", "/1edZOYAfoyZyZ3rklNSiUpXX30Q.png", true),
        (15, "Hulu", "/pqUTCleNUiTLAVlelGxUgWn1ELh.png", false),
        (2303, "Paramount Plus Premium", "/fi83B1oztoS47xxcemFdPMhIzK.png", false),
        (386, "Peacock Premium", "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png", false),
        (1899, "HBO Max", "/rAb4M1LjGpWASxpk6Va791A7Nkw.png", false),
        (526, "AMC+", "/pmvRmATOCaDykE6JrVoeYxlFHw3.png", false),
        (83, "The CW", "/hEpcdJ4O6eitG9ADSnDXNUrlovS.png", false),
        (43, "Starz", "/qx3Y9LCaK4mq1ykFuDIfjshlo3U.png", false),
        (209, "PBS", "/4Fn4eQmEmJZ9YWjiIhZ6cF1QHAi.png", false),
        (123, "FXNow", "/aexGjtcs42DgRtZh7zOxayiry4J.png", false),
        (79, "NBC", "/cm111bsDVlYaC1foL0itvEI4yLG.png", false),
        (34, "MGM Plus", "/usUnaYV6hQnlVAXP6r4HwrlLFPG.png", true),
        (211, "Freeform", "/jk2Z7WH6JnHSZrxouYh4sireM3a.png", false),
        (156, "A&E", "/ptSTdU4GPNJ1M8UVEOtA0KgtuNk.png", false),
        (157, "Lifetime", "/kEeaVLcJ6L6jq3v5YlPcjQs9igm.png", false),
        (318, "Adult Swim", "/tHZPHOLc6iF27G34cAZGPsMtMSy.png", false),
        (322, "USA Network", "/g1e0H0Ka97IG5SyInMXdJkHGKiH.png", false),
        (365, "Bravo TV", "/wX5HsfS47u6UUCSpYXqaQ1x2qdu.png", false),
        (363, "TNT", "/6ISsKwa2XUhSC6oBtHZjYf6xFqv.png", true),
        (412, "TLC", "/6GRfZSrYh9D6C88n9kWlyrySB2l.png", false),
        (406, "HGTV", "/tzTtKdQ7vC2FkBvJDUErOhBPdKJ.png", false),
        (399, "Animal Planet", "/m3KrDu1g96YByhH0wp4OvyghgsG.png", true),
        (403, "Discovery", "/tmttRFo2OiXQD0EHMxxlw8EzUuZ.png", false),
        (422, "VH1", "/w9oUxxUiXTC1O1MzJSvsMjQbgft.png", false),
        (506, "TBS", "/65r0kR6MfOBYF0gEQsJGM6v5fEG.png", false),
        (508, "DisneyNOW", "/9AxUB1RdRnm0r5ki8Thb69Jo9Ma.png", false),
        (520, "Discovery +", "/1D1bS3Dyw4ScYnFWTlBOvJXC3nb.png", false),
        (1964, "National Geographic", "/5UtQpFierweXjriDoRf3LUVDjce.png", false),
        (148, "ABC", "/2uy2ZWcplrSObIyt4x0Y9rkG6qO.png", true),
        (155, "History", "/9fGgdJz17aBX7dOyfHJtsozB7bf.png", true)
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
