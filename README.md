<div align="center">

<div alt style="text-align: center; transform: scale(.25);">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="https://github.com/varunaditya-plus/SeerrFin/raw/main/assets/logo_dark.png" />
		<img alt="SeerrFin Logo" src="https://github.com/varunaditya-plus/SeerrFin/raw/main/assets/logo_light.png" style="width: 170px;" />
	</picture>
</div>

# SeerrFin (formerly BetterSeerrTabs)
![GitHub License](https://www.shieldcn.dev/github/license/varunaditya-plus/SeerrFin.svg?variant=outline&size=sm)
[![GitHub Downloads (all assets, all releases)](https://shieldcn.dev/github/downloads/varunaditya-plus/SeerrFin.svg?variant=outline&size=sm)](https://github.com/varunaditya-plus/SeerrFin/releases/latest)
[![GitHub Release](https://shieldcn.dev/github/release/varunaditya-plus/SeerrFin.svg?size=sm)](https://github.com/varunaditya-plus/SeerrFin/releases/latest)
![Please star this repo](https://shieldcn.dev/badge/★%20please%20star-22c55e.svg?theme=amber&color=eab308&size=sm&variant=outline)

The best way to discover and request Movies and TV Shows by using Seerr directly in Jellyfin. This plugin lets you add two top bar tabs for Movies and TV discovery, with request modals powered by your Seerr instance. The categories are gotten using TMDB.

</div>

<div align="center" style="width:100%;">
  <video src="https://github.com/user-attachments/assets/cec5bc22-0468-442a-8688-ff52f3129fe0"></video>
</div>

---

## Features
- **Movie and TV tabs**: New tabs for discovering movies and TV shows using Custom Tabs
- **Discovery sections**: Carousels sorting movies/tv shows to be discovered by (eg. Trending, Popular, etc.)
- **Request from Seerr**: Easily request movies and TV shows directly in Jellyfin and select quality profiles and specific seasons (for shows)
- **Quality recommendations**: Get the highest released and most common streaming quality when requesting to get the right quality for your request
- **Requests tab**: Track your Seerr requests with, and open each request open requested content in Seerr, Radarr or Sonarr
- **Radarr/Sonarr download progress**: See live download progress of requests to see how far along each request is
- **Letterboxd watchlist sync**: Sync your Letterboxd watchlist into Jellyfin and request all movies from your watchlist at once
- **Bulk request from Letterboxd**: Select and request multiple movies from your Letterboxd watchlist at once
- **Display customizations**: Customize logos, backdrops, poster style, and colors for all carousels/cards


## Installation

### First make sure you have these prerequisites:
- A running Jellyfin **10.11.x** and Seerr instance
- [File Transformation](https://www.iamparadox.dev/jellyfin/plugins/manifest.json) plugin
- [Custom Tabs](https://www.iamparadox.dev/jellyfin/plugins/manifest.json) plugin

### Install from plugin catalog
1. Open **Dashboard → Plugins → Manage Repositories**.
2. Click **New Repository** and paste this repository URL:
```
https://raw.githubusercontent.com/varunaditya-plus/SeerrFin/main/manifest.json
```
3. Now go back to **Plugins** in the sidebar, select **All** in the filters above the plugins, and click SeerrFin. Then click **Install**.
4. Now you have to restart your Jellyfin instance. Go to **Dashboard** and click the **Restart** button. You're done!

### Configuration
After installation, now configure the extension so it will work with your Seerr instance. Go to **Dashboard → SeerrFin**, click settings, and follow the instructions. Also fill out all the configurations (TMDB is optional but recommended). You're not stupid. You figured out how to get Jellyfin and Seerr installed.

## Screenshots
<table>
  <tr>
    <td><img width="1720" height="720" alt="Movie tab" src="https://github.com/user-attachments/assets/94fcae0d-9027-4e96-a6fc-d2c8fd1734c5" /></td>
    <td><img width="1720" height="720" alt="Content modal" src="https://github.com/user-attachments/assets/9b347369-79dd-4f6a-8abb-ba70f83040c3" /></td>
  </tr>
  <tr>
    <td><img width="1720" height="720" alt="Request tab" src="https://github.com/user-attachments/assets/c247919c-a22d-4852-afe5-70f03ee8f8d1" /></td>
    <td><img width="1720" height="720" alt="Letterboxd import tab" src="https://github.com/user-attachments/assets/4eae17eb-ebbc-4b6c-a28f-241088d00936" /></td>
  </tr>
</table>


## Contributing & Support
Please open pull requests if you have any suggestions or features you want to be implemented in this plugin. This is my first C# project, and is inspired heavily by [Home Screen Sections](https://github.com/IAmParadox27/jellyfin-plugin-home-sections). For suggestions, feature requests, or bug reports, open an issue. Please include your Jellyfin version and a screenshot if relevant.

## License
SeerrFin is licensed under the [MIT License](https://github.com/varunaditya-plus/SeerrFin/tree/main?tab=MIT-1-ov-file#readme).

## Credits
- [Lato](https://fonts.google.com/specimen/Lato) by Łukasz Dziedzic, served via Google Fonts.
- Movie and TV metadata, images, and the TMDB logo from [The Movie Database (TMDB)](https://www.themoviedb.org/).
- Discover and request flows powered by the [Seerr](https://github.com/seerr-team/seerr) API.
- [Letterboxd](https://letterboxd.com/) for providing user watchlists for Letterboxd syncing
- Streaming quality recommendations gotten from [JustWatch](https://www.justwatch.com/).
- Uses [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) and depends on [Custom Tabs](https://github.com/IAmParadox27/jellyfin-plugin-custom-tabs) by IAmParadox27.
