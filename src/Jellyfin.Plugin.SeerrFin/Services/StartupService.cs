using System.Runtime.Loader;
using Jellyfin.Plugin.SeerrFin.Helpers;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.SeerrFin.Services;

public class StartupService : IScheduledTask
{
    private static readonly Guid IndexHtmlTransformationId = Guid.Parse("b7c1e2f3-4a5b-6c7d-8e9f-0a1b2c3d4e5f");

    private readonly ILogger<SeerrFinPlugin> _logger;

    public StartupService(ILogger<SeerrFinPlugin> logger)
    {
        _logger = logger;
    }

    public string Name => "SeerrFin Startup";

    public string Key => "Jellyfin.Plugin.SeerrFin.Startup";

    public string Description => "Registers file transformations for SeerrFin";

    public string Category => "Startup Services";

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        _logger.LogInformation("SF • registering file transformations");

        // Resolve File Transformation assembly at runtime via reflection
        var fileTransformationAssembly = AssemblyLoadContext.All
            .SelectMany(x => x.Assemblies)
            .FirstOrDefault(x => x.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);

        if (fileTransformationAssembly == null)
        {
            _logger.LogWarning("SF • File Transformation plugin not found. UI injection won't work");
            return Task.CompletedTask;
        }

        Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
        if (pluginInterfaceType == null)
        {
            _logger.LogWarning("SF • File Transformation PluginInterface type not found");
            return Task.CompletedTask;
        }

        var payload = new JObject
        {
            ["id"] = IndexHtmlTransformationId,
            ["fileNamePattern"] = "index.html",
            // Callback invoked by File Transformation when index.html served
            ["callbackAssembly"] = GetType().Assembly.FullName,
            ["callbackClass"] = typeof(TransformationPatches).FullName,
            ["callbackMethod"] = nameof(TransformationPatches.IndexHtml)
        };

        pluginInterfaceType.GetMethod("RegisterTransformation")?.Invoke(null, new object?[] { payload });
        _logger.LogInformation("SF • registered index.html transformation");
        return Task.CompletedTask;
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo { Type = TaskTriggerInfoType.StartupTrigger };
    }
}
