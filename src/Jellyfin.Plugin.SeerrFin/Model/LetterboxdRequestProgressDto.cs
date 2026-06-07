namespace Jellyfin.Plugin.SeerrFin.Model;

public class LetterboxdRequestProgressDto
{
    public int Done { get; set; }

    public int Total { get; set; }

    public int Percent { get; set; }

    public int? CurrentTmdbId { get; set; }

    public bool IsActive { get; set; }

    public List<LetterboxdBulkRequestItemResult> Completed { get; set; } = new();
}
