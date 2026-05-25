using System.Collections.Concurrent;
using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using Jellyfin.Plugin.BetterSeerrTabs.Helpers;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.BetterSeerrTabs.Services;

public class TmdbBackdropService
{
    private readonly HttpClient _httpClient;
    private readonly ImageCacheService _imageCacheService;
    private readonly ILogger<TmdbBackdropService> _logger;
    private readonly ConcurrentDictionary<string, CachedBackdropDto> _cache = new();

    public TmdbBackdropService(HttpClient httpClient, ImageCacheService imageCacheService, ILogger<TmdbBackdropService> logger)
    {
        _httpClient = httpClient;
        _imageCacheService = imageCacheService;
        _logger = logger;
    }

    public async Task<CachedBackdropDto?> GetCachedBackdropAsync(string mediaType, int tmdbId, CancellationToken cancellationToken = default)
    {
        string cacheKey = $"{mediaType}:{tmdbId}";
        if (_cache.TryGetValue(cacheKey, out CachedBackdropDto? cached))
        {
            return cached;
        }

        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        string? apiKey = config.TmdbApiKey?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            return null;
        }

        BackdropPickResult pick = await TmdbBackdropHelper.FetchBackdropAsync(
            _httpClient,
            mediaType,
            tmdbId,
            apiKey,
            cancellationToken).ConfigureAwait(false);

        if (string.IsNullOrEmpty(pick.FilePath))
        {
            return null;
        }

        string path = pick.FilePath.StartsWith('/') ? pick.FilePath : "/" + pick.FilePath;
        string sourceUrl = "https://image.tmdb.org/t/p/w780" + path;
        string backdropUrl = ImageCacheHelper.GetCachedImageUrl(_imageCacheService, sourceUrl, _logger);

        if (string.IsNullOrEmpty(backdropUrl))
        {
            return null;
        }

        var dto = new CachedBackdropDto
        {
            BackdropUrl = backdropUrl,
            TmdbBackdropPath = path,
            HasEnglishBackdrop = pick.HasEnglishBackdrop
        };
        _cache[cacheKey] = dto;
        return dto;
    }

    public sealed class CachedBackdropDto
    {
        public string BackdropUrl { get; init; } = string.Empty;

        public string TmdbBackdropPath { get; init; } = string.Empty;

        public bool HasEnglishBackdrop { get; init; }
    }
}