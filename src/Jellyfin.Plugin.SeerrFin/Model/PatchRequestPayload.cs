using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.SeerrFin.Model;

public class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
