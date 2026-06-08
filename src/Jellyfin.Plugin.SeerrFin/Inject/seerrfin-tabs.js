'use strict';

if (typeof window.seerrFinPlugin === 'undefined') {
    window.seerrFinPlugin = {
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
        _carouselScrollThreshold: 1200,
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
                this.loadDisplaySettings();
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

        attachCustomTabGuard: function (tabs) {
            if (!tabs || tabs.dataset.bstCustomTabGuard === 'true') {
                return;
            }

            tabs.dataset.bstCustomTabGuard = 'true';
            const self = this;

            tabs.addEventListener('beforetabchange', function (event) {
                const index = parseInt(event.detail && event.detail.selectedTabIndex, 10);
                if (isNaN(index) || index < 2) {
                    return;
                }

                setTimeout(function () {
                    self.onCustomTabShown();
                }, 0);
            }, true);

            // Jellyfin HomeView only defines controllers for 0/1 while Custom Tabs use data-index >= 2. It throws error for anything else unless we stop that handler.
            tabs.addEventListener('tabchange', function (event) {
                const index = parseInt(event.detail && event.detail.selectedTabIndex, 10);
                if (isNaN(index) || index < 2) {
                    return;
                }

                event.stopImmediatePropagation();
            }, true);
        },

        onCustomTabShown: function () {
            const self = this;
            setTimeout(function () {
                self.scheduleRender();
                if (typeof window.__seerrFinRequestsEnsureMounted === 'function') {
                    window.__seerrFinRequestsEnsureMounted();
                }
                if (typeof window.__seerrFinLetterboxdEnsureMounted === 'function') {
                    window.__seerrFinLetterboxdEnsureMounted();
                }
            }, 0);
        },

        setupCustomTabWatchers: function () {
            const self = this;

            document.addEventListener('viewbeforeshow', function (event) {
                if (!event.target || event.target.id !== 'indexPage') {
                    return;
                }

                self.attachCustomTabGuard(document.querySelector('.tabs-viewmenubar [is="emby-tabs"]'));
            }, true);

            document.addEventListener('viewshow', function () {
                self.scheduleRender();
            });

            document.addEventListener('click', function (e) {
                if (e.target.closest('.emby-tab-button')) {
                    setTimeout(function () {
                        self.onCustomTabShown();
                    }, 150);
                }
            });

            self.attachCustomTabGuard(document.querySelector('.tabs-viewmenubar [is="emby-tabs"]'));
            self.scheduleRender();
        },

        isContainerLoading: function (container) {
            return container.dataset.seerrfinLoading === 'true';
        },

        isContainerPopulated: function (container) {
            return container.querySelector('.seerrfin-poster-section') !== null;
        },

        renderIfContainerVisible: function (type) {
            const selector = type === 'movies' ? '.seerrfin-movies-sections' : '.seerrfin-tv-sections';
            const container = this.findActiveContainer(selector);
            if (!container) {
                return;
            }

            if (this.isContainerLoading(container)) {
                return;
            }

            const self = this;
            this.loadDisplaySettings().then(function () {
                const settingsKey = self.getDisplaySettingsKey();

                if (container.dataset.seerrfinDisplaySettings !== settingsKey) {
                    container.dataset.seerrfinDisplaySettings = settingsKey;
                    if (self.isContainerPopulated(container)) {
                        container.innerHTML = '';
                        delete container.dataset.seerrfinLoaded;
                        delete container.dataset.seerrfinLoading;
                    }
                }

                if (self.isContainerPopulated(container)) {
                    return;
                }

                const hasError = container.querySelector('.seerrfin-empty-row');
                if (hasError && container.dataset.seerrfinLoaded === 'true') {
                    return;
                }

                self.loadTab(type, container);
            });
        },

        loadTab: function (type, container) {
            if (!container) {
                container = this.findActiveContainer(
                    type === 'movies' ? '.seerrfin-movies-sections' : '.seerrfin-tv-sections'
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

            container.dataset.seerrfinLoading = 'true';
            container.dataset.seerrfinLoadId = loadId;
            delete container.dataset.seerrfinLoaded;
            container.innerHTML = '<div class="seerrfin-loading-row">Loading...</div>';

            // Ignore results if user switched tabs or theres a newer load. Going back through chrome back button is still broken though
            const finishLoading = function () {
                if (container.dataset.seerrfinLoadId !== loadId) {
                    return;
                }
                container.dataset.seerrfinLoading = 'false';
                container.dataset.seerrfinLoaded = 'true';
            };

            const isStale = function () {
                return container.dataset.seerrfinLoadId !== loadId || !self.isContainerVisible(container);
            };

            Promise.allSettled([
                self.loadDisplaySettings(),
                ...rows.map(function (row) {
                    return self.fetchDiscover(row.path).then(function (result) {
                        return { row: row, items: result.items, total: result.total };
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
                        console.warn('SeerrFin: row failed', rows[index].path, result.reason);
                    }
                });

                if (!loadedRows.length) {
                    throw new Error('All discovery rows failed');
                }

                container.innerHTML = '';
                loadedRows.forEach(function (result) {
                    try {
                        container.appendChild(self.buildPosterRow(result.row.title, result.items, result.row.path, {
                            total: result.total
                        }));
                    } catch (err) {
                        console.warn('SeerrFin: row render failed', result.row.title, err);
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
                        console.warn('SeerrFin: genre carousel failed', carouselResults[0].reason);
                    }
                    if (carouselResults[1].status === 'rejected') {
                        console.warn('SeerrFin: provider carousel failed', carouselResults[1].reason);
                    }
                    if (carouselResults[2].status === 'rejected') {
                        console.warn('SeerrFin: browse carousel failed', carouselResults[2].reason);
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
                    console.warn('SeerrFin: carousel render failed', err);
                }
                finishLoading();
            }).catch(function (err) {
                if (isStale()) {
                    return;
                }
                console.error('SeerrFin:', err);
                container.dataset.seerrfinLoading = 'false';
                container.dataset.seerrfinLoaded = 'true';
                container.innerHTML = '<div class="seerrfin-empty-row">Failed to load discovery rows. Check Jellyseerr settings and that your Jellyfin user is linked in Jellyseerr.</div>';
            });
        },

        fetchDiscover: function (path, query) {
            let url = ApiClient.getUrl('SeerrFin/' + path);
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
                url: ApiClient.getUrl('SeerrFin/' + path),
                type: 'GET',
                dataType: 'json'
            });
        },

        loadDisplaySettings: function () {
            const self = this;
            return ApiClient.ajax({
                url: ApiClient.getUrl('SeerrFin/display-settings') + '?_=' + Date.now(),
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
                    ),
                    ElegantFinFixes: self.readConfigBool(
                        data,
                        'ElegantFinFixes',
                        'elegantFinFixes',
                        false
                    ),
                    QualityRecommendations: self.readConfigBool(
                        data,
                        'QualityRecommendations',
                        'qualityRecommendations',
                        true
                    ),
                    DisplayCustomizations: self.parseDisplayCustomizations(data)
                };
                self.syncElegantFinFixes();
                return self._displaySettings;
            }).catch(function () {
                self._displaySettings = {
                    StreamingServiceUseImages: true,
                    StudioNetworkUseImages: true,
                    GenreUseBackdrops: true,
                    DiscoverUsePosters: true,
                    ElegantFinFixes: false,
                    QualityRecommendations: true,
                    DisplayCustomizations: self.parseDisplayCustomizations(null)
                };
                self.syncElegantFinFixes();
                return self._displaySettings;
            });
        },

        parseDisplayCustomizations: function (data) {
            const root = (data && (data.DisplayCustomizations || data.displayCustomizations)) || {};
            return {
                StreamingService: root.StreamingService || root.streamingService || {},
                StudioNetwork: root.StudioNetwork || root.studioNetwork || {},
                GenreBackdrop: root.GenreBackdrop || root.genreBackdrop || {},
                DiscoverBackdrop: root.DiscoverBackdrop || root.discoverBackdrop || {}
            };
        },

        getDisplaySettingsKey: function () {
            const settings = this._displaySettings || {};
            return [
                settings.StreamingServiceUseImages,
                settings.StudioNetworkUseImages,
                settings.GenreUseBackdrops,
                settings.DiscoverUsePosters,
                settings.ElegantFinFixes,
                JSON.stringify(settings.DisplayCustomizations || {})
            ].join(':');
        },

        syncElegantFinFixes: function () {
            const enabled = (this._displaySettings || {}).ElegantFinFixes === true;
            document.documentElement.classList.toggle('seerrfin-elegantfin', enabled);
        },

        normalizeHexColor: function (value, fallback) {
            const raw = String(value || fallback || '').replace('#', '').trim();
            if (/^[0-9a-fA-F]{6}$/.test(raw)) {
                return raw.toLowerCase();
            }

            return String(fallback || 'ffffff').replace('#', '').toLowerCase();
        },

        getDisplayStyle: function (styleKey) {
            const settings = this._displaySettings || {};
            const customizations = settings.DisplayCustomizations || {};
            const configKeyMap = {
                streamingService: 'StreamingService',
                studioNetwork: 'StudioNetwork',
                genreBackdrop: 'GenreBackdrop',
                discoverBackdrop: 'DiscoverBackdrop'
            };
            const defaults = {
                streamingService: { duotoneEnabled: true, duotoneLight: 'ffffff', duotoneDark: '969696' },
                studioNetwork: { duotoneEnabled: true, duotoneLight: 'ffffff', duotoneDark: '969696' },
                genreBackdrop: { duotoneEnabled: false, duotoneLight: 'ffffff', duotoneDark: '969696' },
                discoverBackdrop: { duotoneEnabled: false, duotoneLight: 'ffffff', duotoneDark: '969696' }
            };
            const fallback = defaults[styleKey] || defaults.streamingService;
            const source = customizations[configKeyMap[styleKey]] || {};

            return {
                duotoneEnabled: this.readConfigBool(source, 'DuotoneEnabled', 'duotoneEnabled', fallback.duotoneEnabled),
                duotoneLight: this.normalizeHexColor(source.DuotoneLight ?? source.duotoneLight, fallback.duotoneLight),
                duotoneDark: this.normalizeHexColor(source.DuotoneDark ?? source.duotoneDark, fallback.duotoneDark)
            };
        },

        buildTmdbImageUrl: function (path, styleKey, size) {
            if (!path) {
                return null;
            }

            const pathNorm = path.startsWith('/') ? path : '/' + path;
            let sizePart = size || 'w780';

            if (styleKey) {
                const style = this.getDisplayStyle(styleKey);
                if (style.duotoneEnabled) {
                    sizePart += '_filter(duotone,' + style.duotoneDark + ',' + style.duotoneLight + ')';
                }
            }

            return 'https://image.tmdb.org/t/p/' + sizePart + pathNorm;
        },

        buildDiscoverPosterUrl: function (item) {
            const posterPath = this.getProviderId(item, 'TmdbPosterPath');
            if (this.getDisplayStyle('discoverBackdrop').duotoneEnabled && posterPath) {
                return this.buildTmdbImageUrl(posterPath, 'discoverBackdrop', 'w600_and_h900_bestv2');
            }

            let posterUrl = this.getProviderId(item, 'JellyseerrPoster');
            if (posterUrl && !posterUrl.startsWith('http')) {
                posterUrl = window.ApiClient.getUrl(posterUrl);
            }

            if (posterUrl) {
                return posterUrl;
            }

            if (posterPath) {
                return this.buildTmdbImageUrl(posterPath, null, 'w600_and_h900_bestv2');
            }

            return null;
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
            const self = this;
            this._displaySettings = null;
            document.querySelectorAll('.seerrfin-movies-sections, .seerrfin-tv-sections').forEach(function (section) {
                delete section.dataset.seerrfinDisplaySettings;
            });
            this.loadDisplaySettings().then(function () {
                self.scheduleRender();
            });
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

        buildPosterRow: function (title, items, path, options) {
            options = options || {};
            const section = document.createElement('div');
            section.className = 'verticalSection seerrfin-poster-section';

            const titleContainer = document.createElement('div');
            titleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
            const h2 = document.createElement('h2');
            h2.className = 'sectionTitle sectionTitle-cards';
            h2.textContent = title;
            titleContainer.appendChild(h2);

            if (path && items && items.length > 0) {
                const viewMore = document.createElement('button');
                viewMore.type = 'button';
                viewMore.className = 'seerrfin-view-more';
                viewMore.textContent = 'View more \u2192';
                viewMore.setAttribute('data-path', path);
                viewMore.setAttribute('data-title', title);
                titleContainer.appendChild(viewMore);
            }

            section.appendChild(titleContainer);

            const itemsContainer = document.createElement('div');
            itemsContainer.setAttribute('is', 'emby-itemscontainer');
            itemsContainer.className = 'itemsContainer scrollSlider focuscontainer-x';

            if (!items || items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'seerrfin-empty-row padded-left';
                empty.textContent = 'No items to show';
                section.appendChild(empty);
                return section;
            }

            if (path) {
                const total = parseInt(options.total || '0', 10);
                section.dataset.path = path;
                section.dataset.loadedCount = String(items.length);
                section.dataset.total = String(total);
                section.dataset.hasMore = String(total === 0 || items.length < total);
            }

            itemsContainer.innerHTML = this.createDiscoverCards(items);
            this.appendHorizontalScroller(section, itemsContainer, { focusScale: true, scrollEvent: true });
            if (this.shouldUseBackdropThumbnails()) {
                this.hydrateDiscoverBackdropCards(itemsContainer);
            } else {
                this.initLazyImages(itemsContainer);
            }
            return section;
        },

        bindRowInfiniteScroll: function (section) {
            if (section.dataset.seerrfinRowScrollBound === 'true') {
                return;
            }

            const scroller = section.querySelector('[is="emby-scroller"]');
            if (!scroller || !section.dataset.path) {
                return;
            }

            if (!scroller.scroller || typeof scroller.addScrollEventListener !== 'function') {
                const retries = parseInt(section.dataset.seerrfinRowScrollRetries || '0', 10);
                if (retries >= 10) {
                    return;
                }
                section.dataset.seerrfinRowScrollRetries = String(retries + 1);
                const self = this;
                requestAnimationFrame(function () {
                    self.bindRowInfiniteScroll(section);
                });
                return;
            }

            delete section.dataset.seerrfinRowScrollRetries;
            section.dataset.seerrfinRowScrollBound = 'true';
            section._seerrfinRowScroller = scroller;

            const self = this;
            scroller.addScrollEventListener(function () {
                self.scheduleRowScrollCheck(section);
            }, { passive: true });

            self.scheduleRowScrollCheck(section);
        },

        scheduleRowScrollCheck: function (section) {
            if (section._seerrfinRowScrollRaf) {
                return;
            }
            const self = this;
            section._seerrfinRowScrollRaf = requestAnimationFrame(function () {
                section._seerrfinRowScrollRaf = 0;
                self.checkRowScrollEnd(section);
            });
        },

        checkRowScrollEnd: function (section) {
            if (section.dataset.hasMore !== 'true' || section.dataset.loading === 'true') {
                return;
            }

            const scroller = section._seerrfinRowScroller;
            if (!scroller || typeof scroller.getScrollPosition !== 'function' || typeof scroller.getScrollSize !== 'function') {
                return;
            }

            const pos = scroller.getScrollPosition() || 0;
            const size = scroller.getScrollSize() || 0;
            const viewport = scroller.clientWidth || 0;
            const threshold = this._carouselScrollThreshold;
            const nearEnd = size <= viewport + threshold || pos + viewport >= size - threshold;

            if (nearEnd) {
                this.loadMorePosterRowItems(section);
            }
        },

        loadMorePosterRowItems: function (section) {
            const self = this;
            const path = section.dataset.path;
            const itemsContainer = section.querySelector('.itemsContainer');
            if (!path || !itemsContainer || section.dataset.hasMore !== 'true') {
                return;
            }

            if (section.dataset.loading === 'true') {
                return;
            }

            const loadedCount = parseInt(section.dataset.loadedCount || '0', 10);
            const pageSize = self._gridPageSize;
            section.dataset.loading = 'true';

            self.fetchDiscover(path, '?startIndex=' + encodeURIComponent(loadedCount) + '&limit=' + encodeURIComponent(pageSize)).then(function (result) {
                section.dataset.loading = 'false';

                if (!result.items.length) {
                    section.dataset.hasMore = 'false';
                    return;
                }

                const total = parseInt(result.total || section.dataset.total || '0', 10);
                if (total > 0) {
                    section.dataset.total = String(total);
                }

                const existingIds = new Set();
                itemsContainer.querySelectorAll('.seerrfin-discover-card[data-tmdb-id]').forEach(function (card) {
                    existingIds.add(card.getAttribute('data-tmdb-id'));
                });
                const newItems = result.items.filter(function (item) {
                    const id = String(self.getProviderId(item, 'Tmdb') ||
                        self.getProviderId(item, 'Jellyseerr') ||
                        self.getField(item, 'id', 'Id') || '');
                    return id && !existingIds.has(id) && existingIds.add(id);
                });

                if (newItems.length) {
                    itemsContainer.insertAdjacentHTML('beforeend', self.createDiscoverCards(newItems));
                    if (self.shouldUseBackdropThumbnails()) {
                        self.hydrateDiscoverBackdropCards(itemsContainer);
                    } else {
                        self.initLazyImages(itemsContainer);
                    }
                }

                const newCount = loadedCount + result.items.length;
                section.dataset.loadedCount = String(newCount);
                const hasMore = result.items.length === pageSize && (total === 0 || newCount < total);
                section.dataset.hasMore = String(hasMore);

                const scroller = section._seerrfinRowScroller;
                if (scroller && scroller.scroller && scroller.scroller.reload) {
                    scroller.scroller.reload();
                }
                self.scheduleRowScrollCheck(section);
            }).catch(function (err) {
                section.dataset.loading = 'false';
                console.error('SeerrFin row load failed:', err);
            });
        },

        appendHorizontalScroller: function (section, itemsContainer, options) {
            const settings = options || {};
            const scroller = document.createElement('div');
            scroller.setAttribute('is', 'emby-scroller');
            scroller.className = settings.focusScale
                ? 'padded-top-focusscale padded-bottom-focusscale emby-scroller'
                : 'emby-scroller';
            scroller.setAttribute('data-centerfocus', 'true');
            if (settings.scrollEvent) {
                scroller.setAttribute('data-scrollevent', 'true');
            }

            scroller.appendChild(itemsContainer);

            const scrollerWrap = document.createElement('div');
            scrollerWrap.className = 'seerrfin-scroller-wrap emby-scroller-container';
            scrollerWrap.appendChild(scroller);
            section.appendChild(scrollerWrap);
        },

        buildCarouselSection: function (title, items, mediaType, kind) {
            const section = document.createElement('div');
            section.className = 'verticalSection seerrfin-carousel-section';

            const titleContainer = document.createElement('div');
            titleContainer.className = 'sectionTitleContainer sectionTitleContainer-cards padded-left';
            const h2 = document.createElement('h2');
            h2.className = 'sectionTitle sectionTitle-cards';
            h2.textContent = title;
            titleContainer.appendChild(h2);
            section.appendChild(titleContainer);

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
                empty.className = 'seerrfin-empty-row padded-left';
                empty.textContent = 'No items to show';
                section.appendChild(empty);
                return section;
            }

            itemsContainer.innerHTML = html;
            this.appendHorizontalScroller(section, itemsContainer, { focusScale: false });
            return section;
        },

        createBoxCard: function (item, mediaType, kind) {
            const id = item.id;
            const name = item.name || 'Unknown';
            const safeName = this.escapeHtml(name);
            const showLogo = this.shouldShowLogo(kind);
            const logoStyleKey = kind === 'provider'
                ? 'streamingService'
                : (kind === 'studio' || kind === 'network' ? 'studioNetwork' : null);
            const logoPath = item.logo || item.logoPath;
            const logoUrl = showLogo && logoStyleKey && logoPath && logoPath !== 'not found'
                ? this.buildTmdbImageUrl(logoPath, logoStyleKey)
                : null;
            let content = '';

            if (kind === 'genre' && (this._displaySettings || {}).GenreUseBackdrops !== false) {
                const backdrops = item.backdrops || [];
                if (backdrops.length) {
                    const backdropPath = backdrops[Math.floor(Math.random() * backdrops.length)];
                    const backdropUrl = this.buildTmdbImageUrl(backdropPath, 'genreBackdrop');
                    if (backdropUrl) {
                        content += '<span class="seerrfin-box-backdrop" style="background-image: url(\'' + backdropUrl + '\')"></span>';
                    }
                }
            }

            if (logoUrl) {
                const logoClass = item.weirdSize ? 'seerrfin-box-logo-weird' : 'seerrfin-box-logo';
                content += '<img class="' + logoClass + '" src="' + this.escapeHtml(logoUrl) + '" alt="' + safeName + '" loading="lazy" />';
            } else {
                content += '<span class="seerrfin-box-label">' + safeName + '</span>';
            }

            return '<button type="button" class="seerrfin-box-card" data-kind="' + kind + '" data-media-type="' + mediaType + '" data-id="' + id + '" data-name="' + safeName + '">' +
                content +
                '</button>';
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

        createDiscoverCards: function (items, forGrid, options) {
            options = options || {};
            const useBackdrop = options.forceBackdrop === true ||
                (options.forceBackdrop !== false && this.shouldUseBackdropThumbnails());
            if (useBackdrop) {
                return this.createDiscoverBackdropCards(items, forGrid, options);
            }
            return this.createDiscoverPosterCards(items, forGrid, options);
        },

        normalizeDiscoverMediaType: function (value) {
            const normalized = String(value || '').toLowerCase();
            if (normalized === 'series' || normalized === 'tv') {
                return 'tv';
            }
            if (normalized === 'movie') {
                return 'movie';
            }
            return value;
        },

        buildDiscoverYearText: function (item) {
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

        createDiscoverPosterCards: function (items, forGrid, options) {
            let html = '';
            const self = this;
            options = options || {};
            const interactive = options.interactive !== false;
            const includeMetaText = options.includeMetaText !== false;
            const cardType = forGrid ? 'portraitCard' : 'overflowPortraitCard';
            const padderType = forGrid ? 'cardPadder-portrait' : 'cardPadder-overflowPortrait';
            const staticClass = interactive ? '' : ' seerrfin-discover-card--static';
            const boxClass = includeMetaText ? 'cardBox cardBox-bottompadded' : 'cardBox';

            items.forEach(function (item) {
                const mediaId = self.getProviderId(item, 'Tmdb') ||
                    self.getProviderId(item, 'Jellyseerr') ||
                    self.getField(item, 'id', 'Id');
                const mediaType = self.normalizeDiscoverMediaType(
                    self.getField(item, 'SourceType', 'sourceType', 'mediaType', 'MediaType')
                );
                let posterUrl = self.buildDiscoverPosterUrl(item);
                const safeName = self.escapeHtml(self.getField(item, 'Name', 'name', 'OriginalTitle', 'originalTitle') || 'Unknown');
                if (!mediaId || !mediaType) {
                    return;
                }

                const safeUrl = self.escapeHtml(posterUrl || '');
                const imageAttrs = posterUrl
                    ? ' data-src="' + safeUrl + '"'
                    : '';

                html += '<div class="card ' + cardType + ' seerrfin-discover-card' + staticClass + '" data-tmdb-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                html += '   <div class="' + boxClass + '">';
                html += '       <div class="cardScalable">';
                html += '           <div class="cardPadder ' + padderType + ' lazy-hidden-children"></div>';
                html += '           <div class="cardImageContainer coveredImage cardContent lazy lazy-hidden"' + imageAttrs + ' aria-label="' + safeName + '"></div>';
                if (interactive) {
                    html += '           <div class="cardOverlayContainer">';
                    html += '               <div class="cardImageContainer"></div>';
                    html += '               <div class="cardOverlayButton-br flex">';
                    html += '                   <button is="discover-requestbutton" type="button" class="discover-requestbutton cardOverlayButton cardOverlayButton-hover paper-icon-button-light emby-button" data-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                    html += '                       <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover add" aria-hidden="true"></span>';
                    html += '                   </button>';
                    html += '               </div>';
                    html += '           </div>';
                }
                html += '       </div>';
                if (includeMetaText) {
                    html += '       <div class="cardText cardTextCentered cardText-first"><bdi><span title="' + safeName + '">' + safeName + '</span></bdi></div>';
                    const meta = self.buildDiscoverYearText(item);
                    html += '       <div class="cardText cardTextCentered cardText-secondary"><bdi><span title="' + meta.year + '">' + meta.yearText + '</span></bdi></div>';
                }
                html += '   </div>';
                html += '</div>';
            }, this);

            return html;
        },

        createDiscoverBackdropCards: function (items, forGrid, options) {
            let html = '';
            const self = this;
            options = options || {};
            const interactive = options.interactive !== false;
            const includeMetaText = options.includeMetaText !== false;
            const gridClass = forGrid ? ' seerrfin-discover-card--grid' : '';
            const staticClass = interactive ? '' : ' seerrfin-discover-card--static';
            const boxClass = includeMetaText ? 'cardBox cardBox-bottompadded' : 'cardBox';

            items.forEach(function (item) {
                const mediaId = self.getProviderId(item, 'Tmdb') ||
                    self.getProviderId(item, 'Jellyseerr') ||
                    self.getField(item, 'id', 'Id');
                const mediaType = self.normalizeDiscoverMediaType(
                    self.getField(item, 'SourceType', 'sourceType', 'mediaType', 'MediaType')
                );
                const safeName = self.escapeHtml(self.getField(item, 'Name', 'name', 'OriginalTitle', 'originalTitle') || 'Unknown');
                if (!mediaId || !mediaType) {
                    return;
                }

                let fallbackUrl = self.getProviderId(item, 'JellyseerrBackdrop');
                fallbackUrl = self.resolveImageUrl(fallbackUrl);
                const tmdbBackdropPath = self.getProviderId(item, 'TmdbBackdropPath') || '';
                const safeFallback = self.escapeHtml(fallbackUrl || '');
                const safeBackdropPath = self.escapeHtml(tmdbBackdropPath);
                const fallbackAttr = safeFallback ? ' data-fallback-src="' + safeFallback + '"' : '';
                const backdropPathAttr = safeBackdropPath ? ' data-tmdb-backdrop-path="' + safeBackdropPath + '"' : '';

                html += '<div class="card seerrfin-discover-card seerrfin-discover-card--backdrop' + gridClass + staticClass + '" data-tmdb-id="' + mediaId + '" data-media-type="' + mediaType + '"' + fallbackAttr + backdropPathAttr + '>';
                html += '   <div class="' + boxClass + '">';
                html += '       <div class="cardScalable seerrfin-discover-backdrop-scalable">';
                html += '           <div class="cardPadder seerrfin-discover-backdrop-padder"></div>';
                html += '           <div class="cardImageContainer coveredImage cardContent seerrfin-discover-backdrop-image" aria-label="' + safeName + '">';
                html += '               <span class="seerrfin-discover-backdrop-media"></span>';
                html += '               <span class="seerrfin-discover-overlay-title seerrfin-box-label">' + safeName + '</span>';
                html += '           </div>';
                if (interactive) {
                    html += '           <div class="cardOverlayContainer">';
                    html += '               <div class="cardImageContainer"></div>';
                    html += '               <div class="cardOverlayButton-br flex">';
                    html += '                   <button is="discover-requestbutton" type="button" class="discover-requestbutton cardOverlayButton cardOverlayButton-hover paper-icon-button-light emby-button" data-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                    html += '                       <span class="material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover add" aria-hidden="true"></span>';
                    html += '                   </button>';
                    html += '               </div>';
                    html += '           </div>';
                }
                html += '       </div>';
                if (includeMetaText) {
                    html += '       <div class="cardText cardTextCentered cardText-first seerrfin-discover-title-below"><bdi><span title="' + safeName + '">' + safeName + '</span></bdi></div>';
                    const meta = self.buildDiscoverYearText(item);
                    html += '       <div class="cardText cardTextCentered cardText-secondary"><bdi><span title="' + meta.year + '">' + meta.yearText + '</span></bdi></div>';
                }
                html += '   </div>';
                html += '</div>';
            }, this);

            return html;
        },

        setDiscoverBackdropImage: function (card, cachedUrl) {
            if (!card) {
                return;
            }

            const media = card.querySelector('.seerrfin-discover-backdrop-media');
            if (!media) {
                return;
            }

            const path = card.getAttribute('data-tmdb-backdrop-path') || '';
            const style = this.getDisplayStyle('discoverBackdrop');
            let displayUrl = style.duotoneEnabled && path
                ? (this.buildTmdbImageUrl(path, 'discoverBackdrop') || '')
                : '';

            if (!displayUrl) {
                displayUrl = cachedUrl || '';
            }

            if (!displayUrl) {
                return;
            }

            media.style.backgroundImage = "url('" + displayUrl.replace(/'/g, "\\'") + "')";
        },

        setDiscoverBackdropPresentation: function (card, mode) {
            if (!card) {
                return;
            }

            card.classList.remove(
                'seerrfin-discover-card--english',
                'seerrfin-discover-card--fallback'
            );

            if (mode === 'english') {
                card.classList.add('seerrfin-discover-card--english');
                return;
            }

            if (mode === 'fallback') {
                card.classList.add('seerrfin-discover-card--fallback');
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
                        path: (data && (data.tmdbBackdropPath || data.TmdbBackdropPath)) || '',
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

            if (result && result.path) {
                card.setAttribute('data-tmdb-backdrop-path', result.path);
            }

            if (url && hasEnglish) {
                self.setDiscoverBackdropPresentation(card, 'english');
                self.setDiscoverBackdropImage(card, url);
                return;
            }

            const fallbackUrl = url || seerrFallbackUrl;
            if (fallbackUrl || card.getAttribute('data-tmdb-backdrop-path')) {
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

            const cards = container.querySelectorAll('.seerrfin-discover-card--backdrop:not([data-backdrop-hydrate-queued]):not([data-backdrop-loaded])');
            if (!cards.length) {
                return;
            }

            cards.forEach(function (card) {
                const fallbackUrl = card.getAttribute('data-fallback-src') || '';
                if (card.getAttribute('data-tmdb-backdrop-path') || fallbackUrl) {
                    self.setDiscoverBackdropPresentation(card, 'fallback');
                    self.setDiscoverBackdropImage(card, fallbackUrl);
                }
            });

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
                if (!btn || !btn.closest('.seerrfin-movies-sections, .seerrfin-tv-sections, .seerrfin-grid-view')) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const mediaId = btn.getAttribute('data-id');
                const mediaType = btn.getAttribute('data-media-type');
                if (window.seerrFinModal && window.seerrFinModal.openQualityPicker) {
                    window.seerrFinModal.openQualityPicker(mediaId, mediaType);
                }
            }, true);
        },

        bindCardClickHandler: function () {
            // Capturing so card opens our modal instead of jellyfin detail page
            document.addEventListener('click', function (e) {
                if (e.target.closest('.discover-requestbutton')) {
                    return;
                }

                const card = e.target.closest('.seerrfin-discover-card');
                if (!card || card.classList.contains('seerrfin-discover-card--static') ||
                    !card.closest('.seerrfin-movies-sections, .seerrfin-tv-sections, .seerrfin-grid-view')) {
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

                if (window.seerrFinModal && window.seerrFinModal.open) {
                    window.seerrFinModal.open(mediaId, mediaType);
                }
            }, true);
        },

        bindViewMoreHandler: function () {
            const self = this;

            document.addEventListener('contextmenu', function (e) {
                if (e.target.closest('.seerrfin-grid-view')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            document.addEventListener('click', function (e) {
                const btn = e.target.closest('.seerrfin-view-more');
                if (btn) {
                    const container = btn.closest('.seerrfin-movies-sections, .seerrfin-tv-sections');
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

                const boxCard = e.target.closest('.seerrfin-box-card');
                if (!boxCard) {
                    return;
                }

                const boxContainer = boxCard.closest('.seerrfin-movies-sections, .seerrfin-tv-sections');
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
                if (!child.classList.contains('seerrfin-grid-view')) {
                    child.style.display = 'none';
                    child.dataset.seerrfinHidden = 'true';
                }
            });

            let gridView = container.querySelector('.seerrfin-grid-view');
            if (!gridView) {
                gridView = document.createElement('div');
                gridView.className = 'seerrfin-grid-view';

                const header = document.createElement('div');
                header.className = 'seerrfin-grid-header padded-left padded-right';

                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'seerrfin-grid-back paper-icon-button-light emby-button';
                backBtn.innerHTML = '<span class="material-icons" aria-hidden="true">arrow_back</span>';
                backBtn.addEventListener('click', function () {
                    self.closeGridView(container);
                });

                const heading = document.createElement('h2');
                heading.className = 'seerrfin-grid-title sectionTitle sectionTitle-cards';

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'itemsContainer vertical-wrap padded-left padded-right';

                const loadMore = document.createElement('div');
                loadMore.className = 'seerrfin-grid-loadmore';
                loadMore.style.display = 'none';

                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.type = 'button';
                loadMoreBtn.className = 'raised emby-button';
                loadMoreBtn.textContent = 'Load more';
                loadMore.appendChild(loadMoreBtn);

                const status = document.createElement('div');
                status.className = 'seerrfin-grid-status';
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
            gridView.querySelector('.seerrfin-grid-title').textContent = title;
            gridView.querySelector('.itemsContainer').innerHTML = '';
            gridView.querySelector('.seerrfin-grid-loadmore').style.display = 'none';
            gridView.querySelector('.seerrfin-grid-status').style.display = 'none';
            gridView.style.display = '';

            self.loadMoreGridItems(gridView, true);
        },

        closeGridView: function (container) {
            this.clearJellyfinSelection();

            const gridView = container.querySelector('.seerrfin-grid-view');
            if (gridView) {
                gridView.style.display = 'none';
            }

            Array.from(container.children).forEach(function (child) {
                if (child.dataset.seerrfinHidden === 'true') {
                    child.style.display = '';
                    delete child.dataset.seerrfinHidden;
                }
            });
        },

        loadMoreGridItems: function (gridView, isInitial) {
            const self = this;
            const path = gridView.dataset.path;
            const itemsContainer = gridView.querySelector('.itemsContainer');
            const loadMore = gridView.querySelector('.seerrfin-grid-loadmore');
            const loadMoreBtn = loadMore.querySelector('button');
            const status = gridView.querySelector('.seerrfin-grid-status');
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
                    itemsContainer.innerHTML = '<div class="seerrfin-empty-row">No items to show</div>';
                    loadMore.style.display = 'none';
                    return;
                }

                const existingIds = new Set(); // deduplicate cards using tmdb id by using a set
                itemsContainer.querySelectorAll('.seerrfin-discover-card[data-tmdb-id]').forEach(function (card) {
                    existingIds.add(card.getAttribute('data-tmdb-id'));
                });
                const newItems = result.items.filter(function (item) {
                    const id = String(self.getProviderId(item, 'Tmdb') ||
                        self.getProviderId(item, 'Jellyseerr') ||
                        self.getField(item, 'id', 'Id') || '');
                    return id && !existingIds.has(id) && existingIds.add(id);
                });

                itemsContainer.insertAdjacentHTML('beforeend', self.createDiscoverCards(newItems, true));
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
                console.error('SeerrFin grid load failed:', err);
                if (loadedCount === 0) {
                    itemsContainer.innerHTML = '<div class="seerrfin-empty-row">Failed to load items.</div>';
                }
            });
        },

        refreshScrollers: function (container) {
            const self = this;
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    const scrollers = container.querySelectorAll('[is="emby-scroller"]');
                    scrollers.forEach(function (scroller) {
                        if (scroller.scroller && scroller.scroller.reload) {
                            scroller.scroller.reload();
                        }
                        if (scroller.enableMouseWheelScroll) {
                            scroller.enableMouseWheelScroll();
                        }
                    });

                    container.querySelectorAll('.seerrfin-poster-section').forEach(function (section) {
                        self.bindRowInfiniteScroll(section);
                    });
                });
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
        window.seerrFinPlugin.init();
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
        if (!document.hidden && window.seerrFinPlugin) {
            setTimeout(function () {
                window.seerrFinPlugin.scheduleRender();
            }, 300);
        }
    });
}

// On config page, jf doesn't allow custom menu icons so this is a small patch for that
(function () {
    function patch() {
        var icon = document.querySelector('a[href*="name=SeerrFin"] .MuiListItemIcon-root');
        if (!icon || icon.dataset.bstMenuIcon) return;

        icon.dataset.bstMenuIcon = '1';
        icon.innerHTML = '<span class="material-icons notranslate MuiIcon-root MuiIcon-fontSizeMedium" aria-hidden="true">preview</span>'; // eventually add logo svg
    }

    new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
    patch();
})();