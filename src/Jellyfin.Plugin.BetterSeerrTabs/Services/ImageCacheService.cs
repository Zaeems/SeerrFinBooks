using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using Jellyfin.Plugin.BetterSeerrTabs.Model;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.BetterSeerrTabs.Services;

public class ImageCacheService
{
    private readonly ILogger<ImageCacheService> _logger;
    private readonly HttpClient _httpClient;
    private readonly string _cacheDirectory;
    private readonly ConcurrentDictionary<string, CachedImageDto> _imageCache = new();

    public ImageCacheService(
        ILogger<ImageCacheService> logger,
        IApplicationPaths applicationPaths,
        HttpClient httpClient)
    {
        _logger = logger;
        _httpClient = httpClient;
        _cacheDirectory = Path.Combine(applicationPaths.CachePath, "BetterSeerrTabs", "Images");
        Directory.CreateDirectory(_cacheDirectory);
        LoadCacheIndex();
    }

    public async Task<string?> GetOrCacheImage(string sourceUrl, int cacheTimeoutSeconds)
    {
        if (string.IsNullOrEmpty(sourceUrl))
        {
            return null;
        }

        string cacheKey = GenerateCacheKey(sourceUrl);

        if (IsValidCacheKey(cacheKey))
        {
            return cacheKey;
        }

        // Index hit but file missing or expired. Remove stale entry before re-downloading
        if (_imageCache.ContainsKey(cacheKey))
        {
            CleanupCacheEntry(cacheKey);
        }

        // Remove oldest 10% when at capacity so new downloads don't grow too much
        PluginConfiguration config = BetterSeerrTabsPlugin.Instance.Configuration;
        if (_imageCache.Count >= config.MaxImageCacheEntries)
        {
            EvictOldEntries();
        }

        return await DownloadAndCacheImage(sourceUrl, cacheKey, cacheTimeoutSeconds).ConfigureAwait(false);
    }

    public (byte[]? data, string? contentType) GetCachedImage(string cacheKey)
    {
        if (!_imageCache.TryGetValue(cacheKey, out CachedImageDto? cachedInfo))
        {
            return (null, null);
        }

        if (cachedInfo.ExpiresAt < DateTime.UtcNow || !File.Exists(cachedInfo.FilePath))
        {
            _imageCache.TryRemove(cacheKey, out _);
            return (null, null);
        }

        try
        {
            return (File.ReadAllBytes(cachedInfo.FilePath), cachedInfo.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading cached image {CacheKey}", cacheKey);
            return (null, null);
        }
    }

    private bool IsValidCacheKey(string cacheKey)
    {
        return _imageCache.TryGetValue(cacheKey, out CachedImageDto? cachedInfo)
               && cachedInfo.ExpiresAt > DateTime.UtcNow
               && File.Exists(cachedInfo.FilePath);
    }

    private async Task<string?> DownloadAndCacheImage(string sourceUrl, string cacheKey, int cacheTimeoutSeconds)
    {
        try
        {
            using HttpResponseMessage response = await _httpClient.GetAsync(sourceUrl).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            byte[] imageData = await response.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
            string contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            string extension = GetExtensionFromContentType(contentType);
            string filePath = Path.Combine(_cacheDirectory, $"{cacheKey}{extension}");
            await File.WriteAllBytesAsync(filePath, imageData).ConfigureAwait(false);

            _imageCache[cacheKey] = new CachedImageDto
            {
                CacheKey = cacheKey,
                SourceUrl = sourceUrl,
                FilePath = filePath,
                ContentType = contentType,
                CachedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddSeconds(cacheTimeoutSeconds)
            };
            SaveCacheIndex();
            return cacheKey;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error caching image from {SourceUrl}", sourceUrl);
            return null;
        }
    }

    private void CleanupCacheEntry(string cacheKey)
    {
        if (_imageCache.TryRemove(cacheKey, out CachedImageDto? cachedInfo) && File.Exists(cachedInfo.FilePath))
        {
            try
            {
                File.Delete(cachedInfo.FilePath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete cache file {FilePath}", cachedInfo.FilePath);
            }
        }
    }

    private void EvictOldEntries()
    {
        int maxEntries = BetterSeerrTabsPlugin.Instance.Configuration.MaxImageCacheEntries;
        foreach (string key in _imageCache.Values
                     .OrderBy(x => x.CachedAt)
                     .Take(Math.Max(1, maxEntries / 10))
                     .Select(x => x.CacheKey))
        {
            CleanupCacheEntry(key);
        }

        SaveCacheIndex();
    }

    private void LoadCacheIndex()
    {
        string indexPath = Path.Combine(_cacheDirectory, "cache-index.json");
        if (!File.Exists(indexPath))
        {
            return;
        }

        try
        {
            CachedImageDto[]? entries = JsonSerializer.Deserialize<CachedImageDto[]>(File.ReadAllText(indexPath));
            if (entries == null)
            {
                return;
            }

            foreach (CachedImageDto entry in entries)
            {
                if (entry.ExpiresAt > DateTime.UtcNow && File.Exists(entry.FilePath))
                {
                    _imageCache[entry.CacheKey] = entry;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading cache index");
        }
    }

    private void SaveCacheIndex()
    {
        try
        {
            string indexPath = Path.Combine(_cacheDirectory, "cache-index.json");
            string json = JsonSerializer.Serialize(_imageCache.Values.ToArray(), new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(indexPath, json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving cache index");
        }
    }

    private static string GenerateCacheKey(string sourceUrl)
    {
        byte[] hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(sourceUrl));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    private static string GetExtensionFromContentType(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/png" => ".png",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        _ => ".jpg"
    };
}
