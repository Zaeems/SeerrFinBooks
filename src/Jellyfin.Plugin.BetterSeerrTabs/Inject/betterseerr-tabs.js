'use strict';

if (typeof window.betterSeerrTabsPlugin === 'undefined') {
    window.betterSeerrTabsPlugin = {
        movieRows: [
            { title: 'Trending movies this week', path: 'discover/movies/trending' },
            { title: 'Popular movies', path: 'discover/movies/popular' },
            { title: 'Top rated movies', path: 'discover/movies/top-rated' },
            { title: 'Upcoming movies', path: 'discover/movies/upcoming' }
        ],

        tvRows: [
            { title: 'Trending shows this week', path: 'discover/tv/trending' },
            { title: 'Popular shows', path: 'discover/tv/popular' },
            { title: 'Top rated series', path: 'discover/tv/top-rated' },
            { title: 'Upcoming series', path: 'discover/tv/upcoming' },
            { title: 'Anime series', path: 'discover/tv/anime' }
        ],

        _watchersReady: false,
        _handlersBound: false,
        _gridPageSize: 40,
        _displaySettings: null,

        init: function () {
            if (typeof ApiClient === 'undefined') {
                setTimeout(() => this.init(), 200);
                return;
            }

            if (!this._handlersBound) {
                this._handlersBound = true;
                this.bindRequestHandler();
                this.bindCardClickHandler();
                this.bindViewMoreHandler();
            }

            if (!this._watchersReady) {
                this._watchersReady = true;
                this.setupCustomTabWatchers();
            } else {
                this.scheduleRender();
            }
        },

        isContainerVisible: function (container) {
            if (!container || !container.isConnected) {
                return false;
            }

            // jf hides inactive pages with .hide rather than removing from the actual page
            const page = container.closest('.page');
            if (page && page.classList.contains('hide')) {
                return false;
            }

            const tabPanel = container.closest('.tabContent, .pageTabContent');
            if (tabPanel && tabPanel.classList.contains('hide')) {
                return false;
            }

            return container.offsetParent !== null;
        },

        findActiveContainer: function (selector) {
            // jf might keep the duplicate tab dom, so prefer last match
            const all = document.querySelectorAll(selector);
            for (let i = all.length - 1; i >= 0; i--) {
                if (this.isContainerVisible(all[i])) {
                    return all[i];
                }
            }
            return null;
        },

        asArray: function (data) {
            if (!data) {
                return [];
            }
            if (Array.isArray(data)) {
                return data;
            }
            if (data.results && Array.isArray(data.results)) {
                return data.results;
            }
            return [];
        },

        scheduleRender: function () {
            const self = this;
            if (self._renderPending) {
                return;
            }
            self._renderPending = true;
            requestAnimationFrame(function () {
                self._renderPending = false;
                self.renderIfContainerVisible('movies');
                self.renderIfContainerVisible('tv');
            });
        },

        setupCustomTabWatchers: function () {
            const self = this;

            document.addEventListener('viewshow', function () {
                self.scheduleRender();
            });

            document.addEventListener('click', function (e) {
                if (e.target.closest('.emby-tab-button')) {
                    setTimeout(function () {
                        self.scheduleRender();
                    }, 250);
                }
            });

            self.scheduleRender();
        },

        isContainerLoading: function (container) {
            return container.dataset.betterseerrLoading === 'true';
        },

        isContainerPopulated: function (container) {
            return container.querySelector('.betterseerr-poster-section') !== null;
        },

        renderIfContainerVisible: function (type) {
            const selector = type === 'movies' ? '.betterseerr-movies-sections' : '.betterseerr-tv-sections';
            const container = this.findActiveContainer(selector);
            if (!container) {
                return;
            }

            if (this.isContainerLoading(container)) {
                return;
            }

            const self = this;
            this.loadDisplaySettings().then(function () {
                const settingsKey = String(self._displaySettings.StreamingServiceUseImages) + ':' +
                    String(self._displaySettings.StudioNetworkUseImages) + ':' +
                    String(self._displaySettings.GenreUseBackdrops) + ':' +
                    String(self._displaySettings.DiscoverUsePosters);

                if (container.dataset.betterseerrDisplaySettings !== settingsKey) {
                    container.dataset.betterseerrDisplaySettings = settingsKey;
                    if (self.isContainerPopulated(container)) {
                        container.innerHTML = '';
                        delete container.dataset.betterseerrLoaded;
                        delete container.dataset.betterseerrLoading;
                    }
                }

                if (self.isContainerPopulated(container)) {
                    return;
                }

                const hasError = container.querySelector('.betterseerr-empty-row');
                if (hasError && container.dataset.betterseerrLoaded === 'true') {
                    return;
                }

                self.loadTab(type, container);
            });
        },

        loadTab: function (type, container) {
            if (!container) {
                container = this.findActiveContainer(
                    type === 'movies' ? '.betterseerr-movies-sections' : '.betterseerr-tv-sections'
                );
            }
            if (!container || !this.isContainerVisible(container)) {
                return;
            }

            if (this.isContainerLoading(container) || this.isContainerPopulated(container)) {
                return;
            }

            const rows = type === 'movies' ? this.movieRows : this.tvRows;
            const mediaType = type === 'movies' ? 'movie' : 'tv';
            const self = this;
            const loadId = String(Date.now()) + '-' + Math.random().toString(16).slice(2);

            container.dataset.betterseerrLoading = 'true';
            container.dataset.betterseerrLoadId = loadId;
            delete container.dataset.betterseerrLoaded;
            container.innerHTML = '<div class="betterseerr-loading-row">Loading...</div>';

            // Ignore results if user switched tabs or theres a newer load. Going back through chrome back button is still broken though
            const finishLoading = function () {
                if (container.dataset.betterseerrLoadId !== loadId) {
                    return;
                }
                container.dataset.betterseerrLoading = 'false';
                container.dataset.betterseerrLoaded = 'true';
            };

            const isStale = function () {
                return container.dataset.betterseerrLoadId !== loadId || !self.isContainerVisible(container);
            };

            Promise.allSettled([
                self.loadDisplaySettings(),
                ...rows.map(function (row) {
                    return self.fetchDiscover(row.path).then(function (result) {
                        return { row: row, items: result.items };
                    });
                })
            ]).then(function (results) {
                if (isStale()) {
                    return null;
                }

                const loadedRows = [];
                results.slice(1).forEach(function (result, index) {
                    if (result.status === 'fulfilled') {
                        loadedRows.push(result.value);
                    } else {
                        console.warn('BetterSeerrTabs: row failed', rows[index].path, result.reason);
                    }
                });

                if (!loadedRows.length) {
                    throw new Error('All discovery rows failed');
                }

                container.innerHTML = '';
                loadedRows.forEach(function (result) {
                    try {
                        container.appendChild(self.buildPosterRow(result.row.title, result.items, result.row.path));
                    } catch (err) {
                        console.warn('BetterSeerrTabs: row render failed', result.row.title, err);
                    }
                });

                self.refreshScrollers(container);

                return Promise.allSettled([
                    self.fetchJson('genres/' + mediaType),
                    self.fetchJson('providers/' + mediaType),
                    mediaType === 'movie'
                        ? self.fetchJson('studios/movie')
                        : self.fetchJson('networks/tv')
                ]);
            }).then(function (carouselResults) {
                if (!carouselResults || isStale()) {
                    finishLoading();
                    return;
                }

                try {
                    const genres = carouselResults[0].status === 'fulfilled'
                        ? self.asArray(carouselResults[0].value)
                        : [];
                    const providers = carouselResults[1].status === 'fulfilled'
                        ? self.asArray(carouselResults[1].value)
                        : [];
                    const browseItems = carouselResults[2].status === 'fulfilled'
                        ? self.asArray(carouselResults[2].value)
                        : [];

                    if (carouselResults[0].status === 'rejected') {
                        console.warn('BetterSeerrTabs: genre carousel failed', carouselResults[0].reason);
                    }
                    if (carouselResults[1].status === 'rejected') {
                        console.warn('BetterSeerrTabs: provider carousel failed', carouselResults[1].reason);
                    }
                    if (carouselResults[2].status === 'rejected') {
                        console.warn('BetterSeerrTabs: browse carousel failed', carouselResults[2].reason);
                    }

                    if (genres.length) {
                        container.appendChild(self.buildCarouselSection('Browse by genre', genres, mediaType, 'genre'));
                    }
                    if (providers.length) {
                        container.appendChild(self.buildCarouselSection('Browse by streaming service', providers, mediaType, 'provider'));
                    }
                    if (browseItems.length) {
                        const browseTitle = mediaType === 'movie' ? 'Browse by studio' : 'Browse by network';
                        const browseKind = mediaType === 'movie' ? 'studio' : 'network';
                        container.appendChild(self.buildCarouselSection(browseTitle, browseItems, mediaType, browseKind));
                    }
                    self.refreshScrollers(container);
                } catch (err) {
                    console.warn('BetterSeerrTabs: carousel render failed', err);
                }
                finishLoading();
            }).catch(function (err) {
                if (isStale()) {
                    return;
                }
                console.error('BetterSeerrTabs:', err);
                container.dataset.betterseerrLoading = 'false';
                container.dataset.betterseerrLoaded = 'true';
                container.innerHTML = '<div class="betterseerr-empty-row">Failed to load discovery rows. Check Jellyseerr settings and that your Jellyfin user is linked in Jellyseerr.</div>';
            });
        },

        fetchDiscover: function (path, query) {
            let url = ApiClient.getUrl('BetterSeerrTabs/' + path);
            if (query) {
                url += query;
            }
            return ApiClient.ajax({
                url: url,
                type: 'GET',
                dataType: 'json'
            }).then(function (data) {
                const items = data && (data.Items || data.items || data.Results || data.results);
                const total = data && (data.TotalRecordCount ?? data.totalRecordCount ?? 0);
                return {
                    items: Array.isArray(items) ? items : [],
                    total: total
                };
            });
        },

        fetchJson: function (path) {
            return ApiClient.ajax({
                url: ApiClient.getUrl('BetterSeerrTabs/' + path),
                type: 'GET',
                dataType: 'json'
            });
        },

        loadDisplaySettings: function () {
            const self = this;
            return ApiClient.ajax({
                url: ApiClient.getUrl('BetterSeerrTabs/display-settings') + '?_=' + Date.now(),
                type: 'GET',
                dataType: 'json',
                cache: false
            }).then(function (data) {
                self._displaySettings = {
                    StreamingServiceUseImages: self.readConfigBool(
                        data,
                        'StreamingServiceUseImages',
                        'streamingServiceUseImages',
                        true
                    ),
                    StudioNetworkUseImages: self.readConfigBool(
                        data,
                        'StudioNetworkUseImages',
                        'studioNetworkUseImages',
                        true
                    ),
                    GenreUseBackdrops: self.readConfigBool(
                        data,
                        'GenreUseBackdrops',
                        'genreUseBackdrops',
                        true
                    ),
                    DiscoverUsePosters: self.readConfigBool(
                        data,
                        'DiscoverUsePosters',
                        'discoverUsePosters',
                        true
                    )
                };
                return self._displaySettings;
            }).catch(function () {
                self._displaySettings = {
                    StreamingServiceUseImages: true,
                    StudioNetworkUseImages: true,
                    GenreUseBackdrops: true,
                    DiscoverUsePosters: true
                };
                return self._displaySettings;
            });
        },

        shouldUseBackdropThumbnails: function () {
            return (this._displaySettings || {}).DiscoverUsePosters === false;
        },

        resolveImageUrl: function (url) {
            if (!url) {
                return '';
            }
            if (url.startsWith('http')) {
                return url;
            }
            return window.ApiClient.getUrl(url);
        },

        invalidateDisplaySettings: function () {
            this._displaySettings = null;
            document.querySelectorAll('.betterseerr-movies-sections, .betterseerr-tv-sections').forEach(function (section) {
                delete section.dataset.betterseerrDisplaySettings;
            });
            this.scheduleRender();
        },

        readConfigBool: function (data, pascalKey, camelKey, defaultValue) {
            if (!data) {
                return defaultValue;
            }

            const value = data[pascalKey] ?? data[camelKey];
            if (value === true || value === false) {
                return value;
            }

            return defaultValue;
        },

        shouldShowLogo: function (kind) {
            const settings = this._displaySettings || {};
            if (kind === 'provider') {
                return settings.StreamingServiceUseImages !== false;
            }
            if (kind === 'studio' || kind === 'network') {
                return settings.StudioNetworkUseImages !== false;
            }
            return false;
        },

        buildPosterRow: function (title, items, path) {
            const section = document.createElement('div');
            section.className = 'verticalSection betterseerr-poster-section';

            const titleContainer = document.createElement('div');
            titleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
            const h2 = document.createElement('h2');
            h2.className = 'sectionTitle sectionTitle-cards';
            h2.textContent = title;
            titleContainer.appendChild(h2);

            if (path && items && items.length > 0) {
                const viewMore = document.createElement('button');
                viewMore.type = 'button';
                viewMore.className = 'betterseerr-view-more';
                viewMore.textContent = 'View more \u2192';
                viewMore.setAttribute('data-path', path);
                viewMore.setAttribute('data-title', title);
                titleContainer.appendChild(viewMore);
            }

            section.appendChild(titleContainer);

            const scroller = document.createElement('div');
            scroller.setAttribute('is', 'emby-scroller');
            scroller.className = 'padded-top-focusscale padded-bottom-focusscale emby-scroller';
            scroller.setAttribute('data-centerfocus', 'true');

            const itemsContainer = document.createElement('div');
            itemsContainer.setAttribute('is', 'emby-itemscontainer');
            itemsContainer.className = 'itemsContainer scrollSlider focuscontainer-x';

            if (!items || items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'betterseerr-empty-row padded-left';
                empty.textContent = 'No items to show';
                section.appendChild(empty);
                return section;
            }

            itemsContainer.innerHTML = this.createDiscoverCards(items);
            scroller.appendChild(itemsContainer);
            section.appendChild(scroller);
            if (this.shouldUseBackdropThumbnails()) {
                this.hydrateDiscoverBackdropCards(itemsContainer);
            } else {
                this.initLazyImages(itemsContainer);
            }
            return section;
        },

        buildCarouselSection: function (title, items, mediaType, kind) {
            const section = document.createElement('div');
            section.className = 'verticalSection betterseerr-carousel-section';

            const titleContainer = document.createElement('div');
            titleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
            const h2 = document.createElement('h2');
            h2.className = 'sectionTitle sectionTitle-cards';
            h2.textContent = title;
            titleContainer.appendChild(h2);
            section.appendChild(titleContainer);

            const scroller = document.createElement('div');
            scroller.setAttribute('is', 'emby-scroller');
            scroller.className = 'padded-top-focusscale padded-bottom-focusscale emby-scroller';
            scroller.setAttribute('data-centerfocus', 'true');

            const itemsContainer = document.createElement('div');
            itemsContainer.setAttribute('is', 'emby-itemscontainer');
            itemsContainer.className = 'itemsContainer scrollSlider focuscontainer-x';

            let html = '';
            const self = this;
            (items || []).forEach(function (item) {
                html += self.createBoxCard(item, mediaType, kind);
            });

            if (!html) {
                const empty = document.createElement('div');
                empty.className = 'betterseerr-empty-row padded-left';
                empty.textContent = 'No items to show';
                section.appendChild(empty);
                return section;
            }

            itemsContainer.innerHTML = html;
            scroller.appendChild(itemsContainer);
            section.appendChild(scroller);
            return section;
        },

        createBoxCard: function (item, mediaType, kind) {
            const id = item.id;
            const name = item.name || 'Unknown';
            const safeName = this.escapeHtml(name);
            const showLogo = this.shouldShowLogo(kind);
            const logoUrl = showLogo ? this.buildBrowseLogoUrl(item.logo || item.logoPath) : null;
            let content = '';

            if (kind === 'genre' && (this._displaySettings || {}).GenreUseBackdrops !== false) {
                const backdrops = item.backdrops || [];
                if (backdrops.length) {
                    const backdropPath = backdrops[Math.floor(Math.random() * backdrops.length)];
                    const backdropUrl = this.buildBrowseBackdropUrl(backdropPath);
                    if (backdropUrl) {
                        content += '<span class="betterseerr-box-backdrop" style="background-image: url(\'' + backdropUrl + '\')"></span>';
                    }
                }
            }

            if (logoUrl) {
                const logoClass = item.weirdSize ? 'betterseerr-box-logo-weird' : 'betterseerr-box-logo';
                content += '<img class="' + logoClass + '" src="' + this.escapeHtml(logoUrl) + '" alt="' + safeName + '" loading="lazy" />';
            } else {
                content += '<span class="betterseerr-box-label">' + safeName + '</span>';
            }

            return '<button type="button" class="betterseerr-box-card" data-kind="' + kind + '" data-media-type="' + mediaType + '" data-id="' + id + '" data-name="' + safeName + '">' +
                content +
                '</button>';
        },

        buildBrowseBackdropUrl: function (backdropPath) {
            if (!backdropPath) {
                return null;
            }

            const path = backdropPath.startsWith('/') ? backdropPath : '/' + backdropPath;
            return 'https://image.tmdb.org/t/p/w780' + path;
        },

        buildBrowseLogoUrl: function (logoPath) {
            if (!logoPath || logoPath === 'not found') {
                return null;
            }

            const path = logoPath.startsWith('/') ? logoPath : '/' + logoPath;
            return 'https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,969696)' + path;
        },

        buildBrowseGridPath: function (kind, mediaType, id) {
            const prefix = mediaType === 'tv' ? 'discover/tv' : 'discover/movies';
            if (kind === 'genre') {
                return prefix + '/genre/' + id;
            }
            if (kind === 'provider') {
                return prefix + '/provider/' + id;
            }
            if (kind === 'studio') {
                return 'discover/movies/studio/' + id;
            }
            if (kind === 'network') {
                return 'discover/tv/network/' + id;
            }
            return null;
        },

        createDiscoverCards: function (items, forGrid) {
            if (this.shouldUseBackdropThumbnails()) {
                return this.createDiscoverBackdropCards(items, forGrid);
            }
            return this.createDiscoverPosterCards(items, forGrid);
        },

        buildDiscoverYearText: function (item, safeName) {
            const self = this;
            const date = new Date(self.getField(item, 'PremiereDate', 'premiereDate', 'releaseDate', 'firstAirDate') || '');
            const year = Number.isNaN(date.getFullYear()) ? '' : date.getFullYear();
            const rating = Number(self.getField(item, 'CommunityRating', 'communityRating') || 0);
            let yearText = '';
            if (rating) {
                yearText += '<span class="material-icons" style="font-size:14px;vertical-align:middle;color:#FFD700;">star</span> ' + rating.toFixed(1) + ' • ';
            } else {
                yearText += '<span class="material-icons" style="font-size:14px;vertical-align:middle;color:#FFD700;">star</span> - • ';
            }
            yearText += year;
            return { year: year, yearText: yearText };
        },

        createDiscoverPosterCards: function (items, forGrid) {
            let html = '';
            const self = this;
            const cardType = forGrid ? 'portraitCard' : 'overflowPortraitCard';
            const padderType = forGrid ? 'cardPadder-portrait' : 'cardPadder-overflowPortrait';

            items.forEach(function (item) {
                const mediaId = self.getProviderId(item, 'Tmdb') ||
                    self.getProviderId(item, 'Jellyseerr') ||
                    self.getField(item, 'id', 'Id');
                const mediaType = self.getField(item, 'SourceType', 'sourceType', 'mediaType', 'MediaType');
                let posterUrl = self.getProviderId(item, 'JellyseerrPoster');
                const safeName = self.escapeHtml(self.getField(item, 'Name', 'name', 'OriginalTitle', 'originalTitle') || 'Unknown');
                if (!mediaId || !mediaType) {
                    return;
                }

                if (posterUrl && !posterUrl.startsWith('http')) {
                    posterUrl = window.ApiClient.getUrl(posterUrl);
                }

                const safeUrl = self.escapeHtml(posterUrl || '');
                const imageAttrs = posterUrl
                    ? ' data-src="' + safeUrl + '"'
                    : '';

                html += '<div class="card ' + cardType + ' betterseerr-discover-card" data-tmdb-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                html += '   <div class="cardBox cardBox-bottompadded">';
                html += '       <div class="cardScalable">';
                html += '           <div class="cardPadder ' + padderType + ' lazy-hidden-children"></div>';
                html += '           <div class="cardImageContainer coveredImage cardContent lazy lazy-hidden"' + imageAttrs + ' aria-label="' + safeName + '"></div>';
                html += '           <div class="cardOverlayContainer">';
                html += '               <div class="cardImageContainer"></div>';
                html += '               <div class="cardOverlayButton-br flex">';
                html += '                   <button is="discover-requestbutton" type="button" class="discover-requestbutton cardOverlayButton cardOverlayButton-hover paper-icon-button-light emby-button" data-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                html += '                       <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover add" aria-hidden="true"></span>';
                html += '                   </button>';
                html += '               </div>';
                html += '           </div>';
                html += '       </div>';
                html += '       <div class="cardText cardTextCentered cardText-first"><bdi><span title="' + safeName + '">' + safeName + '</span></bdi></div>';

                const meta = self.buildDiscoverYearText(item, safeName);
                html += '       <div class="cardText cardTextCentered cardText-secondary"><bdi><span title="' + meta.year + '">' + meta.yearText + '</span></bdi></div>';
                html += '   </div>';
                html += '</div>';
            }, this);

            return html;
        },

        createDiscoverBackdropCards: function (items, forGrid) {
            let html = '';
            const self = this;
            const gridClass = forGrid ? ' betterseerr-discover-card--grid' : '';

            items.forEach(function (item) {
                const mediaId = self.getProviderId(item, 'Tmdb') ||
                    self.getProviderId(item, 'Jellyseerr') ||
                    self.getField(item, 'id', 'Id');
                const mediaType = self.getField(item, 'SourceType', 'sourceType', 'mediaType', 'MediaType');
                const safeName = self.escapeHtml(self.getField(item, 'Name', 'name', 'OriginalTitle', 'originalTitle') || 'Unknown');
                if (!mediaId || !mediaType) {
                    return;
                }

                let fallbackUrl = self.getProviderId(item, 'JellyseerrBackdrop');
                fallbackUrl = self.resolveImageUrl(fallbackUrl);
                const safeFallback = self.escapeHtml(fallbackUrl || '');
                const fallbackAttr = safeFallback ? ' data-fallback-src="' + safeFallback + '"' : '';

                html += '<div class="card betterseerr-discover-card betterseerr-discover-card--backdrop' + gridClass + '" data-tmdb-id="' + mediaId + '" data-media-type="' + mediaType + '"' + fallbackAttr + '>';
                html += '   <div class="cardBox cardBox-bottompadded">';
                html += '       <div class="cardScalable betterseerr-discover-backdrop-scalable">';
                html += '           <div class="cardPadder betterseerr-discover-backdrop-padder"></div>';
                html += '           <div class="cardImageContainer coveredImage cardContent betterseerr-discover-backdrop-image" aria-label="' + safeName + '">';
                html += '               <span class="betterseerr-discover-backdrop-media"></span>';
                html += '               <span class="betterseerr-discover-overlay-title betterseerr-box-label">' + safeName + '</span>';
                html += '           </div>';
                html += '           <div class="cardOverlayContainer">';
                html += '               <div class="cardImageContainer"></div>';
                html += '               <div class="cardOverlayButton-br flex">';
                html += '                   <button is="discover-requestbutton" type="button" class="discover-requestbutton cardOverlayButton cardOverlayButton-hover paper-icon-button-light emby-button" data-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                html += '                       <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover add" aria-hidden="true"></span>';
                html += '                   </button>';
                html += '               </div>';
                html += '           </div>';
                html += '       </div>';
                html += '       <div class="cardText cardTextCentered cardText-first betterseerr-discover-title-below"><bdi><span title="' + safeName + '">' + safeName + '</span></bdi></div>';
                const meta = self.buildDiscoverYearText(item, safeName);
                html += '       <div class="cardText cardTextCentered cardText-secondary"><bdi><span title="' + meta.year + '">' + meta.yearText + '</span></bdi></div>';
                html += '   </div>';
                html += '</div>';
            }, this);

            return html;
        },

        setDiscoverBackdropImage: function (card, url) {
            if (!card || !url) {
                return;
            }

            const media = card.querySelector('.betterseerr-discover-backdrop-media');
            if (!media) {
                return;
            }

            media.style.backgroundImage = "url('" + url.replace(/'/g, "\\'") + "')";
        },

        setDiscoverBackdropPresentation: function (card, mode) {
            if (!card) {
                return;
            }

            card.classList.remove(
                'betterseerr-discover-card--english',
                'betterseerr-discover-card--fallback'
            );

            if (mode === 'english') {
                card.classList.add('betterseerr-discover-card--english');
                return;
            }

            if (mode === 'fallback') {
                card.classList.add('betterseerr-discover-card--fallback');
            }
        },

        ensureTmdbApiKey: function () {
            const self = this;
            if (self._tmdbApiKey !== undefined) {
                return Promise.resolve(self._tmdbApiKey);
            }

            if (!self._tmdbApiKeyPromise) {
                self._tmdbApiKeyPromise = self.fetchJson('client-settings').then(function (data) {
                    const key = (data && (data.tmdbApiKey || data.TmdbApiKey)) || '';
                    self._tmdbApiKey = String(key).trim();
                    return self._tmdbApiKey;
                }).catch(function () {
                    self._tmdbApiKey = '';
                    return '';
                });
            }

            return self._tmdbApiKeyPromise;
        },

        fetchTmdbBackdropUrl: function (mediaType, tmdbId) {
            const self = this;
            const cacheKey = mediaType + ':' + tmdbId;

            if (self._backdropInflight && self._backdropInflight[cacheKey]) {
                return self._backdropInflight[cacheKey];
            }

            if (!self._backdropInflight) {
                self._backdropInflight = {};
            }

            const promise = self.fetchJson('backdrop/' + encodeURIComponent(mediaType) + '/' + encodeURIComponent(tmdbId))
                .then(function (data) {
                    const url = data && (data.backdropUrl || data.BackdropUrl);
                    const hasEnglish = !!(data && (data.hasEnglishBackdrop || data.HasEnglishBackdrop));
                    return {
                        url: url ? self.resolveImageUrl(url) : '',
                        hasEnglishBackdrop: hasEnglish
                    };
                })
                .catch(function () {
                    return { url: '', hasEnglishBackdrop: false };
                })
                .finally(function () {
                    delete self._backdropInflight[cacheKey];
                });

            self._backdropInflight[cacheKey] = promise;
            return promise;
        },

        applyDiscoverBackdropResult: function (card, result, seerrFallbackUrl) {
            const self = this;
            const url = result && result.url;
            const hasEnglish = result && result.hasEnglishBackdrop;

            if (url && hasEnglish) {
                self.setDiscoverBackdropPresentation(card, 'english');
                self.setDiscoverBackdropImage(card, url);
                return;
            }

            const fallbackUrl = url || seerrFallbackUrl;
            if (fallbackUrl) {
                self.setDiscoverBackdropPresentation(card, 'fallback');
                self.setDiscoverBackdropImage(card, fallbackUrl);
            }
        },

        hydrateDiscoverBackdropCard: function (card) {
            const self = this;
            if (!card || card.dataset.backdropLoaded === 'true') {
                return Promise.resolve();
            }

            const seerrFallback = card.getAttribute('data-fallback-src') || '';
            const mediaId = card.dataset.tmdbId;
            const mediaType = card.dataset.mediaType;

            return self.ensureTmdbApiKey().then(function (apiKey) {
                if (!apiKey) {
                    self.applyDiscoverBackdropResult(card, null, seerrFallback);
                    card.dataset.backdropLoaded = 'true';
                    return;
                }

                if (!mediaId || !mediaType) {
                    self.applyDiscoverBackdropResult(card, null, seerrFallback);
                    card.dataset.backdropLoaded = 'true';
                    return;
                }

                return self.fetchTmdbBackdropUrl(mediaType, mediaId).then(function (result) {
                    self.applyDiscoverBackdropResult(card, result, seerrFallback);
                    card.dataset.backdropLoaded = 'true';
                });
            });
        },

        hydrateDiscoverBackdropCards: function (container) {
            const self = this;
            if (!container) {
                return;
            }

            const cards = container.querySelectorAll('.betterseerr-discover-card--backdrop:not([data-backdrop-hydrate-queued]):not([data-backdrop-loaded])');
            if (!cards.length) {
                return;
            }

            if (!self._backdropHydrateQueue) {
                self._backdropHydrateQueue = [];
                self._backdropHydrateActive = 0;
            }

            cards.forEach(function (card) {
                card.dataset.backdropHydrateQueued = 'true';
                self._backdropHydrateQueue.push(card);
            });

            self.pumpBackdropHydrateQueue();
        },

        pumpBackdropHydrateQueue: function () {
            const self = this;
            const maxConcurrent = 4;

            while (self._backdropHydrateActive < maxConcurrent && self._backdropHydrateQueue.length) {
                const card = self._backdropHydrateQueue.shift();
                self._backdropHydrateActive++;
                self.hydrateDiscoverBackdropCard(card).finally(function () {
                    self._backdropHydrateActive--;
                    self.pumpBackdropHydrateQueue();
                });
            }
        },

        bindRequestHandler: function () {
            // Capturing runs before card navigation handlers
            document.addEventListener('click', function (e) {
                const btn = e.target.closest('.discover-requestbutton');
                if (!btn || !btn.closest('.betterseerr-movies-sections, .betterseerr-tv-sections, .betterseerr-grid-view')) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const mediaId = btn.getAttribute('data-id');
                const mediaType = btn.getAttribute('data-media-type');
                if (window.betterSeerrModal && window.betterSeerrModal.openQualityPicker) {
                    window.betterSeerrModal.openQualityPicker(mediaId, mediaType);
                }
            }, true);
        },

        bindCardClickHandler: function () {
            // Capturing so card opens our modal instead of jellyfin detail page
            document.addEventListener('click', function (e) {
                if (e.target.closest('.discover-requestbutton')) {
                    return;
                }

                const card = e.target.closest('.betterseerr-discover-card');
                if (!card || !card.closest('.betterseerr-movies-sections, .betterseerr-tv-sections, .betterseerr-grid-view')) {
                    return;
                }

                const mediaId = card.dataset.tmdbId;
                const mediaType = card.dataset.mediaType;
                if (!mediaId || !mediaType) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                if (window.betterSeerrModal && window.betterSeerrModal.open) {
                    window.betterSeerrModal.open(mediaId, mediaType);
                }
            }, true);
        },

        bindViewMoreHandler: function () {
            const self = this;

            document.addEventListener('contextmenu', function (e) {
                if (e.target.closest('.betterseerr-grid-view')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            document.addEventListener('click', function (e) {
                const btn = e.target.closest('.betterseerr-view-more');
                if (btn) {
                    const container = btn.closest('.betterseerr-movies-sections, .betterseerr-tv-sections');
                    if (!container) {
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();

                    const path = btn.getAttribute('data-path');
                    const title = btn.getAttribute('data-title');
                    if (path && title) {
                        self.openGridView(container, title, path);
                    }
                    return;
                }

                const boxCard = e.target.closest('.betterseerr-box-card');
                if (!boxCard) {
                    return;
                }

                const boxContainer = boxCard.closest('.betterseerr-movies-sections, .betterseerr-tv-sections');
                if (!boxContainer) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                const kind = boxCard.getAttribute('data-kind');
                const mediaType = boxCard.getAttribute('data-media-type');
                const id = boxCard.getAttribute('data-id');
                const name = boxCard.getAttribute('data-name');
                const browsePath = self.buildBrowseGridPath(kind, mediaType, id);
                if (browsePath && name) {
                    self.openGridView(boxContainer, name, browsePath);
                }
            });
        },

        clearJellyfinSelection: function () {
            const closeBtn = document.querySelector('.btnCloseSelectionPanel');
            if (closeBtn) {
                closeBtn.click();
                return;
            }

            document.querySelectorAll('.itemSelectionPanel').forEach(function (panel) {
                const parent = panel.parentNode;
                if (parent) {
                    parent.removeChild(panel);
                    parent.classList.remove('withMultiSelect');
                }
            });

            document.querySelectorAll('.selectionCommandsPanel').forEach(function (panel) {
                if (panel.parentNode) {
                    panel.parentNode.removeChild(panel);
                }
            });
        },

        openGridView: function (container, title, path) {
            const self = this;
            self.clearJellyfinSelection();

            Array.from(container.children).forEach(function (child) {
                if (!child.classList.contains('betterseerr-grid-view')) {
                    child.style.display = 'none';
                    child.dataset.betterseerrHidden = 'true';
                }
            });

            let gridView = container.querySelector('.betterseerr-grid-view');
            if (!gridView) {
                gridView = document.createElement('div');
                gridView.className = 'betterseerr-grid-view';

                const header = document.createElement('div');
                header.className = 'betterseerr-grid-header padded-left padded-right';

                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'betterseerr-grid-back paper-icon-button-light emby-button';
                backBtn.innerHTML = '<span class="material-icons" aria-hidden="true">arrow_back</span>';
                backBtn.addEventListener('click', function () {
                    self.closeGridView(container);
                });

                const heading = document.createElement('h2');
                heading.className = 'betterseerr-grid-title sectionTitle sectionTitle-cards';

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'itemsContainer vertical-wrap padded-left padded-right';

                const loadMore = document.createElement('div');
                loadMore.className = 'betterseerr-grid-loadmore';
                loadMore.style.display = 'none';

                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.type = 'button';
                loadMoreBtn.className = 'raised emby-button';
                loadMoreBtn.textContent = 'Load more';
                loadMore.appendChild(loadMoreBtn);

                const status = document.createElement('div');
                status.className = 'betterseerr-grid-status';
                status.style.display = 'none';

                header.appendChild(backBtn);
                header.appendChild(heading);
                gridView.appendChild(header);
                gridView.appendChild(itemsContainer);
                gridView.appendChild(loadMore);
                gridView.appendChild(status);
                container.appendChild(gridView);

                loadMoreBtn.addEventListener('click', function () {
                    self.loadMoreGridItems(gridView);
                });
            }

            gridView.dataset.path = path;
            gridView.dataset.loadedCount = '0';
            gridView.querySelector('.betterseerr-grid-title').textContent = title;
            gridView.querySelector('.itemsContainer').innerHTML = '';
            gridView.querySelector('.betterseerr-grid-loadmore').style.display = 'none';
            gridView.querySelector('.betterseerr-grid-status').style.display = 'none';
            gridView.style.display = '';

            self.loadMoreGridItems(gridView, true);
        },

        closeGridView: function (container) {
            this.clearJellyfinSelection();

            const gridView = container.querySelector('.betterseerr-grid-view');
            if (gridView) {
                gridView.style.display = 'none';
            }

            Array.from(container.children).forEach(function (child) {
                if (child.dataset.betterseerrHidden === 'true') {
                    child.style.display = '';
                    delete child.dataset.betterseerrHidden;
                }
            });
        },

        loadMoreGridItems: function (gridView, isInitial) {
            const self = this;
            const path = gridView.dataset.path;
            const itemsContainer = gridView.querySelector('.itemsContainer');
            const loadMore = gridView.querySelector('.betterseerr-grid-loadmore');
            const loadMoreBtn = loadMore.querySelector('button');
            const status = gridView.querySelector('.betterseerr-grid-status');
            const loadedCount = parseInt(gridView.dataset.loadedCount || '0', 10);
            const pageSize = self._gridPageSize;

            if (gridView.dataset.loading === 'true') {
                return;
            }

            gridView.dataset.loading = 'true';
            if (isInitial) {
                status.textContent = 'Loading...';
                status.style.display = '';
            } else {
                loadMoreBtn.textContent = 'Loading...';
                loadMoreBtn.disabled = true;
            }

            self.fetchDiscover(path, '?startIndex=' + encodeURIComponent(loadedCount) + '&limit=' + encodeURIComponent(pageSize)).then(function (result) {
                gridView.dataset.loading = 'false';
                status.style.display = 'none';

                if (!result.items.length && loadedCount === 0) {
                    itemsContainer.innerHTML = '<div class="betterseerr-empty-row">No items to show</div>';
                    loadMore.style.display = 'none';
                    return;
                }

                itemsContainer.insertAdjacentHTML('beforeend', self.createDiscoverCards(result.items, true));
                if (self.shouldUseBackdropThumbnails()) {
                    self.hydrateDiscoverBackdropCards(itemsContainer);
                } else {
                    self.initLazyImages(itemsContainer);
                }
                const newCount = loadedCount + result.items.length;
                gridView.dataset.loadedCount = String(newCount);

                const hasMore = result.items.length === pageSize &&
                    (result.total === 0 || newCount < result.total);
                loadMore.style.display = hasMore ? '' : 'none';
                loadMoreBtn.textContent = 'Load more';
                loadMoreBtn.disabled = false;
            }).catch(function (err) {
                gridView.dataset.loading = 'false';
                status.style.display = 'none';
                loadMoreBtn.textContent = 'Load more';
                loadMoreBtn.disabled = false;
                console.error('BetterSeerrTabs grid load failed:', err);
                if (loadedCount === 0) {
                    itemsContainer.innerHTML = '<div class="betterseerr-empty-row">Failed to load items.</div>';
                }
            });
        },

        refreshScrollers: function (container) {
            const scrollers = container.querySelectorAll('[is="emby-scroller"]');
            scrollers.forEach(function (scroller) {
                if (scroller.enableMouseWheelScroll) {
                    scroller.enableMouseWheelScroll();
                }
            });
        },

        initLazyImages: function (container) {
            if (!container) {
                return;
            }

            const self = this;
            const images = container.querySelectorAll('.cardImageContainer.lazy[data-src]');

            if (!images.length) {
                return;
            }

            if (!self._lazyObserver) {
                self._lazyObserver = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (!entry.isIntersecting) {
                            return;
                        }
                        self.loadLazyImage(entry.target);
                        self._lazyObserver.unobserve(entry.target);
                    });
                }, { rootMargin: '200px 0px' });
            }

            images.forEach(function (img) {
                if (img.dataset.bstLazyBound === 'true') {
                    return;
                }
                img.dataset.bstLazyBound = 'true';
                self._lazyObserver.observe(img);
            });
        },

        loadLazyImage: function (elem) {
            const url = elem.getAttribute('data-src');
            if (!url) {
                return;
            }

            const preloader = new Image();
            preloader.src = url;

            preloader.onload = function () {
                requestAnimationFrame(function () {
                    elem.style.backgroundImage = "url('" + url.replace(/'/g, "\\'") + "')";
                    elem.removeAttribute('data-src');
                    elem.classList.add('lazy-image-fadein-fast');
                    elem.classList.remove('lazy-hidden');

                    elem.addEventListener('animationend', function onEnd() {
                        const padder = elem.parentNode && elem.parentNode.querySelector('.cardPadder');
                        if (padder) {
                            padder.classList.add('lazy-hidden-children');
                        }
                        elem.removeEventListener('animationend', onEnd);
                    });
                });
            };
        },

        getField: function (item) {
            for (let i = 1; i < arguments.length; i++) {
                const key = arguments[i];
                if (item && item[key] !== undefined && item[key] !== null) {
                    return item[key];
                }
            }
            return null;
        },

        getProviderId: function (item, key) {
            const providerIds = item && (item.ProviderIds || item.providerIds);
            if (!providerIds) {
                return null;
            }
            return providerIds[key] || providerIds[key.toLowerCase()] || null;
        },

        escapeHtml: function (text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }
    };

    function boot() {
        window.betterSeerrTabsPlugin.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('popstate', function () {
        setTimeout(boot, 800);
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && window.betterSeerrTabsPlugin) {
            setTimeout(function () {
                window.betterSeerrTabsPlugin.scheduleRender();
            }, 300);
        }
    });
}
