namespace Jellyfin.Plugin.SeerrFin.Configuration.Advanced;

public class AdvancedLetterboxdSettings
{
    public string UsernamePattern { get; set; } = "^[a-zA-Z0-9_-]{1,30}$";

    public bool RequestCardsInteractive { get; set; }

    public bool RequestCardsIncludeMetaText { get; set; } = true;

    public string DefaultBulkQualityMode { get; set; } = "singleProfile";

    public string AlreadyRequestedMode { get; set; } = "prompt";

    public string AlreadyRequestedStatusScope { get; set; } = "anyMediaInfo";

    public int HttpTimeoutSeconds { get; set; } = 60;

    public int SyncPagesProgressWeight { get; set; } = 50;
}