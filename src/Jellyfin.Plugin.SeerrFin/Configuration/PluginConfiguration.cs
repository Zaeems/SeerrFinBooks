using Jellyfin.Plugin.SeerrFin.Configuration.Advanced;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.SeerrFin.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public string? JellyseerrUrl { get; set; } = "http://192.168.1.180:5055";

    public string? ExternalJellyseerrUrl { get; set; } = "http://192.168.1.180:5055";

    public string? JellyseerrApiKey { get; set; } = string.Empty;

    public string? RadarrUrl { get; set; } = "http://192.168.1.116:7878";

    public string? RadarrApiKey { get; set; } = string.Empty;

    public string? SonarrUrl { get; set; } = "http://192.168.1.123:8989";

    public string? SonarrApiKey { get; set; } = string.Empty;

    public string? ChaptarrUrl { get; set; } = "http://192.168.1.163:8789";

    public string? ChaptarrApiKey { get; set; } = "81dbbc0a981a411abaec9b1b6f51a167";

    public int ChaptarrAudiobookQualityProfileId { get; set; } = 2;

    public int ChaptarrEbookQualityProfileId { get; set; } = 1;

    public string? JellyseerrPreferredLanguages { get; set; } = "en";

    public string? TmdbApiKey { get; set; } = string.Empty;

    public string WatchRegion { get; set; } = "US";

    public int RowItemLimit { get; set; } = 20;

    public int CacheTimeoutSeconds { get; set; } = 86400;

    public int MaxImageCacheEntries { get; set; } = 5000;

    public bool DeveloperMode { get; set; }

    public int CacheBustCounter { get; set; }

    public bool StreamingServiceUseImages { get; set; } = true;

    public bool StudioNetworkUseImages { get; set; } = true;

    public bool GenreUseBackdrops { get; set; } = true;

    public bool DiscoverUsePosters { get; set; } = true;

    public List<int> DiscoverReleaseTypes { get; set; } = new();

    public bool ElegantFinFixes { get; set; }

    public bool QualityRecommendations { get; set; } = true;

    public bool AddSeerrResultsInSearch { get; set; } = true;

    public bool NativeCarousels { get; set; }

    public bool NativeGridPages { get; set; }

    public bool NativeSearchResults { get; set; }

    public string DisplayCustomizationsJson { get; set; } = string.Empty;

    public List<SeerrFinTabConfig> Tabs { get; set; } = new();

    public List<string> TabBarOrder { get; set; } = new();

    public AdvancedSettings? Advanced { get; set; }
}