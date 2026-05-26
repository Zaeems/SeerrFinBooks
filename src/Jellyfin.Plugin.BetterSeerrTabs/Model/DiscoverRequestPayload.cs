using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.BetterSeerrTabs.Model;

public class DiscoverRequestPayload
{
    [JsonPropertyName("MediaType")]
    public string MediaType { get; set; } = string.Empty;

    [JsonPropertyName("MediaId")]
    public int MediaId { get; set; }

    [JsonPropertyName("ServerId")]
    public int? ServerId { get; set; }

    [JsonPropertyName("ProfileId")]
    public int? ProfileId { get; set; }

    [JsonPropertyName("RootFolder")]
    public string? RootFolder { get; set; }

    [JsonPropertyName("Is4k")]
    public bool Is4k { get; set; }

    [JsonPropertyName("Seasons")]
    public List<int>? Seasons { get; set; }
}
