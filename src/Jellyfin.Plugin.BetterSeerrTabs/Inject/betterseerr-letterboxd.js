'use strict';

(function () {
    if (window.__betterSeerrLetterboxdInit) {
        return;
    }
    window.__betterSeerrLetterboxdInit = true;

    const CARD_OPTIONS = { interactive: false, includeMetaText: true };
    const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;

    const state = {
        username: '',
        syncMeta: null,
        items: [],
        selectedIds: new Set(),
        requestedIds: new Set(),
        syncing: false,
        syncProgressPercent: 0,
        syncProgressPollTimer: null,
        requesting: false,
        requestProgress: { done: 0, total: 0 },
        bulkRoot: null
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
        const all = document.querySelectorAll('.betterseerr-letterboxd-sections');
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

        return all.length ? all[all.length - 1] : null;
    }

    function formatDate(value) {
        if (!value) {
            return 'Never';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return 'Unknown';
        }

        return date.toLocaleString();
    }

    function getSyncButtonLabel() {
        if (state.syncing) {
            return state.syncProgressPercent + '%';
        }

        return state.items.length > 0 ? 'Refresh watchlist' : 'Get watchlist';
    }

    function updateSyncButton(container) {
        const button = container.querySelector('[data-sync-submit]');
        if (button) {
            button.textContent = getSyncButtonLabel();
        }
    }

    function stopSyncProgressPolling() {
        if (state.syncProgressPollTimer) {
            clearInterval(state.syncProgressPollTimer);
            state.syncProgressPollTimer = null;
        }
    }

    function pollSyncProgress(container) {
        ApiClient.ajax({
            url: ApiClient.getUrl('BetterSeerrTabs/letterboxd/sync/progress'),
            type: 'GET',
            dataType: 'json'
        }).then(function (result) {
            const raw = result?.percent ?? result?.Percent ?? 0;
            const percent = typeof raw === 'number' ? raw : parseInt(raw, 10);
            if (Number.isNaN(percent)) {
                return;
            }

            const clamped = Math.max(0, Math.min(100, Math.round(percent)));
            if (clamped !== state.syncProgressPercent) {
                state.syncProgressPercent = clamped;
                updateSyncButton(container);
            }
        }).catch(function () {
            // Ignore polling errors while sync is in flight.
        });
    }

    function startSyncProgressPolling(container) {
        stopSyncProgressPolling();
        state.syncProgressPercent = 0;
        updateSyncButton(container);
        pollSyncProgress(container);
        state.syncProgressPollTimer = setInterval(function () {
            pollSyncProgress(container);
        }, 400);
    }

    function syncWatchlist(username) {
        return ApiClient.ajax({
            url: ApiClient.getUrl('BetterSeerrTabs/letterboxd/sync', { letterboxdUsername: username }),
            type: 'POST',
            dataType: 'json'
        }).then(function (result) {
            state.username = result?.letterboxdUsername || result?.LetterboxdUsername || username;
            state.items = result?.items || result?.Items || [];
            state.syncMeta = {
                resolvedCount: result?.resolvedCount || result?.ResolvedCount || 0,
                unresolvedCount: result?.unresolvedCount || result?.UnresolvedCount || 0,
                lastSynced: new Date().toISOString(),
                lastError: null
            };
            return result;
        });
    }

    function mapItemToDiscover(item) {
        const providerIds = item.ProviderIds || item.providerIds || {};
        const premiereDate = item.PremiereDate || item.premiereDate || null;
        return {
            Id: providerIds.Tmdb || providerIds.tmdb,
            Name: item.Name || item.name,
            SourceType: 'movie',
            PremiereDate: premiereDate,
            CommunityRating: item.CommunityRating || item.communityRating,
            ProviderIds: providerIds
        };
    }

    function getTmdbId(item) {
        const providerIds = item.ProviderIds || item.providerIds || {};
        const raw = providerIds.Tmdb || providerIds.tmdb || item.Id || item.id;
        const parsed = parseInt(raw, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    function renderPanel(container) {
        const syncMeta = state.syncMeta || {};
        const resolvedCount = syncMeta.resolvedCount || 0;
        const unresolvedCount = syncMeta.unresolvedCount || 0;
        const lastSynced = syncMeta.lastSynced || null;
        const lastError = syncMeta.lastError || null;
        const hasWatchlist = state.items.length > 0;
        const showToolbar = hasWatchlist && !state.syncing;
        const selectedCount = state.selectedIds.size;
        const progressText = state.requesting
            ? 'Requesting ' + state.requestProgress.done + ' of ' + state.requestProgress.total + '…'
            : '';

        let html =
            '<div class="verticalSection betterseerr-letterboxd-panel padded-left padded-right">' +
                '<div class="sectionTitleContainer sectionTitleContainer-cards">' +
                    '<h2 class="sectionTitle sectionTitle-cards">Letterboxd Watchlist</h2>' +
                '</div>' +
                '<div class="betterseerr-letterboxd-header">' +
                    '<form data-letterboxd-form>' +
                        '<div>' +
                            '<label for="betterseerr-letterboxd-username">Letterboxd username</label>' +
                            '<input id="betterseerr-letterboxd-username" type="text" autocomplete="username" ' +
                                'placeholder="your-letterboxd-username" value="' + escapeHtml(state.username) + '" ' +
                                (state.syncing || state.requesting ? 'disabled' : '') + ' />' +
                        '</div>' +
                        '<button type="submit" data-sync-submit ' +
                            (state.syncing || state.requesting ? 'disabled' : '') + '>' +
                            escapeHtml(getSyncButtonLabel()) +
                        '</button>' +
                    '</form>' +
                '</div>' +
                '<div class="betterseerr-letterboxd-help">Public Letterboxd watchlists only. Enter your username, get watchlist, select movies, then request them in bulk.</div>';

        if (lastError) {
            html += '<div class="betterseerr-letterboxd-error">' + escapeHtml(lastError) + '</div>';
        }

        if (state.syncing) {
            html += '<div class="betterseerr-loading-row">Loading watchlist…</div>';
        } else if (lastSynced || hasWatchlist) {
            html +=
                '<div class="betterseerr-letterboxd-meta">' +
                    '<span>Last synced: <strong>' + escapeHtml(formatDate(lastSynced)) + '</strong></span>' +
                    '<span>Gotten: <strong>' + escapeHtml(String(resolvedCount)) + '</strong></span>' +
                    (unresolvedCount ? '<span>Unresolved: <strong>' + escapeHtml(String(unresolvedCount)) + '</strong></span>' : '') +
                '</div>';
        }

        if (showToolbar) {
            html +=
                '<div class="betterseerr-letterboxd-toolbar">' +
                    '<div class="betterseerr-letterboxd-toolbar-actions">' +
                        '<button type="button" class="betterseerr-letterboxd-toolbar-btn" data-select-all>Select all</button>' +
                        '<button type="button" class="betterseerr-letterboxd-toolbar-btn" data-select-none>Select none</button>' +
                    '</div>' +
                    '<span class="betterseerr-letterboxd-toolbar-separator" aria-hidden="true"></span>' +
                    '<span class="betterseerr-letterboxd-selected-count" data-selected-count>' + selectedCount + ' selected</span>' +
                '</div>';
        }

        html += '<div class="betterseerr-letterboxd-body"></div>';

        if (showToolbar) {
            html +=
                '<div class="betterseerr-letterboxd-actionbar' +
                    (state.requesting ? ' betterseerr-letterboxd-disabled' : '') + '">' +
                    (progressText ? '<div class="betterseerr-letterboxd-progress">' + escapeHtml(progressText) + '</div>' : '') +
                    '<button type="button" data-request-selected ' +
                        (selectedCount === 0 || state.requesting ? 'disabled' : '') + '>Request selected</button>' +
                '</div>';
        }

        html += '</div>';

        container.innerHTML = html;
        renderGrid(container);

        const form = container.querySelector('[data-letterboxd-form]');
        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                handleSync(container);
            });
        }
    }

    function renderGrid(container) {
        const body = container.querySelector('.betterseerr-letterboxd-body');
        if (!body) {
            return;
        }

        if (state.syncing) {
            body.innerHTML = '';
            return;
        }

        if (!state.items.length) {
            if (state.syncMeta?.lastSynced) {
                body.innerHTML = '<div class="betterseerr-empty-row">No resolved movies found in the last sync.</div>';
            } else {
                body.innerHTML = '<div class="betterseerr-empty-row">Enter your Letterboxd username and sync your watchlist.</div>';
            }
            return;
        }

        const plugin = getPlugin();
        if (!plugin || typeof plugin.createDiscoverCards !== 'function') {
            body.innerHTML = '<div class="betterseerr-empty-row">Plugin cards are not ready yet.</div>';
            return;
        }

        const renderCards = function () {
            const useBackdrop = typeof plugin.shouldUseBackdropThumbnails === 'function'
                ? plugin.shouldUseBackdropThumbnails()
                : false;
            const cardOptions = Object.assign({}, CARD_OPTIONS, {
                forceBackdrop: useBackdrop
            });
            const discoverItems = state.items.map(mapItemToDiscover).filter(function (item) {
                return item.Id;
            });
            const cardsHtml = plugin.createDiscoverCards(discoverItems, true, cardOptions);
            body.innerHTML =
                '<div class="betterseerr-grid-view">' +
                    '<div class="betterseerr-letterboxd-grid betterseerr-letterboxd-grid--' +
                        (useBackdrop ? 'landscape' : 'portrait') + '">' +
                        cardsHtml +
                    '</div>' +
                '</div>';

            // Wrap each card in a slot so selection chrome and request actions sit outside the poster.
            body.querySelectorAll('.betterseerr-discover-card').forEach(function (card) {
                const tmdbId = parseInt(card.getAttribute('data-tmdb-id'), 10);
                if (Number.isNaN(tmdbId)) {
                    return;
                }

                const slot = document.createElement('div');
                slot.className = 'betterseerr-letterboxd-card-slot';
                card.parentNode.insertBefore(slot, card);
                slot.appendChild(card);

                card.classList.add('betterseerr-letterboxd-card');
                if (state.selectedIds.has(tmdbId)) {
                    card.classList.add('is-selected');
                }
                if (state.requestedIds.has(tmdbId)) {
                    card.classList.add('is-requested');
                }
                card.setAttribute('aria-selected', state.selectedIds.has(tmdbId) ? 'true' : 'false');

                const posterArea = card.querySelector('.cardScalable') || card;

                const indicator = document.createElement('span');
                indicator.className = 'betterseerr-letterboxd-select-indicator';
                indicator.setAttribute('aria-hidden', 'true');
                indicator.innerHTML = '<span class="material-icons" aria-hidden="true">check</span>';
                posterArea.appendChild(indicator);

                const actions = document.createElement('div');
                actions.className = 'betterseerr-request-card-actions';
                actions.innerHTML =
                    '<button type="button" class="betterseerr-request-action-btn betterseerr-request-modal-btn" ' +
                        'aria-label="Open request modal" title="Open request modal">' +
                        '<span class="material-icons" aria-hidden="true">download</span>' +
                    '</button>';
                actions.querySelector('.betterseerr-request-modal-btn').addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (window.betterSeerrModal && typeof window.betterSeerrModal.open === 'function') {
                        window.betterSeerrModal.open(String(tmdbId), 'movie');
                    }
                });
                posterArea.appendChild(actions);

                if (state.requestedIds.has(tmdbId)) {
                    const badge = document.createElement('span');
                    badge.className = 'betterseerr-request-chip betterseerr-request-chip--processing';
                    badge.textContent = 'Requested';
                    slot.appendChild(badge);
                }

                card.addEventListener('click', function (event) {
                    if (event.target.closest('.betterseerr-request-card-actions')) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    toggleSelection(tmdbId, !state.selectedIds.has(tmdbId), container);
                });
            });

            if (useBackdrop && typeof plugin.hydrateDiscoverBackdropCards === 'function') {
                plugin.hydrateDiscoverBackdropCards(body);
            } else if (typeof plugin.initLazyImages === 'function') {
                plugin.initLazyImages(body);
            }
        };

        if (typeof plugin.loadDisplaySettings === 'function') {
            plugin.loadDisplaySettings().then(renderCards).catch(renderCards);
            return;
        }

        renderCards();
    }

    function toggleSelection(tmdbId, selected, container) {
        if (selected) {
            state.selectedIds.add(tmdbId);
        } else {
            state.selectedIds.delete(tmdbId);
        }
        updateSelectionUi(container);
    }

    function updateSelectionUi(container) {
        const selectedCount = state.selectedIds.size;
        const countEl = container.querySelector('[data-selected-count]');
        if (countEl) {
            countEl.textContent = selectedCount + ' selected';
        }

        const requestBtn = container.querySelector('[data-request-selected]');
        if (requestBtn) {
            requestBtn.disabled = selectedCount === 0 || state.requesting;
        }

        container.querySelectorAll('.betterseerr-discover-card.betterseerr-letterboxd-card').forEach(function (card) {
            if (!card) {
                return;
            }

            const tmdbId = parseInt(card.getAttribute('data-tmdb-id'), 10);
            const isSelected = state.selectedIds.has(tmdbId);
            card.classList.toggle('is-selected', isSelected);
            card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    function selectAll(container) {
        state.items.forEach(function (item) {
            const tmdbId = getTmdbId(item);
            if (tmdbId != null && !state.requestedIds.has(tmdbId)) {
                state.selectedIds.add(tmdbId);
            }
        });
        updateSelectionUi(container);
    }

    function selectNone(container) {
        state.selectedIds.clear();
        updateSelectionUi(container);
    }

    function validateUsername(username) {
        return USERNAME_PATTERN.test((username || '').trim());
    }

    function handleSync(container) {
        const input = container.querySelector('#betterseerr-letterboxd-username');
        const username = input ? input.value.trim() : state.username.trim();
        if (!validateUsername(username)) {
            Dashboard.alert('Enter a valid Letterboxd username.');
            return;
        }

        state.syncing = true;
        state.syncProgressPercent = 0;
        state.syncMeta = Object.assign({}, state.syncMeta || {}, { lastError: null });
        renderPanel(container);
        startSyncProgressPolling(container);

        syncWatchlist(username)
            .then(function () {
                state.selectedIds.clear();
            })
            .catch(function (err) {
                console.error('BetterSeerr Letterboxd sync:', err);
                const message = err?.responseJSON?.message || 'Could not sync Letterboxd watchlist.';
                state.syncMeta = Object.assign({}, state.syncMeta || {}, { lastError: message });
                Dashboard.alert(message);
            })
            .finally(function () {
                stopSyncProgressPolling();
                state.syncing = false;
                state.syncProgressPercent = 0;
                renderPanel(container);
            });
    }

    function closeBulkModal() {
        if (state.bulkRoot) {
            state.bulkRoot.remove();
            state.bulkRoot = null;
        }
    }

    function openBulkModal(container) {
        closeBulkModal();

        const wrapper = document.createElement('div');
        wrapper.className = 'bst-quality-wrapper';

        const backdrop = document.createElement('div');
        backdrop.className = 'bst-quality-backdrop';
        backdrop.addEventListener('click', closeBulkModal);

        const panel = document.createElement('div');
        panel.className = 'bst-quality-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');

        // Quality modes map to LetterboxdBulkRequestService.ResolveRequestOptionAsync.
        panel.innerHTML =
            '<div class="bst-quality-header">' +
                '<h3>Request selected movies</h3>' +
                '<button type="button" class="bst-quality-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="bst-quality-list">' +
                '<button type="button" class="bst-quality-option" data-quality-mode="singleProfile">' +
                    'Use one quality profile for all' +
                    '<span class="bst-quality-option-sub">Choose a single Radarr profile for every selected movie.</span>' +
                '</button>' +
                '<button type="button" class="bst-quality-option" data-quality-mode="highestAvailable">' +
                    'Highest quality for each' +
                    '<span class="bst-quality-option-sub">Use the highest released streaming quality recommendation per movie.</span>' +
                '</button>' +
                '<button type="button" class="bst-quality-option" data-quality-mode="mostCommon">' +
                    'Most common quality for each' +
                    '<span class="bst-quality-option-sub">Use the most common streaming quality recommendation per movie.</span>' +
                '</button>' +
                '<div data-profile-list hidden></div>' +
                '<div class="bst-quality-loading" data-bulk-summary hidden></div>' +
            '</div>';

        wrapper.appendChild(backdrop);
        wrapper.appendChild(panel);
        document.body.appendChild(wrapper);
        state.bulkRoot = wrapper;

        panel.querySelector('.bst-quality-close').addEventListener('click', closeBulkModal);

        panel.querySelectorAll('[data-quality-mode]').forEach(function (button) {
            button.addEventListener('click', function () {
                const mode = button.getAttribute('data-quality-mode');
                if (mode === 'singleProfile') {
                    showProfilePicker(panel, container);
                    return;
                }

                submitBulkRequest(container, {
                    QualityMode: mode,
                    TmdbIds: Array.from(state.selectedIds)
                }, panel);
            });
        });
    }

    function showProfilePicker(panel, container) {
        const list = panel.querySelector('[data-profile-list]');
        if (!list) {
            return;
        }

        list.hidden = false;
        list.innerHTML = '<div class="bst-quality-loading">Loading profiles…</div>';

        ApiClient.ajax({
            url: ApiClient.getUrl('BetterSeerrTabs/request-options/movie'),
            type: 'GET',
            dataType: 'json'
        }).then(function (options) {
            list.innerHTML = '';
            if (!options || !options.length) {
                list.innerHTML = '<div class="bst-quality-empty">No quality profiles available.</div>';
                return;
            }

            options.forEach(function (opt) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'bst-quality-option';
                const label = opt.profileName || 'Default';
                btn.innerHTML = escapeHtml(label) +
                    (opt.serverName ? '<span class="bst-quality-option-sub">' +
                        escapeHtml(opt.serverName + (opt.is4k ? ' · 4K' : '')) + '</span>' : '');

                btn.addEventListener('click', function () {
                    submitBulkRequest(container, {
                        QualityMode: 'singleProfile',
                        TmdbIds: Array.from(state.selectedIds),
                        ServerId: opt.serverId,
                        ProfileId: opt.profileId,
                        RootFolder: opt.rootFolder || null,
                        Is4k: !!opt.is4k
                    }, panel);
                });

                list.appendChild(btn);
            });
        }).catch(function (err) {
            console.error('BetterSeerr Letterboxd profiles:', err);
            list.innerHTML = '<div class="bst-quality-empty">Failed to load quality profiles.</div>';
        });
    }

    function submitBulkRequest(container, payload, panel) {
        state.requesting = true;
        state.requestProgress = {
            done: 0,
            total: payload.TmdbIds.length
        };
        renderPanel(container);

        if (panel) {
            const summary = panel.querySelector('[data-bulk-summary]');
            if (summary) {
                summary.hidden = false;
                summary.textContent = 'Submitting requests…';
            }
        }

        ApiClient.ajax({
            url: ApiClient.getUrl('BetterSeerrTabs/letterboxd/request'),
            type: 'POST',
            data: JSON.stringify(payload),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        }).then(function (result) {
            const results = result?.results || result?.Results || [];
            const requested = result?.requested || result?.Requested || 0;
            const skipped = result?.skipped || result?.Skipped || 0;
            const failed = result?.failed || result?.Failed || 0;

            results.forEach(function (item) {
                const tmdbId = parseInt(item.tmdbId || item.TmdbId, 10);
                const status = (item.status || item.Status || '').toLowerCase();
                // Treat skipped duplicates like successful requests in the UI.
                if (status === 'requested' || status === 'skipped') {
                    if (!Number.isNaN(tmdbId)) {
                        state.requestedIds.add(tmdbId);
                        state.selectedIds.delete(tmdbId);
                    }
                }
            });

            state.requestProgress.done = payload.TmdbIds.length;
            closeBulkModal();
            renderPanel(container);

            Dashboard.alert(
                'Bulk request complete. Requested: ' + requested +
                ', skipped: ' + skipped +
                ', failed: ' + failed + '.'
            );
        }).catch(function (err) {
            console.error('BetterSeerr Letterboxd bulk request:', err);
            Dashboard.alert(err?.responseJSON?.message || 'Bulk request failed.');
        }).finally(function () {
            state.requesting = false;
            renderPanel(container);
        });
    }

    function bindContainerEvents(container) {
        if (container.dataset.betterseerrLetterboxdBound === 'true') {
            return;
        }
        container.dataset.betterseerrLetterboxdBound = 'true';

        container.addEventListener('click', function (event) {
            if (event.target.closest('[data-select-all]')) {
                event.preventDefault();
                selectAll(container);
                return;
            }

            if (event.target.closest('[data-select-none]')) {
                event.preventDefault();
                selectNone(container);
                return;
            }

            if (event.target.closest('[data-request-selected]')) {
                event.preventDefault();
                if (state.selectedIds.size === 0 || state.requesting) {
                    return;
                }
                openBulkModal(container);
            }
        });
    }

    function mount(container) {
        bindContainerEvents(container);

        if (container.querySelector('.betterseerr-letterboxd-panel')) {
            return;
        }

        renderPanel(container);
    }

    function ensureMounted() {
        const container = findActiveContainer();
        if (container) {
            mount(container);
        }
    }

    function init() {
        if (typeof ApiClient === 'undefined') {
            setTimeout(init, 200);
            return;
        }

        window.__betterSeerrLetterboxdEnsureMounted = ensureMounted;
        document.addEventListener('viewshow', ensureMounted);
        ensureMounted();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
