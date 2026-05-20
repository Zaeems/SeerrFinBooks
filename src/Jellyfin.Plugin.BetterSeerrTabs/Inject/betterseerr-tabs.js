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

        init: function () {
            if (typeof ApiClient === 'undefined') {
                setTimeout(() => this.init(), 200);
                return;
            }

            if (!this._handlersBound) {
                this._handlersBound = true;
                this.bindRequestHandler();
                this.bindCardClickHandler();
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

            if (this.isContainerPopulated(container)) {
                return;
            }

            const hasError = container.querySelector('.betterseerr-empty-row');
            if (hasError && container.dataset.betterseerrLoaded === 'true') {
                return;
            }

            this.loadTab(type, container);
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

            Promise.allSettled(rows.map(function (row) {
                return self.fetchRow(row.path).then(function (items) {
                    return { row: row, items: items };
                });
            })).then(function (results) {
                if (isStale()) {
                    return null;
                }

                const loadedRows = [];
                results.forEach(function (result, index) {
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
                        container.appendChild(self.buildPosterRow(result.row.title, result.items));
                    } catch (err) {
                        console.warn('BetterSeerrTabs: row render failed', result.row.title, err);
                    }
                });

                self.refreshScrollers(container);

                return Promise.allSettled([
                    self.fetchJson('genres/' + mediaType),
                    self.fetchJson('providers/' + mediaType)
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

                    if (carouselResults[0].status === 'rejected') {
                        console.warn('BetterSeerrTabs: genre carousel failed', carouselResults[0].reason);
                    }
                    if (carouselResults[1].status === 'rejected') {
                        console.warn('BetterSeerrTabs: provider carousel failed', carouselResults[1].reason);
                    }

                    if (genres.length) {
                        container.appendChild(self.buildGenreCarousel('Browse by genre', genres, mediaType));
                    }
                    if (providers.length) {
                        container.appendChild(self.buildProviderCarousel('Browse by streaming service', providers, mediaType));
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

        fetchRow: function (path) {
            return this.fetchJson(path).then(function (data) {
                const items = data && (data.Items || data.items || data.Results || data.results);
                return Array.isArray(items) ? items : [];
            });
        },

        fetchJson: function (path) {
            return ApiClient.ajax({
                url: ApiClient.getUrl('BetterSeerrTabs/' + path),
                type: 'GET',
                dataType: 'json'
            });
        },

        buildPosterRow: function (title, items) {
            const section = document.createElement('div');
            section.className = 'verticalSection betterseerr-poster-section';

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
            return section;
        },

        buildGenreCarousel: function (title, genres, mediaType) {
            return this.buildCarouselSection(title, genres, mediaType, 'genre', false);
        },

        buildProviderCarousel: function (title, providers, mediaType) {
            return this.buildCarouselSection(title, providers, mediaType, 'provider', true);
        },

        buildCarouselSection: function (title, items, mediaType, kind, isProvider) {
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
                html += self.createBoxCard(item, mediaType, kind, isProvider);
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

        createBoxCard: function (item, mediaType, kind, isProvider) {
            const id = item.id || item.provider_id;
            const name = item.name || item.provider_name || 'Unknown';
            let imageUrl = '';

            if (isProvider && (item.logoPath || item.logo_path)) {
                const logo = item.logoPath || item.logo_path;
                imageUrl = 'https://image.tmdb.org/t/p/w300' + logo;
            } else if (item.backdrops && item.backdrops.length > 0) {
                let backdrop = item.backdrops[0];
                if (backdrop && typeof backdrop === 'object') {
                    backdrop = backdrop.filePath || backdrop.path || backdrop.backdropPath || backdrop.url;
                }
                if (typeof backdrop === 'string' && backdrop.length) {
                    imageUrl = backdrop.startsWith('http') ? backdrop : ('https://image.tmdb.org/t/p/w780' + backdrop);
                }
            }

            const cardClass = isProvider ? 'betterseerr-box-card betterseerr-provider-card' : 'betterseerr-box-card';
            let html = '<div class="' + cardClass + '" data-kind="' + kind + '" data-media-type="' + mediaType + '" data-id="' + id + '">';
            html += '<div class="betterseerr-box-image" style="background-image:url(\'' + imageUrl + '\')"></div>';
            html += '<div class="betterseerr-box-label">' + this.escapeHtml(name) + '</div>';
            html += '</div>';
            return html;
        },

        createDiscoverCards: function (items) {
            let html = '';
            let index = 0;
            const self = this;

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

                html += '<div class="card overflowPortraitCard betterseerr-discover-card" data-index="' + index + '" data-tmdb-id="' + mediaId + '" data-media-type="' + mediaType + '">';
                html += '   <div class="cardBox cardBox-bottompadded">';
                html += '       <div class="cardScalable">';
                html += '           <div class="cardPadder cardPadder-overflowPortrait lazy-hidden-children"></div>';
                html += '           <canvas aria-hidden="true" width="20" height="20" class="blurhash-canvas lazy-hidden"></canvas>';
                html += '           <div class="cardImageContainer coveredImage cardContent lazy blurhashed lazy-image-fadein-fast" aria-label="' + safeName + '" style="background-image:url(\'' + posterUrl + '\');"></div>';
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
                html += '       <div class="cardText cardTextCentered cardText-secondary"><bdi><span title="' + year + '">' + yearText + '</span></bdi></div>';
                html += '   </div>';
                html += '</div>';
                index++;
            }, this);

            return html;
        },

        bindRequestHandler: function () {
            // Capturing runs before card navigation handlers
            document.addEventListener('click', function (e) {
                const btn = e.target.closest('.discover-requestbutton');
                if (!btn || !btn.closest('.betterseerr-movies-sections, .betterseerr-tv-sections')) {
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
                if (!card || !card.closest('.betterseerr-movies-sections, .betterseerr-tv-sections')) {
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

        refreshScrollers: function (container) {
            const scrollers = container.querySelectorAll('[is="emby-scroller"]');
            scrollers.forEach(function (scroller) {
                if (scroller.enableMouseWheelScroll) {
                    scroller.enableMouseWheelScroll();
                }
            });
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
