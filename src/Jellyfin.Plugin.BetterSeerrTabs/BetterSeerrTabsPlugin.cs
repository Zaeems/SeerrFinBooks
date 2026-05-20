using Jellyfin.Plugin.BetterSeerrTabs.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.BetterSeerrTabs;

public class BetterSeerrTabsPlugin : BasePlugin<PluginConfiguration>, IHasPluginConfiguration, IHasWebPages
{
    public override Guid Id => Guid.Parse("c8e4f2a1-9b3d-4e7f-a6c2-1d5e8f0a3b7c");

    public override string Name => "BetterSeerrTabs";

    public static BetterSeerrTabsPlugin Instance { get; private set; } = null!;

    public BetterSeerrTabsPlugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
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
            EmbeddedResourcePath = $"{prefix}.Configuration.config.html"
        };
    }

    public void BustCache()
    {
        Configuration.CacheBustCounter++;
        SaveConfiguration();
    }
}
