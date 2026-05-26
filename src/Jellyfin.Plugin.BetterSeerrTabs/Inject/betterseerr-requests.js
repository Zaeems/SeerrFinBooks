'use strict';

(function () {
    if (window.__betterSeerrRequestsInit) {
        return;
    }
    window.__betterSeerrRequestsInit = true;

    const PAGE_SIZE = 20;
    const FETCH_SIZE = 100;
    const CARD_OPTIONS = { interactive: false, includeMetaText: false };
    const FILTERS = [
        { id: 'all', label: 'All' },
        { id: 'pending', label: 'Pending Approval' },
        { id: 'processing', label: 'Processing' },
        { id: 'comingsoon', label: 'Coming Soon' },
        { id: 'available', label: 'Available' }
    ];

    const state = {
        allRequests: [],
        page: 1,
        filter: 'all',
        loading: false,
        loadId: 0,
        rendered: false
    };

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function getPlugin() {
        return window.betterSeerrTabsPlugin || null;
    }

    function findActiveContainer() {
        const all = document.querySelectorAll('.betterseerr-requests-sections');
        for (let i = all.length - 1; i >= 0; i--) {
            const container = all[i];
            if (!container.isConnected) {
                continue;
            }

            const page = container.closest('.page');
            if (page && page.classList.contains('hide')) {
                continue;
            }

            const tabPanel = container.closest('.tabContent, .pageTabContent');
            if (tabPanel && tabPanel.classList.contains('hide')) {
                continue;
            }

            if (container.offsetParent !== null) {
                return container;
            }
        }
        return null;
    }

    function formatRelativeDate(dateStr) {
        if (!dateStr) {
            return '';
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return '';
        }

        const diff = Date.now() - date.getTime();
        if (diff < 0) {
            return '';
        }

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) {
            return 'just now';
        }
        if (minutes < 60) {
            return minutes + 'm ago';
        }
        if (hours < 24) {
            return hours + 'h ago';
        }
        if (days < 30) {
            return days + 'd ago';
        }

        return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function chipClassForStatus(label) {
        const normalized = (label || '').toLowerCase();
        if (normalized.includes('available') && !normalized.includes('partially')) {
            return 'betterseerr-request-chip--available';
        }
        if (normalized.includes('partially')) {
            return 'betterseerr-request-chip--partial';
        }
        if (normalized.includes('processing')) {
            return 'betterseerr-request-chip--processing';
        }
        if (normalized.includes('pending')) {
            return 'betterseerr-request-chip--pending';
        }
        if (normalized.includes('approved')) {
            return 'betterseerr-request-chip--approved';
        }
        if (normalized.includes('declined') || normalized.includes('failed')) {
            return 'betterseerr-request-chip--declined';
        }
        return '';
    }

    function getAvatarUrl(avatarPath) {
        if (!avatarPath) {
            return '';
        }

        return ApiClient.getUrl('BetterSeerrTabs/proxy/avatar', {
            path: avatarPath,
            api_key: ApiClient.accessToken()
        });
    }

    function isPlayableRequest(item) {
        const label = (item.mediaStatusLabel || '').toLowerCase();
        return (label === 'available' || label === 'partially available') && item.jellyfinItemId;
    }

    function navigateToJellyfinItem(itemId) {
        if (!itemId || typeof ApiClient === 'undefined') {
            return;
        }

        function openDetails(id, item) {
            if (window.AppRouter && typeof AppRouter.showItem === 'function') {
                AppRouter.showItem(item || { Id: id, ServerId: ApiClient.serverId() });
                return;
            }

            if (window.Dashboard && typeof Dashboard.navigate === 'function') {
                Dashboard.navigate('details?id=' + encodeURIComponent(id));
            }
        }

        ApiClient.getItem(ApiClient.getCurrentUserId(), itemId)
            .then(function (item) {
                openDetails(itemId, item);
            })
            .catch(function () {
                openDetails(itemId);
            });
    }

    function openRequestModal(tmdbId, mediaType) {
        if (!tmdbId || !mediaType) {
            return;
        }

        if (window.betterSeerrModal && typeof window.betterSeerrModal.open === 'function') {
            window.betterSeerrModal.open(tmdbId, mediaType);
        }
    }

    function renderCardActions(item) {
        if (!item.tmdbId) {
            return '';
        }

        const safeTitle = escapeHtml(item.title || 'content');
        const mediaType = item.type === 'tv' ? 'tv' : 'movie';
        const safeTmdbId = escapeHtml(String(item.tmdbId));
        const safeMediaType = escapeHtml(mediaType);
        let html = '<div class="betterseerr-request-card-actions">';

        if (isPlayableRequest(item)) {
            const safeItemId = escapeHtml(String(item.jellyfinItemId));
            html +=
                '<button type="button" class="betterseerr-request-action-btn betterseerr-request-play-btn" ' +
                    'data-jellyfin-item-id="' + safeItemId + '" ' +
                    'aria-label="Open ' + safeTitle + ' in Jellyfin" title="Open in Jellyfin">' +
                    '<span class="material-icons" aria-hidden="true">play_arrow</span>' +
                '</button>';
        }

        html +=
            '<button type="button" class="betterseerr-request-action-btn betterseerr-request-modal-btn" ' +
                'data-tmdb-id="' + safeTmdbId + '" data-media-type="' + safeMediaType + '" ' +
                'aria-label="View request details for ' + safeTitle + '" title="Request details">' +
                '<span class="material-icons" aria-hidden="true">download</span>' +
            '</button>' +
            '</div>';

        return html;
    }

    function mapRequestToDiscoverItem(item) {
        const mediaType = item.type === 'tv' ? 'tv' : 'movie';
        const providerIds = {};

        if (item.tmdbId) {
            providerIds.Tmdb = String(item.tmdbId);
        }
        if (item.posterPath) {
            providerIds.TmdbPosterPath = item.posterPath;
        }
        if (item.backdropPath) {
            providerIds.TmdbBackdropPath = item.backdropPath;
        }
        if (item.posterUrl) {
            providerIds.JellyseerrPoster = item.posterUrl;
        }
        if (item.backdropUrl) {
            providerIds.JellyseerrBackdrop = item.backdropUrl;
        }

        return {
            Id: item.tmdbId,
            id: item.tmdbId,
            Name: item.title,
            name: item.title,
            mediaType: mediaType,
            SourceType: mediaType,
            PremiereDate: item.year ? item.year + '-01-01' : null,
            ProviderIds: providerIds
        };
    }

    function renderDiscoverCard(item) {
        const plugin = getPlugin();
        if (!plugin || !item.tmdbId || typeof plugin.createDiscoverCards !== 'function') {
            return '';
        }

        return plugin.createDiscoverCards([mapRequestToDiscoverItem(item)], false, CARD_OPTIONS);
    }

    function shouldUseLandscapeCards() {
        const plugin = getPlugin();
        return plugin && typeof plugin.shouldUseBackdropThumbnails === 'function'
            ? plugin.shouldUseBackdropThumbnails()
            : false;
    }

    function renderContentBlock(item) {
        const statusLabel = item.mediaStatusLabel || 'Unknown';
        const safeTitle = escapeHtml(item.title || 'Unknown');
        const timeAgo = item.createdAt ? escapeHtml(formatRelativeDate(item.createdAt)) : '';
        const avatarUrl = getAvatarUrl(item.requestedByAvatar);
        const avatarHtml = avatarUrl
            ? '<img class="betterseerr-request-avatar" src="' + escapeHtml(avatarUrl) + '" alt="" loading="lazy" onerror="this.remove()">'
            : '';

        const chips = [
            '<span class="betterseerr-request-chip ' + chipClassForStatus(statusLabel) + '">' + escapeHtml(statusLabel) + '</span>'
        ];

        if (item.is4k) {
            chips.push('<span class="betterseerr-request-chip betterseerr-request-chip--4k">4K</span>');
        }

        if (item.type) {
            chips.push('<span class="betterseerr-request-chip betterseerr-request-chip--type">' + escapeHtml(item.type === 'tv' ? 'TV' : 'Movie') + '</span>');
        }

        let html =
            '<div class="betterseerr-request-content">' +
                '<div class="betterseerr-request-title">' +
                    '<span title="' + safeTitle + '">' + safeTitle + '</span>' +
                    (item.year ? ' <span class="betterseerr-request-year">(' + escapeHtml(String(item.year)) + ')</span>' : '') +
                '</div>' +
                '<div class="betterseerr-request-chips">' + chips.join('') + '</div>' +
                '<div class="betterseerr-request-meta">' +
                    '<span>Requested by</span> ' + avatarHtml +
                    '<span class="betterseerr-request-meta-light">' + escapeHtml(item.requestedBy || 'Unknown') + '</span>' +
                    (timeAgo ? ' &bull; <span>' + timeAgo + '</span>' : '') +
                '</div>';

        const seasonNumbers = Array.isArray(item.seasonNumbers) ? item.seasonNumbers : [];
        if (item.type === 'tv' && seasonNumbers.length) {
            html += '<div class="betterseerr-request-meta">Requested seasons: <span class="betterseerr-request-meta-light">' + escapeHtml(seasonNumbers.join(', ')) + '</span></div>';
        }

        html += '</div>';
        return html;
    }

    function renderRequestCard(item) {
        const isLandscape = shouldUseLandscapeCards();
        const layoutClass = isLandscape ? 'betterseerr-request-box--landscape' : 'betterseerr-request-box--portrait';
        const discoverCard = renderDiscoverCard(item);

        if (!discoverCard) {
            return '';
        }

        return (
            '<article class="betterseerr-request-box ' + layoutClass + '" data-request-id="' + escapeHtml(String(item.id || '')) + '" hidden>' +
                '<div class="betterseerr-request-box-inner">' +
                    '<div class="betterseerr-request-card-slot">' + discoverCard + renderCardActions(item) + '</div>' +
                    renderContentBlock(item) +
                '</div>' +
            '</article>'
        );
    }

    function hydrateRequestCards(container) {
        const plugin = getPlugin();
        if (!plugin || !container) {
            return;
        }

        if (typeof plugin.initLazyImages === 'function') {
            plugin.initLazyImages(container);
        }

        if (typeof plugin.hydrateDiscoverBackdropCards === 'function') {
            plugin.hydrateDiscoverBackdropCards(container);
        }
    }

    function matchesFilter(item, filterId) {
        if (filterId === 'all') {
            return true;
        }

        if (filterId === 'comingsoon') {
            return item.isComingSoon === true;
        }

        const label = (item.mediaStatusLabel || '').toLowerCase();

        if (filterId === 'pending') {
            return label.includes('pending');
        }

        if (filterId === 'available') {
            return label.includes('available');
        }

        if (filterId === 'processing') {
            return label !== 'partially available' && (label === 'processing' || label === 'approved');
        }

        return true;
    }

    function getFilteredRequests() {
        let items = state.allRequests.filter(function (item) {
            return matchesFilter(item, state.filter);
        });

        if (state.filter === 'comingsoon') {
            items = items.slice().sort(function (a, b) {
                return String(a.releaseSortDate || '').localeCompare(String(b.releaseSortDate || ''));
            });
        }

        return items;
    }

    function getPageSlice(items) {
        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        state.page = Math.min(state.page, totalPages);
        const start = (state.page - 1) * PAGE_SIZE;
        return {
            items: items.slice(start, start + PAGE_SIZE),
            totalPages: totalPages
        };
    }

    function updateFilters(container) {
        container.querySelectorAll('.betterseerr-requests-filter').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-filter') === state.filter);
        });
    }

    function updatePagination(container, totalPages) {
        let pagination = container.querySelector('.betterseerr-requests-pagination');

        if (totalPages <= 1) {
            if (pagination) {
                pagination.remove();
            }
            return;
        }

        if (!pagination) {
            pagination = document.createElement('div');
            pagination.className = 'betterseerr-grid-loadmore betterseerr-requests-pagination padded-left';
            container.appendChild(pagination);
        }

        pagination.innerHTML =
            '<button type="button" class="raised emby-button betterseerr-requests-prev" ' + (state.page <= 1 ? 'disabled' : '') + '>Previous</button>' +
            '<span class="betterseerr-requests-page-info">Page ' + state.page + ' of ' + totalPages + '</span>' +
            '<button type="button" class="raised emby-button betterseerr-requests-next" ' + (state.page >= totalPages ? 'disabled' : '') + '>Next</button>';
    }

    function renderAllCards(container) {
        const body = container.querySelector('.betterseerr-requests-body');
        if (!body) {
            return;
        }

        if (!state.allRequests.length) {
            body.innerHTML = '<div class="betterseerr-empty-row padded-left">No requests found.</div>';
            state.rendered = true;
            return;
        }

        const cards = state.allRequests.map(renderRequestCard).filter(Boolean).join('');
        if (!cards) {
            body.innerHTML = '<div class="betterseerr-empty-row padded-left">No requests found.</div>';
            state.rendered = true;
            return;
        }

        const gridClass = shouldUseLandscapeCards()
            ? ' betterseerr-requests-grid--landscape'
            : ' betterseerr-requests-grid--portrait';

        body.innerHTML =
            '<div class="betterseerr-empty-row padded-left betterseerr-requests-empty" hidden>No requests found.</div>' +
            '<div class="betterseerr-requests-grid' + gridClass + ' padded-left padded-right">' + cards + '</div>';

        hydrateRequestCards(body);
        state.rendered = true;
    }

    function applyView(container) {
        updateFilters(container);

        if (!state.rendered) {
            renderAllCards(container);
        }

        const body = container.querySelector('.betterseerr-requests-body');
        if (!body) {
            return;
        }

        const page = getPageSlice(getFilteredRequests());
        const visibleIds = {};
        page.items.forEach(function (item) {
            visibleIds[String(item.id)] = true;
        });

        body.querySelectorAll('.betterseerr-request-box').forEach(function (card) {
            card.hidden = !visibleIds[card.getAttribute('data-request-id')];
        });

        const empty = body.querySelector('.betterseerr-requests-empty');
        const grid = body.querySelector('.betterseerr-requests-grid');
        if (empty) {
            empty.hidden = page.items.length > 0;
        }
        if (grid) {
            grid.hidden = page.items.length === 0;
        }

        updatePagination(container, page.totalPages);
    }

    function fetchRequestPage(skip) {
        return fetch(ApiClient.getUrl('BetterSeerrTabs/requests', {
            take: FETCH_SIZE,
            skip: skip
        }), {
            headers: { 'X-MediaBrowser-Token': ApiClient.accessToken() }
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        });
    }

    function fetchAllRequests() {
        const all = [];
        let skip = 0;

        function loadNext() {
            return fetchRequestPage(skip).then(function (data) {
                all.push.apply(all, data.requests || []);
                const totalPages = data.totalPages || 1;
                const loadedPages = Math.ceil(all.length / FETCH_SIZE);
                if (loadedPages < totalPages) {
                    skip += FETCH_SIZE;
                    return loadNext();
                }
                state.allRequests = all;
            });
        }

        return loadNext();
    }

    function loadRequests(container) {
        if (!container || state.loading) {
            return;
        }

        const loadId = ++state.loadId;
        state.loading = true;

        const body = container.querySelector('.betterseerr-requests-body');
        if (body && !body.children.length) {
            body.innerHTML = '<div class="betterseerr-loading-row padded-left">Loading...</div>';
        }

        fetchAllRequests()
            .catch(function () {
                if (loadId !== state.loadId) {
                    return;
                }
                state.allRequests = [];
                state.rendered = false;
                if (body) {
                    body.innerHTML = '<div class="betterseerr-empty-row padded-left">Could not load requests. Check Jellyseerr settings.</div>';
                }
            })
            .finally(function () {
                if (loadId !== state.loadId || !container.isConnected) {
                    return;
                }
                state.loading = false;
                state.rendered = false;
                applyView(container);
            });
    }

    function mount(container) {
        if (container.querySelector('.betterseerr-requests-panel')) {
            return;
        }

        container.innerHTML =
            '<div class="verticalSection betterseerr-requests-panel">' +
                '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">' +
                    '<h2 class="sectionTitle sectionTitle-cards">Requests</h2>' +
                '</div>' +
                '<div class="betterseerr-requests-filters padded-left padded-right">' +
                    FILTERS.map(function (filter) {
                        const activeClass = state.filter === filter.id ? ' is-active' : '';
                        return '<button type="button" class="betterseerr-requests-filter' + activeClass + '" data-filter="' + filter.id + '">' +
                            escapeHtml(filter.label) + '</button>';
                    }).join('') +
                '</div>' +
            '</div>' +
            '<div class="betterseerr-requests-body"></div>';

        bindContainerEvents(container);

        const plugin = getPlugin();
        const settingsPromise = plugin && typeof plugin.loadDisplaySettings === 'function'
            ? plugin.loadDisplaySettings().catch(function () { return null; })
            : Promise.resolve();

        settingsPromise.then(function () {
            loadRequests(container);
        });
    }

    function bindContainerEvents(container) {
        if (container.dataset.betterseerrRequestsBound === 'true') {
            return;
        }
        container.dataset.betterseerrRequestsBound = 'true';

        container.addEventListener('click', function (event) {
            const modalBtn = event.target.closest('.betterseerr-request-modal-btn');
            if (modalBtn) {
                event.preventDefault();
                event.stopPropagation();
                openRequestModal(
                    modalBtn.getAttribute('data-tmdb-id'),
                    modalBtn.getAttribute('data-media-type')
                );
                return;
            }

            const playBtn = event.target.closest('.betterseerr-request-play-btn');
            if (playBtn) {
                event.preventDefault();
                event.stopPropagation();
                navigateToJellyfinItem(playBtn.getAttribute('data-jellyfin-item-id'));
                return;
            }

            const tab = event.target.closest('.betterseerr-requests-filter');
            if (tab) {
                event.preventDefault();
                const filter = tab.getAttribute('data-filter');
                if (filter && filter !== state.filter) {
                    state.filter = filter;
                    state.page = 1;
                    applyView(container);
                }
                return;
            }

            if (event.target.closest('.betterseerr-requests-prev') && state.page > 1) {
                state.page -= 1;
                applyView(container);
                return;
            }

            const totalPages = Math.max(1, Math.ceil(getFilteredRequests().length / PAGE_SIZE));
            if (event.target.closest('.betterseerr-requests-next') && state.page < totalPages) {
                state.page += 1;
                applyView(container);
            }
        });
    }

    function ensureMounted() {
        const container = findActiveContainer();
        if (container) {
            mount(container);
        }
    }

    function init() {
        if (typeof ApiClient === 'undefined' || !getPlugin()) {
            setTimeout(init, 200);
            return;
        }

        window.__betterSeerrRequestsEnsureMounted = ensureMounted;
        document.addEventListener('viewshow', ensureMounted);
        ensureMounted();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
