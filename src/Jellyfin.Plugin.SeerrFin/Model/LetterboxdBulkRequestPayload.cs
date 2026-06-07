using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.SeerrFin.Model;

public class LetterboxdBulkRequestPayload
{
    [JsonPropertyName("TmdbIds")]
    public List<int> TmdbIds { get; set; } = new();

    [JsonPropertyName("QualityMode")]
    public string QualityMode { get; set; } = "singleProfile";

    [JsonPropertyName("ServerId")]
    public int? ServerId { get; set; }

    [JsonPropertyName("ProfileId")]
    public int? ProfileId { get; set; }

    [JsonPropertyName("RootFolder")]
    public string? RootFolder { get; set; }

    [JsonPropertyName("Is4k")]
    public bool Is4k { get; set; }
}