using Jellyfin.Plugin.SeerrFin.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.SeerrFin;

public class SeerrFinPlugin : BasePlugin<PluginConfiguration>, IHasPluginConfiguration, IHasWebPages
{
    public override Guid Id => Guid.Parse("c8e4f2a1-9b3d-4e7f-a6c2-1d5e8f0a3b7c");

    public override string Name => "SeerrFin";

    public static SeerrFinPlugin Instance { get; private set; } = null!;

    public SeerrFinPlugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public IEnumerable<PluginPageInfo> GetPages()
    {
        string? prefix = GetType().Namespace;
        yield return new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{prefix}.Configuration.config.html",
            EnableInMainMenu = true,
            DisplayName = "SeerrFin",
            MenuIcon = "preview",
        };
    }

    public void BustCache()
    {
        Configuration.CacheBustCounter++;
        SaveConfiguration();
    }
}
