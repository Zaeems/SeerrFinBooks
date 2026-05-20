using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.BetterSeerrTabs.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public string? JellyseerrUrl { get; set; } = string.Empty;

    public string? JellyseerrApiKey { get; set; } = string.Empty;

    public string? JellyseerrPreferredLanguages { get; set; } = "en";

    public string? TmdbApiKey { get; set; } = string.Empty;

    public string WatchRegion { get; set; } = "US";

    public int RowItemLimit { get; set; } = 20;

    public int CacheTimeoutSeconds { get; set; } = 86400;

    public int MaxImageCacheEntries { get; set; } = 5000;

    public bool DeveloperMode { get; set; }

    public int CacheBustCounter { get; set; }
}
