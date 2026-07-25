namespace Jellyfin.Plugin.SeerrFin.Configuration;

public class SeerrFinTabConfig
{
    public string Id { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;

    public static List<SeerrFinTabConfig> CreateDefaults() =>
    [
        new() { Id = "movies" },
        new() { Id = "tv" },
        new() { Id = "requests" },
        new() { Id = "letterboxd" }
    ];
}