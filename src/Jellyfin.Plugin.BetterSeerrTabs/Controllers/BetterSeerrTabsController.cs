using System.Reflection;
using System.Text;
using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using Jellyfin.Plugin.BetterSeerrTabs.Model;
using Jellyfin.Plugin.BetterSeerrTabs.Services;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.BetterSeerrTabs.Controllers;

[ApiController]
[Route("[controller]")]
public class BetterSeerrTabsController : ControllerBase
{
    private readonly JellyseerrDiscoveryService _discoveryService;
    private readonly JellyseerrRequestService _requestService;
    private readonly JellyseerrProxyService _proxyService;
    private readonly ImageCacheService _imageCacheService;

    public BetterSeerrTabsController(
        JellyseerrDiscoveryService discoveryService,
        JellyseerrRequestService requestService,
        JellyseerrProxyService proxyService,
        ImageCacheService imageCacheService)
    {
        _discoveryService = discoveryService;
        _requestService = requestService;
        _proxyService = proxyService;
        _imageCacheService = imageCacheService;
    }

    private Guid GetUserId()
    {
        string? userIdString = User.Claims
            .FirstOrDefault(x => x.Type.Equals("Jellyfin-UserId", StringComparison.OrdinalIgnoreCase))?.Value;
        return string.IsNullOrEmpty(userIdString) ? Guid.Empty : Guid.Parse(userIdString);
    }

    private string? GetUsername(IUserManager userManager)
    {
        Guid userId = GetUserId();
        if (userId == Guid.Empty)
        {
            return null;
        }

        return userManager.GetUserById(userId)?.Username;
    }

    private void SetCacheHeaders()
    {
        var config = BetterSeerrTabsPlugin.Instance.Configuration;
        // Developer mode bypasses browser cache. Production uses configurable ttl
        if (config.DeveloperMode)
        {
            Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        }
        else
        {
            Response.Headers.CacheControl = $"public, max-age={config.CacheTimeoutSeconds}";
        }

        // ETag is the assembly version with admin cache-bust counter so config saves invalidate old assets
        string version = BetterSeerrTabsPlugin.Instance.GetType().Assembly.GetName().Version?.ToString() ?? "1.0.0.0";
        Response.Headers.ETag = $"\"v{version}-c{config.CacheBustCounter}\"";
    }

    [HttpGet("betterseerr-tabs.js")]
    [Produces("application/javascript")]
    public ActionResult GetScript() => ServeEmbedded("Inject.betterseerr-tabs.js", "application/javascript");

    [HttpGet("betterseerr-tabs.css")]
    [Produces("text/css")]
    public ActionResult GetStylesheet() => ServeEmbedded("Inject.betterseerr-tabs.css", "text/css");

    [HttpGet("betterseerr-modal.js")]
    [Produces("application/javascript")]
    public ActionResult GetModalScript() => ServeEmbedded("Inject.betterseerr-modal.js", "application/javascript");

    [HttpGet("betterseerr-modal.css")]
    [Produces("text/css")]
    public ActionResult GetModalStylesheet() => ServeEmbedded("Inject.betterseerr-modal.css", "text/css");

    [HttpGet("jellyseerr/{*path}")]
    [Authorize]
    public Task<IActionResult> JellyseerrProxyGet(
        string path,
        [FromServices] IUserManager userManager,
        CancellationToken cancellationToken) =>
        ProxyJellyseerr(userManager, HttpMethod.Get, path, null, cancellationToken);

    [HttpPost("jellyseerr/{*path}")]
    [Authorize]
    public async Task<IActionResult> JellyseerrProxyPost(
        string path,
        [FromServices] IUserManager userManager,
        CancellationToken cancellationToken)
    {
        using StreamReader reader = new(Request.Body, Encoding.UTF8);
        string body = await reader.ReadToEndAsync(cancellationToken).ConfigureAwait(false);
        return await ProxyJellyseerr(userManager, HttpMethod.Post, path, body, cancellationToken).ConfigureAwait(false);
    }

    private async Task<IActionResult> ProxyJellyseerr(
        IUserManager userManager,
        HttpMethod method,
        string path,
        string? body,
        CancellationToken cancellationToken)
    {
        string? username = GetUsername(userManager);
        if (string.IsNullOrWhiteSpace(username))
        {
            return Forbid();
        }

        (int statusCode, string responseBody, string contentType) = await _proxyService
            .ProxyAsync(username, method, path, body, cancellationToken)
            .ConfigureAwait(false);

        return new ContentResult
        {
            StatusCode = statusCode,
            Content = responseBody,
            ContentType = contentType
        };
    }

    [HttpGet("Configuration")]
    [Authorize(Roles = "Administrator")]
    public ActionResult<PluginConfiguration> GetConfiguration() => BetterSeerrTabsPlugin.Instance.Configuration;

    [HttpGet("CachedImage/{cacheKey}")]
    public ActionResult GetCachedImage([FromRoute] string cacheKey)
    {
        (byte[]? data, string? contentType) = _imageCacheService.GetCachedImage(cacheKey);
        if (data == null || contentType == null)
        {
            return NotFound();
        }

        return File(data, contentType);
    }

    [HttpGet("discover/movies/trending")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> MoviesTrending([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/trending", "movie");

    [HttpGet("discover/movies/popular")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> MoviesPopular([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/movies?sortBy=popularity.desc", "movie");

    [HttpGet("discover/movies/top-rated")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> MoviesTopRated([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/movies?sortBy=vote_average.desc&voteCountGte=200", "movie");

    [HttpGet("discover/movies/upcoming")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> MoviesUpcoming([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/movies/upcoming", "movie");

    [HttpGet("discover/tv/trending")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> TvTrending([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/trending", "tv");

    [HttpGet("discover/tv/popular")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> TvPopular([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/tv?sortBy=popularity.desc", "tv");

    [HttpGet("discover/tv/top-rated")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> TvTopRated([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/tv?sortBy=vote_average.desc&voteCountGte=200", "tv");

    [HttpGet("discover/tv/upcoming")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> TvUpcoming([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/tv/upcoming", "tv");

    [HttpGet("discover/tv/anime")]
    [Authorize]
    public ActionResult<QueryResult<BaseItemDto>> TvAnime([FromServices] IUserManager userManager) =>
        _discoveryService.GetDiscoverRow(GetUsername(userManager) ?? string.Empty, "/api/v1/discover/tv?genre=16&originalLanguage=ja", "tv");

    [HttpGet("genres/movie")]
    [Authorize]
    public ActionResult<JArray> MovieGenres() => _discoveryService.GetGenreSlider("movie");

    [HttpGet("genres/tv")]
    [Authorize]
    public ActionResult<JArray> TvGenres() => _discoveryService.GetGenreSlider("tv");

    [HttpGet("providers/movie")]
    [Authorize]
    public ActionResult<JArray> MovieProviders() => _discoveryService.GetWatchProviders("movie");

    [HttpGet("providers/tv")]
    [Authorize]
    public ActionResult<JArray> TvProviders() => _discoveryService.GetWatchProviders("tv");

    [HttpGet("client-settings")]
    [Authorize]
    public ActionResult GetClientSettings()
    {
        string? key = BetterSeerrTabsPlugin.Instance.Configuration.TmdbApiKey?.Trim();
        return Ok(new { tmdbApiKey = key ?? string.Empty });
    }

    [HttpGet("details/{mediaType}/{mediaId}")]
    [Authorize]
    public ActionResult GetDetails(
        string mediaType,
        int mediaId,
        [FromServices] IUserManager userManager)
    {
        JObject? details = _discoveryService.GetMediaDetails(GetUsername(userManager) ?? string.Empty, mediaType, mediaId);
        return details == null ? NotFound() : Content(details.ToString(), "application/json");
    }

    [HttpGet("request-options/{mediaType}")]
    [Authorize]
    public ActionResult GetRequestOptions(string mediaType, [FromServices] IUserManager userManager)
    {
        string? username = GetUsername(userManager);
        if (string.IsNullOrWhiteSpace(username))
        {
            return Forbid();
        }

        JArray options = _requestService.GetRequestOptions(username, mediaType);
        return Content(options.ToString(), "application/json");
    }

    [HttpPost("request")]
    [Authorize]
    public async Task<ActionResult> MakeDiscoverRequest(
        [FromServices] IUserManager userManager,
        [FromBody] DiscoverRequestPayload payload,
        CancellationToken cancellationToken)
    {
        string? username = GetUsername(userManager);
        if (string.IsNullOrWhiteSpace(username))
        {
            return Forbid();
        }

        (int statusCode, string body, string contentType) = await _requestService
            .SubmitRequestAsync(username, payload, cancellationToken)
            .ConfigureAwait(false);

        return new ContentResult
        {
            StatusCode = statusCode,
            Content = body,
            ContentType = contentType
        };
    }

    private ActionResult ServeEmbedded(string resourceName, string contentType)
    {
        Stream? stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream($"{typeof(BetterSeerrTabsPlugin).Namespace}.{resourceName}");
        if (stream == null)
        {
            return NotFound();
        }

        SetCacheHeaders();
        return File(stream, contentType);
    }
}
