# BetterSeerrTabs

The best way to discover and request Movies and TV Shows through Jellyfin with tabs, using Seerr and TMDB.

This plugin adds two top-bar tabs for Movies and TV discovery, with in-app request modals powered by your Jellyseerr instance.

## Requirements

- Jellyfin **10.11.x**
- [File Transformation](https://www.iamparadox.dev/jellyfin/plugins/manifest.json) plugin
- [Custom Tabs](https://www.iamparadox.dev/jellyfin/plugins/manifest.json) plugin
- A running Jellyseerr (or compatible Seerr) instance

## Install from plugin catalog

1. Open **Dashboard → Plugins → Repositories**.
2. Click **+** and paste this repository URL:

```
https://raw.githubusercontent.com/varunaditya-plus/BetterSeerrTabs/main/manifest.json
```

3. Save, then open the **Catalog** tab.
4. Find **BetterSeerrTabs**, install it, and restart Jellyfin when prompted.

## Manual install

Download the latest zip from [Releases](https://github.com/varunaditya-plus/BetterSeerrTabs/releases), extract it into your Jellyfin `plugins` folder, and restart the server.

## Configuration

After install, open **Dashboard → Plugins → BetterSeerrTabs** and follow the setup steps for Jellyseerr URL, TMDB key, and Custom Tabs entries.

## Releases

Tagged releases (`1.0.0.0`, etc.) are built automatically by GitHub Actions and published to this repository’s manifest.
