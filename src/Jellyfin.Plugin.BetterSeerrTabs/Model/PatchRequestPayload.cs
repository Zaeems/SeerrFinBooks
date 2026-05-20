using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.BetterSeerrTabs.Model;

public class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
