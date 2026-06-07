'use strict';

(function () {
    if (window.__seerrFinLetterboxdInit) {
        return;
    }
    window.__seerrFinLetterboxdInit = true;

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
        requestProgressAppliedCount: 0,
        requestProgressPollTimer: null,
        bulkRoot: null
    };

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function getPlugin() {
        return window.seerrFinPlugin || null;
    }

    function findActiveContainer() {
        const all = document.querySelectorAll('.seerrfin-letterboxd-sections');
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
            url: ApiClient.getUrl('SeerrFin/letterboxd/sync/progress'),
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
            url: ApiClient.getUrl('SeerrFin/letterboxd/sync', { letterboxdUsername: username }),
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

    function getItemTitle(tmdbId) {
        for (let i = 0; i < state.items.length; i++) {
            if (getTmdbId(state.items[i]) === tmdbId) {
                return state.items[i].Name || state.items[i].name || '';
            }
        }

        return '';
    }

    function stopRequestProgressPolling() {
        if (state.requestProgressPollTimer) {
            clearInterval(state.requestProgressPollTimer);
            state.requestProgressPollTimer = null;
        }
    }

    function setRequestingUi(container, requesting) {
        state.requesting = requesting;

        const input = container.querySelector('#seerrfin-letterboxd-username');
        const syncBtn = container.querySelector('[data-sync-submit]');
        if (input) {
            input.disabled = requesting || state.syncing;
        }
        if (syncBtn) {
            syncBtn.disabled = requesting || state.syncing;
        }

        container.querySelectorAll('[data-select-all], [data-select-none]').forEach(function (button) {
            button.disabled = requesting;
        });

        const actionbar = container.querySelector('.seerrfin-letterboxd-actionbar');
        if (actionbar) {
            actionbar.classList.toggle('seerrfin-letterboxd-disabled', requesting);
        }

        updateSelectionUi(container);
    }

    function getBulkQualityLabel(item) {
        const profileName = item.profileName || item.ProfileName || '';
        const qualityLabel = item.qualityLabel || item.QualityLabel || '';
        if (profileName && qualityLabel && profileName !== qualityLabel) {
            return qualityLabel + ' · ' + profileName;
        }

        return profileName || qualityLabel || '';
    }

    function getBulkStatusLabel(status) {
        if (status === 'requested') {
            return 'Requested';
        }
        if (status === 'skipped') {
            return 'Already requested';
        }
        if (status === 'failed') {
            return 'Failed';
        }

        return 'Waiting';
    }

    function setBulkModalLocked(locked) {
        const closeBtn = state.bulkRoot?.querySelector('.bst-quality-close');
        const backdrop = state.bulkRoot?.querySelector('.bst-quality-backdrop');
        if (closeBtn) {
            closeBtn.disabled = locked;
            closeBtn.style.opacity = locked ? '0.4' : '';
            closeBtn.style.cursor = locked ? 'default' : '';
        }
        if (backdrop) {
            backdrop.style.pointerEvents = locked ? 'none' : '';
        }
    }

    function showBulkRequestProgressPanel(panel, payload) {
        const tmdbIds = payload.TmdbIds || [];
        panel.classList.add('bst-letterboxd-bulk-panel');
        const header = panel.querySelector('.bst-quality-header h3');
        if (header) {
            header.textContent = 'Requesting movies';
        }

        setBulkModalLocked(true);

        let subtitle = '';
        if (payload.QualityMode === 'singleProfile' && payload.ProfileName) {
            subtitle = 'Profile: ' + payload.ProfileName;
        } else if (payload.QualityMode === 'highestAvailable') {
            subtitle = 'Using highest released quality for each movie';
        } else if (payload.QualityMode === 'mostCommon') {
            subtitle = 'Using most common quality for each movie';
        }

        const list = panel.querySelector('.bst-quality-list');
        if (!list) {
            return;
        }

        // Build the request view once so polling can update rows without rerendering page.
        list.innerHTML =
            (subtitle ? '<div class="bst-letterboxd-bulk-subtitle">' + escapeHtml(subtitle) + '</div>' : '') +
            '<div class="bst-letterboxd-bulk-progress">' +
                '<div class="bst-letterboxd-bulk-progress-track">' +
                    '<div class="bst-letterboxd-bulk-progress-fill" data-bulk-progress-fill style="width:0%"></div>' +
                '</div>' +
                '<span class="bst-letterboxd-bulk-progress-count" data-bulk-progress-count>0 of ' + tmdbIds.length + '</span>' +
            '</div>' +
            '<div class="bst-letterboxd-bulk-items" data-bulk-items>' +
                tmdbIds.map(function (id) {
                    return '<div class="bst-letterboxd-bulk-item" data-bulk-item data-tmdb-id="' + id + '">' +
                        '<div class="bst-letterboxd-bulk-item-main">' +
                            '<span class="bst-letterboxd-bulk-item-title">' + escapeHtml(getItemTitle(id) || 'Movie') + '</span>' +
                            '<span class="bst-letterboxd-bulk-item-quality" data-bulk-quality></span>' +
                        '</div>' +
                        '<span class="bst-letterboxd-bulk-item-status" data-bulk-status>Waiting</span>' +
                    '</div>';
                }).join('') +
            '</div>' +
            '<button type="button" class="bst-quality-option bst-letterboxd-bulk-done" data-bulk-footer data-bulk-done hidden>Done</button>';

        const doneBtn = list.querySelector('[data-bulk-done]');
        if (doneBtn) {
            doneBtn.addEventListener('click', closeBulkModal);
        }
    }

    function updateBulkItemRow(panel, item) {
        const tmdbId = parseInt(item.tmdbId || item.TmdbId, 10);
        if (Number.isNaN(tmdbId)) {
            return;
        }

        const row = panel.querySelector('[data-bulk-item][data-tmdb-id="' + tmdbId + '"]');
        if (!row) {
            return;
        }

        const status = (item.status || item.Status || '').toLowerCase();
        row.classList.remove('is-active');
        row.classList.remove('is-requested', 'is-skipped', 'is-failed', 'is-waiting');
        row.classList.add('is-' + status);

        const qualityEl = row.querySelector('[data-bulk-quality]');
        if (qualityEl) {
            qualityEl.textContent = getBulkQualityLabel(item);
        }

        const statusEl = row.querySelector('[data-bulk-status]');
        if (statusEl) {
            statusEl.textContent = getBulkStatusLabel(status);
        }
    }

    function updateBulkRequestProgressModal(container, progress) {
        const panel = state.bulkRoot?.querySelector('.bst-quality-panel');
        if (!panel) {
            return;
        }

        const done = progress?.done ?? progress?.Done ?? 0;
        const total = progress?.total ?? progress?.Total ?? 0;
        const percent = progress?.percent ?? progress?.Percent ?? 0;
        const currentId = progress?.currentTmdbId ?? progress?.CurrentTmdbId ?? null;
        const completed = progress?.completed || progress?.Completed || [];

        const fill = panel.querySelector('[data-bulk-progress-fill]');
        if (fill) {
            fill.style.width = Math.max(0, Math.min(100, percent)) + '%';
        }

        const countEl = panel.querySelector('[data-bulk-progress-count]');
        if (countEl) {
            countEl.textContent = done + ' of ' + total;
        }

        panel.querySelectorAll('[data-bulk-item].is-active').forEach(function (row) {
            row.classList.remove('is-active');
            const statusEl = row.querySelector('[data-bulk-status]');
            if (statusEl && statusEl.textContent === 'Requesting…') {
                statusEl.textContent = 'Waiting';
            }
        });

        // Only show newly completed results since the last poll.
        for (let i = state.requestProgressAppliedCount; i < completed.length; i++) {
            const item = completed[i];
            updateBulkItemRow(panel, item);

            const tmdbId = parseInt(item.tmdbId || item.TmdbId, 10);
            const status = (item.status || item.Status || '').toLowerCase();
            if (!Number.isNaN(tmdbId)) {
                applyRequestResultToCard(container, tmdbId, status);
            }
        }

        state.requestProgressAppliedCount = completed.length;
        updateSelectionUi(container);

        if (currentId && done < total) {
            const row = panel.querySelector('[data-bulk-item][data-tmdb-id="' + currentId + '"]');
            if (row && !row.classList.contains('is-requested') &&
                !row.classList.contains('is-skipped') &&
                !row.classList.contains('is-failed')) {
                row.classList.add('is-active');
                const statusEl = row.querySelector('[data-bulk-status]');
                if (statusEl) {
                    statusEl.textContent = 'Requesting…';
                }
            }
        }
    }

    function showBulkRequestComplete(panel, requested, skipped, failed) {
        const header = panel.querySelector('.bst-quality-header h3');
        if (header) {
            header.textContent = 'Requests complete';
        }

        setBulkModalLocked(false);

        const fill = panel.querySelector('[data-bulk-progress-fill]');
        if (fill) {
            fill.style.width = '100%';
        }

        let subtitle = panel.querySelector('.bst-letterboxd-bulk-subtitle');
        if (!subtitle) {
            subtitle = document.createElement('div');
            subtitle.className = 'bst-letterboxd-bulk-subtitle';
            const list = panel.querySelector('.bst-quality-list');
            if (list) {
                list.insertBefore(subtitle, list.firstChild);
            }
        }

        subtitle.textContent = 'Requested: ' + requested + ', skipped: ' + skipped + ', failed: ' + failed;

        const footer = panel.querySelector('[data-bulk-footer]');
        if (footer) {
            footer.hidden = false;
        }
    }

    function showBulkRequestError(panel, message) {
        const header = panel.querySelector('.bst-quality-header h3');
        if (header) {
            header.textContent = 'Request failed';
        }

        setBulkModalLocked(false);

        let subtitle = panel.querySelector('.bst-letterboxd-bulk-subtitle');
        if (!subtitle) {
            subtitle = document.createElement('div');
            subtitle.className = 'bst-letterboxd-bulk-subtitle bst-letterboxd-bulk-subtitle--error';
            const list = panel.querySelector('.bst-quality-list');
            if (list) {
                list.insertBefore(subtitle, list.firstChild);
            }
        }

        subtitle.textContent = message;

        const footer = panel.querySelector('[data-bulk-footer]');
        if (footer) {
            footer.hidden = false;
        }
    }

    function applyRequestResultToCard(container, tmdbId, status) {
        const card = container.querySelector('.seerrfin-discover-card[data-tmdb-id="' + tmdbId + '"]');
        if (!card) {
            return;
        }

        if (status === 'requested' || status === 'skipped') {
            state.requestedIds.add(tmdbId);
            state.selectedIds.delete(tmdbId);
            card.classList.remove('is-selected');
            card.setAttribute('aria-selected', 'false');
        }
    }

    function applyCompletedResults(container, completed, fromIndex) {
        const panel = state.bulkRoot?.querySelector('.bst-quality-panel');
        for (let i = fromIndex; i < completed.length; i++) {
            const item = completed[i];
            const tmdbId = parseInt(item.tmdbId || item.TmdbId, 10);
            const status = (item.status || item.Status || '').toLowerCase();
            if (panel) {
                updateBulkItemRow(panel, item);
            }
            if (!Number.isNaN(tmdbId)) {
                applyRequestResultToCard(container, tmdbId, status);
            }
        }

        state.requestProgressAppliedCount = completed.length;
        updateSelectionUi(container);
    }

    function pollRequestProgress(container) {
        ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/letterboxd/request/progress'),
            type: 'GET',
            dataType: 'json'
        }).then(function (result) {
            const isActive = result?.isActive ?? result?.IsActive ?? false;
            if (!isActive) {
                return;
            }

            updateBulkRequestProgressModal(container, result);
        }).catch(function () {
            // Ignore polling errors
        });
    }

    function startRequestProgressPolling(container) {
        stopRequestProgressPolling();
        state.requestProgressAppliedCount = 0;
        pollRequestProgress(container);
        state.requestProgressPollTimer = setInterval(function () {
            pollRequestProgress(container);
        }, 400);
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

    function updatePanelErrorBar(container, message) {
        let errorEl = container.querySelector('.seerrfin-letterboxd-error');
        if (message) {
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.className = 'seerrfin-letterboxd-error';
                const help = container.querySelector('.seerrfin-letterboxd-help');
                if (help) {
                    help.insertAdjacentElement('afterend', errorEl);
                }
            }
            errorEl.textContent = message;
            return;
        }

        if (errorEl) {
            errorEl.remove();
        }
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

        let html =
            '<div class="verticalSection seerrfin-letterboxd-panel padded-left padded-right">' +
                '<div class="sectionTitleContainer sectionTitleContainer-cards">' +
                    '<h2 class="sectionTitle sectionTitle-cards">Letterboxd Watchlist</h2>' +
                '</div>' +
                '<div class="seerrfin-letterboxd-header">' +
                    '<form data-letterboxd-form>' +
                        '<div>' +
                            '<label for="seerrfin-letterboxd-username">Letterboxd username</label>' +
                            '<input id="seerrfin-letterboxd-username" type="text" autocomplete="username" ' +
                                'placeholder="your-letterboxd-username" value="' + escapeHtml(state.username) + '" ' +
                                (state.syncing || state.requesting ? 'disabled' : '') + ' />' +
                        '</div>' +
                        '<button type="submit" data-sync-submit ' +
                            (state.syncing || state.requesting ? 'disabled' : '') + '>' +
                            escapeHtml(getSyncButtonLabel()) +
                        '</button>' +
                    '</form>' +
                '</div>' +
                '<div class="seerrfin-letterboxd-help">Public Letterboxd watchlists only. Enter your username, get watchlist, select movies, then request them in bulk.</div>';

        if (lastError) {
            html += '<div class="seerrfin-letterboxd-error">' + escapeHtml(lastError) + '</div>';
        }

        if (state.syncing) {
            html += '<div class="seerrfin-loading-row">Loading watchlist…</div>';
        } else if (lastSynced || hasWatchlist) {
            html +=
                '<div class="seerrfin-letterboxd-meta">' +
                    '<span>Last synced: <strong>' + escapeHtml(formatDate(lastSynced)) + '</strong></span>' +
                    '<span>Gotten: <strong>' + escapeHtml(String(resolvedCount)) + '</strong></span>' +
                    (unresolvedCount ? '<span>Unresolved: <strong>' + escapeHtml(String(unresolvedCount)) + '</strong></span>' : '') +
                '</div>';
        }

        if (showToolbar) {
            html +=
                '<div class="seerrfin-letterboxd-toolbar">' +
                    '<div class="seerrfin-letterboxd-toolbar-actions">' +
                        '<button type="button" class="seerrfin-letterboxd-toolbar-btn" data-select-all>Select all</button>' +
                        '<button type="button" class="seerrfin-letterboxd-toolbar-btn" data-select-none>Select none</button>' +
                    '</div>' +
                    '<span class="seerrfin-letterboxd-toolbar-separator" aria-hidden="true"></span>' +
                    '<span class="seerrfin-letterboxd-selected-count" data-selected-count>' + selectedCount + ' selected</span>' +
                '</div>';
        }

        html += '<div class="seerrfin-letterboxd-body"></div>';

        if (showToolbar) {
            html +=
                '<div class="seerrfin-letterboxd-actionbar' +
                    (state.requesting ? ' seerrfin-letterboxd-disabled' : '') + '">' +
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
        const body = container.querySelector('.seerrfin-letterboxd-body');
        if (!body) {
            return;
        }

        if (state.syncing) {
            body.innerHTML = '';
            return;
        }

        if (!state.items.length) {
            body.innerHTML = '';
            return;
        }

        const plugin = getPlugin();
        if (!plugin || typeof plugin.createDiscoverCards !== 'function') {
            body.innerHTML = '';
            updatePanelErrorBar(container, 'Plugin cards are not ready yet.');
            return;
        }

        updatePanelErrorBar(container, state.syncMeta?.lastError || null);

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
                '<div class="seerrfin-grid-view">' +
                    '<div class="seerrfin-letterboxd-grid seerrfin-letterboxd-grid--' +
                        (useBackdrop ? 'landscape' : 'portrait') + '">' +
                        cardsHtml +
                    '</div>' +
                '</div>';

            // Wrap each card in a slot so selection chrome and request actions sit outside the poster.
            body.querySelectorAll('.seerrfin-discover-card').forEach(function (card) {
                const tmdbId = parseInt(card.getAttribute('data-tmdb-id'), 10);
                if (Number.isNaN(tmdbId)) {
                    return;
                }

                const slot = document.createElement('div');
                slot.className = 'seerrfin-letterboxd-card-slot';
                card.parentNode.insertBefore(slot, card);
                slot.appendChild(card);

                card.classList.add('seerrfin-letterboxd-card');
                if (state.selectedIds.has(tmdbId)) {
                    card.classList.add('is-selected');
                }
                card.setAttribute('aria-selected', state.selectedIds.has(tmdbId) ? 'true' : 'false');

                const posterArea = card.querySelector('.cardScalable') || card;

                const indicator = document.createElement('span');
                indicator.className = 'seerrfin-letterboxd-select-indicator';
                indicator.setAttribute('aria-hidden', 'true');
                indicator.innerHTML = '<span class="material-icons" aria-hidden="true">check</span>';
                posterArea.appendChild(indicator);

                const actions = document.createElement('div');
                actions.className = 'seerrfin-request-card-actions';
                actions.innerHTML =
                    '<button type="button" class="seerrfin-request-action-btn seerrfin-request-modal-btn" ' +
                        'aria-label="Open request modal" title="Open request modal">' +
                        '<span class="material-icons" aria-hidden="true">download</span>' +
                    '</button>';
                actions.querySelector('.seerrfin-request-modal-btn').addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (window.seerrFinModal && typeof window.seerrFinModal.open === 'function') {
                        window.seerrFinModal.open(String(tmdbId), 'movie');
                    }
                });
                posterArea.appendChild(actions);

                card.addEventListener('click', function (event) {
                    if (event.target.closest('.seerrfin-request-card-actions')) {
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
        if (state.requesting) {
            return;
        }

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

        container.querySelectorAll('.seerrfin-discover-card.seerrfin-letterboxd-card').forEach(function (card) {
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
        if (state.requesting) {
            return;
        }

        state.items.forEach(function (item) {
            const tmdbId = getTmdbId(item);
            if (tmdbId != null && !state.requestedIds.has(tmdbId)) {
                state.selectedIds.add(tmdbId);
            }
        });
        updateSelectionUi(container);
    }

    function selectNone(container) {
        if (state.requesting) {
            return;
        }

        state.selectedIds.clear();
        updateSelectionUi(container);
    }

    function validateUsername(username) {
        return USERNAME_PATTERN.test((username || '').trim());
    }

    function handleSync(container) {
        const input = container.querySelector('#seerrfin-letterboxd-username');
        const username = input ? input.value.trim() : state.username.trim();
        if (!validateUsername(username)) {
            state.syncMeta = Object.assign({}, state.syncMeta || {}, {
                lastError: 'Enter a valid Letterboxd username.'
            });
            updatePanelErrorBar(container, state.syncMeta.lastError);
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
                console.error('SeerrFin Letterboxd sync:', err);
                const message = err?.responseJSON?.message || 'Could not sync Letterboxd watchlist.';
                state.syncMeta = Object.assign({}, state.syncMeta || {}, { lastError: message });
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

    function createBulkModalShell(title) {
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
        panel.innerHTML =
            '<div class="bst-quality-header">' +
                '<h3>' + escapeHtml(title) + '</h3>' +
                '<button type="button" class="bst-quality-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="bst-quality-list"></div>';

        wrapper.appendChild(backdrop);
        wrapper.appendChild(panel);
        document.body.appendChild(wrapper);
        state.bulkRoot = wrapper;

        panel.querySelector('.bst-quality-close').addEventListener('click', closeBulkModal);

        return panel;
    }

    function getSelectedTmdbIds() {
        return Array.from(state.selectedIds);
    }

    function mergeAlreadyRequestedIds(apiIds, selectedIds) {
        const merged = new Set();
        // Mix server state with ids requested during this page session.
        (apiIds || []).forEach(function (id) {
            merged.add(parseInt(id, 10));
        });
        selectedIds.forEach(function (id) {
            if (state.requestedIds.has(id)) {
                merged.add(id);
            }
        });
        return Array.from(merged).filter(function (id) {
            return !Number.isNaN(id);
        });
    }

    function checkAlreadyRequested(tmdbIds) {
        return ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/letterboxd/request/check'),
            type: 'POST',
            data: JSON.stringify({ TmdbIds: tmdbIds }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        }).then(function (result) {
            const apiIds = result?.tmdbIds || result?.TmdbIds || [];
            return mergeAlreadyRequestedIds(apiIds, tmdbIds);
        });
    }

    function removeSelectedIds(tmdbIds) {
        tmdbIds.forEach(function (id) {
            state.selectedIds.delete(id);
        });
    }

    function showQualitySelection(panel, container, tmdbIds) {
        if (!tmdbIds.length) {
            return;
        }

        panel.classList.remove('bst-letterboxd-bulk-panel');
        const header = panel.querySelector('.bst-quality-header h3');
        if (header) {
            header.textContent = 'Request selected movies';
        }

        const list = panel.querySelector('.bst-quality-list');
        if (!list) {
            return;
        }

        // Keep this batch fixed while user goes through modal.
        list.innerHTML =
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
            '<div data-profile-list hidden></div>';

        panel.querySelectorAll('[data-quality-mode]').forEach(function (button) {
            button.addEventListener('click', function () {
                const mode = button.getAttribute('data-quality-mode');
                if (mode === 'singleProfile') {
                    showProfilePicker(panel, container, tmdbIds);
                    return;
                }

                submitBulkRequest(container, {
                    QualityMode: mode,
                    TmdbIds: tmdbIds.slice()
                }, panel);
            });
        });
    }

    function showAlreadyRequestedPrompt(panel, container, alreadyRequestedIds, selectedIds) {
        const header = panel.querySelector('.bst-quality-header h3');
        if (header) {
            header.textContent = 'Already requested';
        }

        const list = panel.querySelector('.bst-quality-list');
        if (!list) {
            return;
        }

        const count = alreadyRequestedIds.length;
        const total = selectedIds.length;
        list.innerHTML =
            '<div class="bst-letterboxd-bulk-subtitle">' +
                escapeHtml(count + ' of ' + total + ' selected ' +
                    (count === 1 ? 'movie already has a request' : 'movies already have requests') + '.') +
            '</div>' +
            '<div class="bst-letterboxd-bulk-items bst-letterboxd-bulk-items--prompt">' +
                alreadyRequestedIds.map(function (id) {
                    return '<div class="bst-letterboxd-bulk-item is-skipped">' +
                        '<div class="bst-letterboxd-bulk-item-main">' +
                            '<span class="bst-letterboxd-bulk-item-title">' +
                                escapeHtml(getItemTitle(id) || 'Movie') +
                            '</span>' +
                        '</div>' +
                        '<span class="bst-letterboxd-bulk-item-status">Already requested</span>' +
                    '</div>';
                }).join('') +
            '</div>' +
            '<button type="button" class="bst-quality-option" data-skip-requested>' +
                'Skip them and continue' +
                '<span class="bst-quality-option-sub">Request only the ' +
                    (total - count) + ' remaining ' +
                    (total - count === 1 ? 'movie' : 'movies') + '.</span>' +
            '</button>' +
            '<button type="button" class="bst-quality-option" data-request-all>' +
                'Request all anyway' +
                '<span class="bst-quality-option-sub">Include already requested movies in this batch.</span>' +
            '</button>' +
            '<button type="button" class="bst-quality-option bst-letterboxd-bulk-cancel" data-cancel-request>Cancel</button>';

        list.querySelector('[data-skip-requested]').addEventListener('click', function () {
            const remaining = selectedIds.filter(function (id) {
                return alreadyRequestedIds.indexOf(id) === -1;
            });

            removeSelectedIds(alreadyRequestedIds);
            updateSelectionUi(container);

            if (!remaining.length) {
                list.innerHTML = '<div class="bst-quality-empty">No movies left to request.</div>';
                return;
            }

            showQualitySelection(panel, container, remaining);
        });

        list.querySelector('[data-request-all]').addEventListener('click', function () {
            showQualitySelection(panel, container, selectedIds.slice());
        });

        list.querySelector('[data-cancel-request]').addEventListener('click', closeBulkModal);
    }

    function openBulkModal(container) {
        const selectedIds = getSelectedTmdbIds();
        if (!selectedIds.length) {
            return;
        }

        const panel = createBulkModalShell('Checking selections…');
        const list = panel.querySelector('.bst-quality-list');
        if (list) {
            list.innerHTML = '<div class="bst-quality-loading">Checking for existing requests…</div>';
        }

        checkAlreadyRequested(selectedIds)
            .then(function (alreadyRequestedIds) {
                if (alreadyRequestedIds.length > 0) {
                    showAlreadyRequestedPrompt(panel, container, alreadyRequestedIds, selectedIds);
                    return;
                }

                showQualitySelection(panel, container, selectedIds);
            })
            .catch(function (err) {
                console.error('SeerrFin Letterboxd request check:', err);
                if (list) {
                    list.innerHTML = '<div class="bst-quality-empty">Could not check existing requests.</div>';
                }
            });
    }

    function showProfilePicker(panel, container, tmdbIds) {
        const list = panel.querySelector('[data-profile-list]');
        if (!list) {
            return;
        }

        list.hidden = false;
        list.innerHTML = '<div class="bst-quality-loading">Loading profiles…</div>';

        ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/request-options/movie'),
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
                        TmdbIds: tmdbIds.slice(),
                        ServerId: opt.serverId,
                        ProfileId: opt.profileId,
                        RootFolder: opt.rootFolder || null,
                        Is4k: !!opt.is4k,
                        ProfileName: label
                    }, panel);
                });

                list.appendChild(btn);
            });
        }).catch(function (err) {
            console.error('SeerrFin Letterboxd profiles:', err);
            list.innerHTML = '<div class="bst-quality-empty">Failed to load quality profiles.</div>';
        });
    }

    function submitBulkRequest(container, payload, panel) {
        if (!panel) {
            return;
        }

        state.requestProgressAppliedCount = 0;
        setRequestingUi(container, true);
        showBulkRequestProgressPanel(panel, payload);
        startRequestProgressPolling(container);

        ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/letterboxd/request'),
            type: 'POST',
            data: JSON.stringify(payload),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        }).then(function (result) {
            const results = result?.results || result?.Results || [];
            const requested = result?.requested || result?.Requested || 0;
            const skipped = result?.skipped || result?.Skipped || 0;
            const failed = result?.failed || result?.Failed || 0;

            applyCompletedResults(container, results, state.requestProgressAppliedCount);
            showBulkRequestComplete(panel, requested, skipped, failed);
        }).catch(function (err) {
            console.error('SeerrFin Letterboxd bulk request:', err);
            showBulkRequestError(panel, err?.responseJSON?.message || 'Bulk request failed.');
        }).finally(function () {
            stopRequestProgressPolling();
            setRequestingUi(container, false);
        });
    }

    function bindContainerEvents(container) {
        if (container.dataset.seerrfinLetterboxdBound === 'true') {
            return;
        }
        container.dataset.seerrfinLetterboxdBound = 'true';

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

        if (container.querySelector('.seerrfin-letterboxd-panel')) {
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

        window.__seerrFinLetterboxdEnsureMounted = ensureMounted;
        document.addEventListener('viewshow', ensureMounted);
        ensureMounted();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
