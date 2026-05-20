using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using Jellyfin.Plugin.BetterSeerrTabs.Services;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.BetterSeerrTabs.Helpers;

public static class ImageCacheHelper
{
    public static string GetCachedImageUrl(
        ImageCacheService imageCacheService,
        string? sourceUrl,
        ILogger? logger = null)
    {
        if (string.IsNullOrEmpty(sourceUrl))
        {
            return string.Empty;
        }

        try
        {
            PluginConfiguration? config = BetterSeerrTabsPlugin.Instance?.Configuration;
            int cacheTimeout = config?.CacheTimeoutSeconds ?? 86400;

            // Used in discovery mapping which allows cached images to be used in discovery cards
            string? cacheKey = imageCacheService.GetOrCacheImage(sourceUrl, cacheTimeout)
                .GetAwaiter()
                .GetResult();

            if (!string.IsNullOrEmpty(cacheKey))
            {
                return $"/BetterSeerrTabs/CachedImage/{cacheKey}";
            }

            logger?.LogWarning("Failed to cache image from {SourceUrl}, using original URL", sourceUrl);
            return sourceUrl;
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "Error caching image from {SourceUrl}", sourceUrl);
            return sourceUrl;
        }
    }
}
