namespace Jellyfin.Plugin.BetterSeerrTabs.Model;

public class LetterboxdSyncProgressDto
{
    public int Percent { get; set; }

    public string Phase { get; set; } = string.Empty; // pages (when gettings pages) or tmdb (matching tmdb ids)

    public bool IsActive { get; set; }
}