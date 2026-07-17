using System.Text;
using Jellyfin.Plugin.SeerrFin.Configuration;
using Jellyfin.Plugin.SeerrFin.Model;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.SeerrFin.Services;

public class JellyseerrRequestService
{
    private readonly ILogger<JellyseerrRequestService> _logger;

    public JellyseerrRequestService(ILogger<JellyseerrRequestService> logger)
    {
        _logger = logger;
    }

    public JArray GetRequestOptions(string username, string mediaType)
    {
        PluginConfiguration config = SeerrFinPlugin.Instance.Configuration;
        if (string.IsNullOrWhiteSpace(config.JellyseerrUrl) || string.IsNullOrWhiteSpace(config.JellyseerrApiKey))
        {
            return new JArray();
        }

        string serverType = mediaType == "movie" ? "radarr" : "sonarr";
        using HttpClient client = CreateClient(config);
        int? jellyseerrUserId = ResolveJellyseerrUserId(client, username);
        if (jellyseerrUserId != null)
        {
            client.DefaultRequestHeaders.Add("X-Api-User", jellyseerrUserId.ToString());
        }

        JArray options = new();
        try
        {
            // Seerr versions expose Radarr/Sonarr lists, which we can use to get profiles
            HttpResponseMessage listResponse = client.GetAsync($"/api/v1/service/{serverType}").GetAwaiter().GetResult();
            if (!listResponse.IsSuccessStatusCode)
            {
                listResponse = client.GetAsync($"/api/v1/settings/{serverType}").GetAwaiter().GetResult();
            }
            if (!listResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "SF • failed to fetch Seerr {ServerType} services: {StatusCode}",
                    serverType,
                    listResponse.StatusCode);
                return options;
            }

            string listRaw = listResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            JToken? listToken = JToken.Parse(listRaw);
            // API may return one server object or array
            IEnumerable<JObject> servers = listToken switch
            {
                JArray array => array.OfType<JObject>(),
                JObject single => new[] { single },
                _ => Array.Empty<JObject>()
            };

            foreach (JObject server in servers)
            {
                int? serverId = server.Value<int?>("id");
                if (serverId == null)
                {
                    continue;
                }

                string serverName = server.Value<string>("name") ?? $"Server {serverId}";
                bool is4k = server.Value<bool?>("is4k") ?? false;
                HttpResponseMessage detailResponse = client.GetAsync($"/api/v1/service/{serverType}/{serverId}").GetAwaiter().GetResult();
                if (!detailResponse.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "SF • failed to fetch Seerr {ServerType} service details for {ServerId}: {StatusCode}",
                        serverType,
                        serverId,
                        detailResponse.StatusCode);
                    continue;
                }

                string detailRaw = detailResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                JObject detail = JObject.Parse(detailRaw);
                JObject serverDetails = detail.Value<JObject>("server") ?? server;
                JArray? profiles = detail.Value<JArray>("profiles");
                string? defaultRootFolder = serverDetails.Value<string>("activeDirectory")
                    ?? detail.Value<JArray>("rootFolders")?
                    .OfType<JObject>()
                    .FirstOrDefault()?
                    .Value<string>("path");

                if (profiles == null || profiles.Count == 0)
                {
                    continue;
                }

                int? defaultProfileId = serverDetails.Value<int?>("activeProfileId");

                foreach (JObject profile in profiles.OfType<JObject>())
                {
                    int? profileId = profile.Value<int?>("id");
                    if (profileId == null)
                    {
                        continue;
                    }

                    options.Add(new JObject
                    {
                        ["serverId"] = serverId,
                        ["serverName"] = serverName,
                        ["is4k"] = is4k,
                        ["isDefault"] = serverDetails.Value<bool?>("isDefault") ?? server.Value<bool?>("isDefault") ?? false,
                        ["isDefaultProfile"] = defaultProfileId == profileId,
                        ["profileId"] = profileId,
                        ["profileName"] = profile.Value<string>("name") ?? $"Profile {profileId}",
                        ["rootFolder"] = defaultRootFolder
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SF • failed to fetch {ServerType} request options", serverType);
        }

        return options;
    }

    public async Task<(int StatusCode, string Body, string ContentType)> SubmitRequestAsync(
        string username,
        DiscoverRequestPayload payload,
        CancellationToken cancellationToken)
    {
        PluginConfiguration config = SeerrFinPlugin.Instance.Configuration;
        if (string.IsNullOrWhiteSpace(config.JellyseerrUrl) || string.IsNullOrWhiteSpace(config.JellyseerrApiKey))
        {
            return (400, "{}", "application/json");
        }

        using HttpClient client = new() { BaseAddress = new Uri(config.JellyseerrUrl!) };
        client.DefaultRequestHeaders.Add("X-Api-Key", config.JellyseerrApiKey);

        int? jellyseerrUserId = ResolveJellyseerrUserId(client, username);
        if (jellyseerrUserId == null)
        {
            return (400, "{}", "application/json");
        }

        client.DefaultRequestHeaders.Add("X-Api-User", jellyseerrUserId.ToString());

        JObject body = new()
        {
            ["mediaType"] = payload.MediaType,
            ["mediaId"] = payload.MediaId,
            ["tags"] = new JArray()
        };

        if (payload.MediaType == "tv")
        {
            if (payload.Seasons is { Count: > 0 })
            {
                body["seasons"] = new JArray(payload.Seasons);
            }
            else
            {
                body["seasons"] = "all";
            }
        }

        if (payload.ServerId != null)
        {
            body["serverId"] = payload.ServerId.Value;
        }

        if (payload.ProfileId != null)
        {
            body["profileId"] = payload.ProfileId.Value;
        }

        if (!string.IsNullOrWhiteSpace(payload.RootFolder))
        {
            body["rootFolder"] = payload.RootFolder;
        }

        if (payload.Is4k)
        {
            body["is4k"] = true;
        }

        HttpResponseMessage response = await client
            .PostAsync(
                "/api/v1/request",
                new StringContent(body.ToString(), Encoding.UTF8, "application/json"),
                cancellationToken)
            .ConfigureAwait(false);

        string content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        string contentType = response.Content.Headers.ContentType?.MediaType ?? "application/json";
        return ((int)response.StatusCode, content, contentType);
    }

    private static HttpClient CreateClient(PluginConfiguration config)
    {
        HttpClient client = new() { BaseAddress = new Uri(config.JellyseerrUrl!) };
        client.DefaultRequestHeaders.Add("X-Api-Key", config.JellyseerrApiKey);
        return client;
    }

    private static int? ResolveJellyseerrUserId(HttpClient client, string username)
    {
        HttpResponseMessage usersResponse = client.GetAsync($"/api/v1/user?q={Uri.EscapeDataString(username)}").GetAwaiter().GetResult();
        string userResponseRaw = usersResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult();
        return JObject.Parse(userResponseRaw).Value<JArray>("results")?
            .OfType<JObject>()
            .FirstOrDefault(x => string.Equals(x.Value<string>("jellyfinUsername"), username, StringComparison.OrdinalIgnoreCase))
            ?.Value<int>("id");
    }
}
