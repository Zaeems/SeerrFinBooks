namespace Jellyfin.Plugin.BetterSeerrTabs.Model;

public class LetterboxdBulkRequestResultDto
{
    public int Requested { get; set; }

    public int Skipped { get; set; }

    public int Failed { get; set; }

    public List<LetterboxdBulkRequestItemResult> Results { get; set; } = new();
}

public class LetterboxdBulkRequestItemResult
{
    public int TmdbId { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? ProfileName { get; set; }

    public string? QualityLabel { get; set; }

    public string? Message { get; set; }
}