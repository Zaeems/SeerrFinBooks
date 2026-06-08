using System.Collections.Concurrent;
using Jellyfin.Plugin.SeerrFin.Configuration;
using Jellyfin.Plugin.SeerrFin.Helpers;
using Jellyfin.Plugin.SeerrFin.Model;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.SeerrFin.Services;

public class TmdbBackdropService
{
    private const int MaxBatchConcurrency = 5;

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
        List<BackdropBatchItemDto> results = await GetCachedBackdropsAsync(
            new BackdropBatchRequestItemDto[]
            {
                new()
                {
                    MediaType = mediaType,
                    TmdbId = tmdbId
                }
            },
            cancellationToken).ConfigureAwait(false);

        BackdropBatchItemDto? match = results.FirstOrDefault();
        if (match == null || string.IsNullOrEmpty(match.BackdropUrl))
        {
            return null;
        }

        return new CachedBackdropDto
        {
            BackdropUrl = match.BackdropUrl,
            TmdbBackdropPath = match.TmdbBackdropPath,
            HasEnglishBackdrop = match.HasEnglishBackdrop
        };
    }

    public async Task<List<BackdropBatchItemDto>> GetCachedBackdropsAsync(IEnumerable<BackdropBatchRequestItemDto> items, CancellationToken cancellationToken = default)
    {
        List<BackdropBatchRequestItemDto> uniqueItems = items
            .Where(item => item.TmdbId > 0 && (string.Equals(item.MediaType, "movie", StringComparison.OrdinalIgnoreCase) || string.Equals(item.MediaType, "tv", StringComparison.OrdinalIgnoreCase)))
            .GroupBy(item => $"{item.MediaType.ToLowerInvariant()}:{item.TmdbId}")
            .Select(group => group.First())
            .ToList();

        if (uniqueItems.Count == 0)
        {
            return new List<BackdropBatchItemDto>();
        }

        using SemaphoreSlim semaphore = new(MaxBatchConcurrency, MaxBatchConcurrency);
        IEnumerable<Task<BackdropBatchItemDto?>> tasks = uniqueItems.Select(async item =>
        {
            await semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                return await ResolveBackdropItemAsync(item, cancellationToken).ConfigureAwait(false);
            }
            finally
            {
                semaphore.Release();
            }
        });

        BackdropBatchItemDto?[] resolved = await Task.WhenAll(tasks).ConfigureAwait(false);
        return resolved
            .Where(item => item != null && !string.IsNullOrEmpty(item.BackdropUrl))
            .Cast<BackdropBatchItemDto>()
            .ToList();
    }

    private async Task<BackdropBatchItemDto?> ResolveBackdropItemAsync(BackdropBatchRequestItemDto item, CancellationToken cancellationToken)
    {
        string mediaType = item.MediaType.ToLowerInvariant();
        int tmdbId = item.TmdbId;
        string cacheKey = $"{mediaType}:{tmdbId}";

        CachedBackdropDto? cached = TryGetCachedBackdrop(cacheKey);
        if (cached != null)
        {
            return ToBatchItem(mediaType, tmdbId, cached);
        }

        PluginConfiguration config = SeerrFinPlugin.Instance.Configuration;
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
        return ToBatchItem(mediaType, tmdbId, dto);
    }

    private CachedBackdropDto? TryGetCachedBackdrop(string cacheKey)
    {
        if (!_cache.TryGetValue(cacheKey, out CachedBackdropDto? cached))
        {
            return null;
        }

        if (string.IsNullOrEmpty(cached.TmdbBackdropPath))
        {
            _cache.TryRemove(cacheKey, out _);
            return null;
        }

        string cachedSourceUrl = "https://image.tmdb.org/t/p/w780" + cached.TmdbBackdropPath;
        string refreshedUrl = ImageCacheHelper.GetCachedImageUrl(_imageCacheService, cachedSourceUrl, _logger);
        if (!string.IsNullOrEmpty(refreshedUrl))
        {
            return new CachedBackdropDto
            {
                BackdropUrl = refreshedUrl,
                TmdbBackdropPath = cached.TmdbBackdropPath,
                HasEnglishBackdrop = cached.HasEnglishBackdrop
            };
        }

        _cache.TryRemove(cacheKey, out _);
        return null;
    }

    private static BackdropBatchItemDto ToBatchItem(string mediaType, int tmdbId, CachedBackdropDto cached) =>
        new()
        {
            MediaType = mediaType,
            TmdbId = tmdbId,
            BackdropUrl = cached.BackdropUrl,
            TmdbBackdropPath = cached.TmdbBackdropPath,
            HasEnglishBackdrop = cached.HasEnglishBackdrop
        };

    public sealed class CachedBackdropDto
    {
        public string BackdropUrl { get; init; } = string.Empty;

        public string TmdbBackdropPath { get; init; } = string.Empty;

        public bool HasEnglishBackdrop { get; init; }
    }
}