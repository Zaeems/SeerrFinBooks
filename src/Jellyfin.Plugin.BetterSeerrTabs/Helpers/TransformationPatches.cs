using Jellyfin.Plugin.BetterSeerrTabs.Model;

namespace Jellyfin.Plugin.BetterSeerrTabs.Helpers;

public static class TransformationPatches
{
    public static string IndexHtml(PatchRequestPayload payload)
    {
        string version = BetterSeerrTabsPlugin.Instance.GetType().Assembly.GetName().Version?.ToString() ?? "1.0.0.0";
        var config = BetterSeerrTabsPlugin.Instance.Configuration;

        // For development, bust cache every load.
        // For prod, use stabse urls until admin bumps CacheBustCounter.
        string cacheParam = config.DeveloperMode
            ? $"?v={version}&t={DateTimeOffset.UtcNow.Ticks}"
            : $"?v={version}&c={config.CacheBustCounter}";

        // Font that the modal uses (from Aether)
        string fontLinks =
            "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />" +
            "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />" +
            "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&amp;display=swap\" />";

        // CSS/JS that the plugin injects into the page
        string cssLinks =
            fontLinks +
            $"<link rel=\"stylesheet\" href=\"/BetterSeerrTabs/betterseerr-tabs.css{cacheParam}\" />" +
            $"<link rel=\"stylesheet\" href=\"/BetterSeerrTabs/betterseerr-modal.css{cacheParam}\" />" +
            $"<link rel=\"stylesheet\" href=\"/BetterSeerrTabs/betterseerr-requests.css{cacheParam}\" />" +
            $"<link rel=\"stylesheet\" href=\"/BetterSeerrTabs/betterseerr-letterboxd.css{cacheParam}\" />";
        string scripts =
            $"<script defer src=\"/BetterSeerrTabs/betterseerr-modal.js{cacheParam}\"></script>" +
            $"<script defer src=\"/BetterSeerrTabs/betterseerr-tabs.js{cacheParam}\"></script>" +
            $"<script defer src=\"/BetterSeerrTabs/betterseerr-requests.js{cacheParam}\"></script>" +
            $"<script defer src=\"/BetterSeerrTabs/betterseerr-letterboxd.js{cacheParam}\"></script>";

        return payload.Contents!
            .Replace("</head>", $"{cssLinks}</head>", StringComparison.Ordinal)
            .Replace("</body>", $"{scripts}</body>", StringComparison.Ordinal);
    }
}
