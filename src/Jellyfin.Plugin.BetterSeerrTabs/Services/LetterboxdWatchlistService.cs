using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using MediaBrowser.Model.Dto;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.BetterSeerrTabs.Services;

public class LetterboxdWatchlistService
{
    private const string UserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

    private static readonly Regex MovieEntryRegex = new(@"data-item-slug=""([^""]+)""[^>]*data-item-link=""[^""]*"" data-item-full-display-name=""([^""]+)""", RegexOptions.Compiled);

    private static readonly Regex PageNumberRegex = new(@"<li class=""paginate-page[^""]*""[^>]*>(?:<a[^>]*>|<span[^>]*>)\s*(\d+)", RegexOptions.Compiled);

    private static readonly Regex DisplayNameRegex = new(@"^(.+?) \((\d{4})\)$", RegexOptions.Compiled);

    private static readonly Regex TmdbIdRegex = new(@"data-tmdb-id=""(\d+)""", RegexOptions.Compiled);

    private readonly HttpClient _httpClient;

    public LetterboxdWatchlistService(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient(nameof(LetterboxdWatchlistService));
        _httpClient.Timeout = TimeSpan.FromSeconds(60);
    }

    public async Task<(List<BaseItemDto> Items, int TotalCount, int ResolvedCount, int UnresolvedCount)> SyncAsync(string username, CancellationToken cancellationToken = default)
    {
        username = username.Trim();
        if (string.IsNullOrWhiteSpace(username) || username.Contains('/') || username.Contains('\\'))
        {
            throw new ArgumentException("Invalid Letterboxd username.");
        }

        string? apiKey = BetterSeerrTabsPlugin.Instance.Configuration.TmdbApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new InvalidOperationException("TMDB API key is required to sync Letterboxd watchlists.");
        }

        // Scrape public watchlist pages
        string firstUrl = $"https://letterboxd.com/{Uri.EscapeDataString(username)}/watchlist/";
        string html = await FetchLetterboxdAsync(firstUrl, cancellationToken).ConfigureAwait(false);

        // Last paginate-page number is the total page count.
        List<int> pageNumbers = PageNumberRegex.Matches(html)
            .Select(match => int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture))
            .ToList();
        int totalPages = pageNumbers.Count == 0 ? 1 : pageNumbers[^1];

        List<(string Slug, string Title, int Year)> movies = new();
        for (int page = 1; page <= totalPages; page++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Page 1 html already loaded. fetch remaining pages separately.
            string pageHtml = page == 1
                ? html
                : await FetchLetterboxdAsync(
                    $"https://letterboxd.com/{Uri.EscapeDataString(username)}/watchlist/page/{page}/",
                    cancellationToken).ConfigureAwait(false);

            foreach ((string slug, string title, int year) in MoviesFromPage(pageHtml))
            {
                if (!movies.Contains((slug, title, year)))
                {
                    movies.Add((slug, title, year));
                }
            }
        }

        List<BaseItemDto> items = new();
        HashSet<int> seenTmdbIds = new();
        int unresolvedCount = 0;

        foreach ((string slug, string title, int year) in movies)
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Search tmdb by title/year first, then get data-tmdb-id from the movie page.
            int? tmdbId = await SearchTmdbIdAsync(title, year, apiKey, cancellationToken).ConfigureAwait(false);
            if (tmdbId == null)
            {
                tmdbId = await TmdbIdFromLetterboxdAsync(slug, cancellationToken).ConfigureAwait(false);
            }

            if (tmdbId == null)
            {
                unresolvedCount++;
                continue;
            }

            // Same tmdb id can appear twice when letterboxd slugs differ slightly.
            if (!seenTmdbIds.Add(tmdbId.Value))
            {
                continue;
            }

            items.Add(new BaseItemDto
            {
                Name = title,
                SourceType = "movie",
                PremiereDate = new DateTime(year, 1, 1),
                ProviderIds = new Dictionary<string, string>
                {
                    { "Tmdb", tmdbId.Value.ToString(CultureInfo.InvariantCulture) }
                }
            });
        }

        return (items, movies.Count, items.Count, unresolvedCount);
    }

    // Parse data-item-slug and "Title (Year)" from watchlist card markup.
    private static IEnumerable<(string Slug, string Title, int Year)> MoviesFromPage(string pageHtml)
    {
        foreach (Match match in MovieEntryRegex.Matches(pageHtml))
        {
            string display = WebUtility.HtmlDecode(match.Groups[2].Value);
            Match titleMatch = DisplayNameRegex.Match(display);
            if (!titleMatch.Success)
            {
                continue;
            }

            yield return (
                match.Groups[1].Value,
                titleMatch.Groups[1].Value.Trim(),
                int.Parse(titleMatch.Groups[2].Value, CultureInfo.InvariantCulture));
        }
    }

    // Letterboxd needs a validated request (cookie + sec-fetch-user) before real page fetch or else will cf block
    private async Task<string> FetchLetterboxdAsync(string url, CancellationToken cancellationToken)
    {
        using HttpRequestMessage warmup = CreateLetterboxdRequest(url, "https://letterboxd.com/", includeSecFetchUser: true);
        using HttpResponseMessage warmupResponse = await _httpClient.SendAsync(warmup, cancellationToken).ConfigureAwait(false);
        await warmupResponse.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

        using HttpRequestMessage request = CreateLetterboxdRequest(url, url, includeSecFetchUser: false);
        using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
    }

    private static HttpRequestMessage CreateLetterboxdRequest(string url, string referer, bool includeSecFetchUser)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
        request.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "document");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "navigate");
        request.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "same-origin");
        request.Headers.TryAddWithoutValidation("Referer", referer);
        if (includeSecFetchUser)
        {
            request.Headers.TryAddWithoutValidation("Sec-Fetch-User", "?1");
        }

        request.Headers.TryAddWithoutValidation("Cookie", "useMobileSite=no");
        return request;
    }

    private async Task<int?> SearchTmdbIdAsync(string title, int year, string apiKey, CancellationToken cancellationToken)
    {
        string url = $"https://api.themoviedb.org/3/search/movie?query={Uri.EscapeDataString(title)}&year={year.ToString(CultureInfo.InvariantCulture)}";
        using HttpRequestMessage request = CreateTmdbRequest(url, apiKey);
        using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        string json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        // Require exact title match and release year to prevent wrong tmdb hit
        foreach (JObject movie in JObject.Parse(json).Value<JArray>("results")?.OfType<JObject>() ?? [])
        {
            if (!string.Equals(movie.Value<string>("title")?.Trim(), title.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            string releaseDate = movie.Value<string>("release_date") ?? string.Empty;
            if (!releaseDate.StartsWith(year.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))
            {
                continue;
            }

            return movie.Value<int?>("id");
        }

        return null;
    }

    // Fallback if no tmdb id found from search: read data-tmdb-id from Letterboxd film page 
    // This takes around 2x longer with only letterboxd scraping, so use tmdb search as primary source.
    private async Task<int?> TmdbIdFromLetterboxdAsync(string slug, CancellationToken cancellationToken)
    {
        string html = await FetchLetterboxdAsync($"https://letterboxd.com/film/{Uri.EscapeDataString(slug)}/", cancellationToken)
            .ConfigureAwait(false);
        Match match = TmdbIdRegex.Match(html);
        return match.Success && int.TryParse(match.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out int tmdbId)
            ? tmdbId
            : null;
    }

    private static HttpRequestMessage CreateTmdbRequest(string url, string apiKey)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (apiKey.Split('.').Length == 3)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }
        else
        {
            request.RequestUri = new Uri(url + (url.Contains('?', StringComparison.Ordinal) ? "&" : "?") +
                "api_key=" + Uri.EscapeDataString(apiKey));
        }

        return request;
    }
}
