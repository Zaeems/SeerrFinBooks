namespace Jellyfin.Plugin.SeerrFin.Configuration;

public static class SeerrFinTabConfigHelper
{
    public static readonly string[] ValidTabIds = { "movies", "tv", "books", "requests", "letterboxd" };

    public static List<SeerrFinTabConfig> Normalize(List<SeerrFinTabConfig>? tabs)
    {
        var defaults = new Dictionary<string, string>
        {
            { "movies", "Movies" },
            { "tv", "TV Shows" },
            { "books", "Books" },
            { "requests", "Requests" },
            { "letterboxd", "Letterboxd" }
        };

        var existingById = (tabs ?? new List<SeerrFinTabConfig>())
            .Where(t => !string.IsNullOrWhiteSpace(t.Id))
            .ToDictionary(t => t.Id.ToLowerInvariant(), t => t);

        var result = new List<SeerrFinTabConfig>();
        foreach (var id in ValidTabIds)
        {
            if (existingById.TryGetValue(id, out var existing))
            {
                result.Add(new SeerrFinTabConfig
                {
                    Id = id,
                    Enabled = existing.Enabled,
                    Title = string.IsNullOrWhiteSpace(existing.Title) ? defaults[id] : existing.Title.Trim()
                });
            }
            else
            {
                result.Add(new SeerrFinTabConfig
                {
                    Id = id,
                    Enabled = true,
                    Title = defaults[id]
                });
            }
        }

        return result;
    }

    public static List<string> NormalizeBarOrder(List<string>? order)
    {
        var result = new List<string>();
        var seen = new HashSet<string>();

        void Add(string key)
        {
            if (string.IsNullOrWhiteSpace(key) || seen.Contains(key)) return;
            seen.Add(key);
            result.Add(key);
        }

        Add("jf:home");
        Add("jf:favorites");

        if (order != null)
        {
            foreach (var item in order)
            {
                if (string.IsNullOrWhiteSpace(item)) continue;
                var norm = item.Trim();
                if (ValidTabIds.Contains(norm.ToLowerInvariant()))
                {
                    norm = "sf:" + norm.ToLowerInvariant();
                }

                if (norm.StartsWith("sf:", StringComparison.OrdinalIgnoreCase) &&
                    ValidTabIds.Contains(norm.Substring(3).ToLowerInvariant()))
                {
                    Add(norm.ToLowerInvariant());
                }
            }
        }

        foreach (var id in ValidTabIds)
        {
            Add("sf:" + id);
        }

        return result;
    }
}