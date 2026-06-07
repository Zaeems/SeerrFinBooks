'use strict';

(function () {
    const TMDB_LOGO_SVG = '<svg width="2em" height="2em" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190.24 81.52"><defs><linearGradient id="bst-tmdb-grad" y1="40.76" x2="190.24" y2="40.76" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#90cea1"/><stop offset="0.56" stop-color="#3cbec9"/><stop offset="1" stop-color="#00b3e5"/></linearGradient></defs><path fill="url(#bst-tmdb-grad)" d="M105.67,36.06h66.9A17.67,17.67,0,0,0,190.24,18.4h0A17.67,17.67,0,0,0,172.57.73h-66.9A17.67,17.67,0,0,0,88,18.4h0A17.67,17.67,0,0,0,105.67,36.06Zm-88,45h76.9A17.67,17.67,0,0,0,112.24,63.4h0A17.67,17.67,0,0,0,94.57,45.73H17.67A17.67,17.67,0,0,0,0,63.4H0A17.67,17.67,0,0,0,17.67,81.06ZM10.41,35.42h7.8V6.92h10.1V0H.31v6.9h10.1Zm28.1,0h7.8V8.25h.1l9,27.15h6l9.3-27.15h.1V35.4h7.8V0H66.76l-8.2,23.1h-.1L50.31,0H38.51ZM152.43,55.67a15.07,15.07,0,0,0-4.52-5.52,18.57,18.57,0,0,0-6.68-3.08,33.54,33.54,0,0,0-8.07-1h-11.7v35.4h12.75a24.58,24.58,0,0,0,7.55-1.15A19.34,19.34,0,0,0,148.11,77a16.27,16.27,0,0,0,4.37-5.5,16.91,16.91,0,0,0,1.63-7.58A18.5,18.5,0,0,0,152.43,55.67ZM145,68.6A8.8,8.8,0,0,1,142.36,72a10.7,10.7,0,0,1-4,1.82,21.57,21.57,0,0,1-5,.55h-4.05v-21h4.6a17,17,0,0,1,4.67.63,11.66,11.66,0,0,1,3.88,1.87A9.14,9.14,0,0,1,145,59a9.87,9.87,0,0,1,1,4.52A11.89,11.89,0,0,1,145,68.6Zm44.63-.13a8,8,0,0,0-1.58-2.62A8.38,8.38,0,0,0,185.63,64a10.31,10.31,0,0,0-3.17-1v-.1a9.22,9.22,0,0,0,4.42-2.82,7.43,7.43,0,0,0,1.68-5,8.42,8.42,0,0,0-1.15-4.65,8.09,8.09,0,0,0-3-2.72,12.56,12.56,0,0,0-4.18-1.3,32.84,32.84,0,0,0-4.62-.33h-13.2v35.4h14.5a22.41,22.41,0,0,0,4.72-.5,13.53,13.53,0,0,0,4.28-1.65,9.42,9.42,0,0,0,3.1-3,8.52,8.52,0,0,0,1.2-4.68A9.39,9.39,0,0,0,189.66,68.47ZM170.21,52.72h5.3a10,10,0,0,1,1.85.18,6.18,6.18,0,0,1,1.7.57,3.39,3.39,0,0,1,1.22,1.13,3.22,3.22,0,0,1,.48,1.82,3.63,3.63,0,0,1-.43,1.8,3.4,3.4,0,0,1-1.12,1.2,4.92,4.92,0,0,1-1.58.65,7.51,7.51,0,0,1-1.77.2h-5.65Zm11.72,20a3.9,3.9,0,0,1-1.22,1.3,4.64,4.64,0,0,1-1.68.7,8.18,8.18,0,0,1-1.82.2h-7v-8h5.9a15.35,15.35,0,0,1,2,.15,8.47,8.47,0,0,1,2.05.55,4,4,0,0,1,1.57,1.18,3.11,3.11,0,0,1,.63,2A3.71,3.71,0,0,1,181.93,72.72Z"/></svg>';
    const CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 320 512"><path fill="currentColor" d="M310.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L160 210.7 54.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L114.7 256 9.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 301.3 265.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L205.3 256 310.6 150.6z"/></svg>';
    const IMDB_ICON = '<svg width="2em" height="2em" fill="currentColor" viewBox="0 0 32 32"><path d="M8.4,21.1H5.9V9.9h3.8l0.7,4.7h0.1L11,9.9h3.8v11.2h-2.5v-6.7h-0.1l-0.9,6.7H9.4l-1-6.7h0L8.4,21.1z"/><path d="M15.8,9.8c0.4,0,3.2-0.1,4.7,0.1c1.2,0.1,1.8,1.1,1.9,2.3c0.1,2.2,0.1,4.4,0.1,6.6c0,0.2,0,0.5-0.1,0.8c-0.2,0.9-0.7,1.4-1.9,1.5c-1.5,0.1-3,0.1-4.4,0.1c0,0-0.1,0-0.2,0V9.8z M18.8,11.9v7.2c0.5,0,0.8-0.2,0.8-0.7c0-1.9,0-3.9,0-5.9C19.6,12,19.4,11.8,18.8,11.9z"/><path d="M2,21.1V9.9h2.9v11.2H2z"/><path d="M29.9,14.1c-0.1-0.8-0.6-1.2-1.4-1.4c-0.8-0.1-1.6,0-2.3,0.7V9.9h-2.8v11.2H26c0.1-0.2,0.1-0.4,0.2-0.5c0.1,0.1,0.2,0.2,0.3,0.3c0.7,0.5,1.5,0.6,2.3,0.3c0.7-0.3,1-0.9,1-1.6c0-0.8,0.1-1.7,0.1-2.6C30,16,30,15,29.9,14.1z M27.1,19.1c0,0.2-0.2,0.4-0.4,0.4s-0.4-0.2-0.4-0.4v-4.3c0-0.2,0.2-0.4,0.4-0.4s0.4,0.2,0.4,0.4V19.1z"/></svg>';

    let activeDetailsRoot = null;
    let activeSeasonRoot = null;
    let activeQualityRoot = null;
    let escapeHandler = null;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function tmdbImage(path, size) {
        if (!path) {
            return '';
        }
        return 'https://image.tmdb.org/t/p/' + (size || 'original') + path;
    }

    const PLUGIN_ID = 'c8e4f2a1-9b3d-4e7f-a6c2-1d5e8f0a3b7c';

    function getLogoImageUrl(data) {
        const rawPath = data && (data.logoPath || data.logo_path);
        if (!rawPath) {
            return '';
        }
        return rawPath.startsWith('http') ? rawPath : tmdbImage(rawPath, 'original');
    }

    function getTmdbApiKey(config) {
        const key = config && (config.tmdbApiKey || config.TmdbApiKey);
        return key && String(key).trim() ? String(key).trim() : '';
    }

    function isEnglishLogo(logo) {
        return logo && String(logo.iso_639_1 || '').toLowerCase() === 'en';
    }

    function isEnUsLogo(logo) {
        return isEnglishLogo(logo) && String(logo.iso_3166_1 || '').toUpperCase() === 'US';
    }

    function pickLogoFilePath(logos) {
        if (!logos || !logos.length) {
            return null;
        }

        const valid = logos.filter(function (logo) {
            return logo && logo.file_path;
        });

        if (!valid.length) {
            return null;
        }

        function byVote(a, b) {
            return (b.vote_average || 0) - (a.vote_average || 0) ||
                (b.width || 0) - (a.width || 0);
        }

        // Prioritize getting English logos over en-US. Fallbacks to highest rated logo (not locale specific)
        const english = valid
            .filter(function (logo) { return isEnglishLogo(logo) && !isEnUsLogo(logo); })
            .sort(byVote)[0];
        if (english) {
            return english.file_path;
        }

        const enUs = valid
            .filter(isEnUsLogo)
            .sort(byVote)[0];
        if (enUs) {
            return enUs.file_path;
        }

        return valid.sort(byVote)[0].file_path;
    }

    function isTmdbBearerToken(apiKey) {
        // v4 read tokens are JWTs, while v3 keys are plain strings.
        const parts = String(apiKey).split('.');
        return parts.length === 3;
    }

    function appendTmdbQuery(url, name, value) {
        return url + (url.indexOf('?') >= 0 ? '&' : '?') +
            encodeURIComponent(name) + '=' + encodeURIComponent(value);
    }

    function fetchTmdbJson(url, apiKey) {
        const headers = { accept: 'application/json' };
        let requestUrl = url;

        if (isTmdbBearerToken(apiKey)) {
            headers.Authorization = 'Bearer ' + apiKey;
        } else {
            requestUrl = appendTmdbQuery(url, 'api_key', apiKey);
        }

        return fetch(requestUrl, { headers: headers }).then(function (response) {
            if (!response.ok) {
                throw new Error('TMDB request failed: ' + response.status);
            }
            return response.json();
        });
    }

    function mapMovieDetails(raw) {
        const details = {
            id: raw.id,
            mediaType: 'movie',
            title: raw.title,
            overview: raw.overview,
            backdropPath: raw.backdrop_path,
            posterPath: raw.poster_path,
            voteAverage: raw.vote_average,
            voteCount: raw.vote_count,
            releaseDate: raw.release_date,
            runtime: raw.runtime,
            originalLanguage: raw.original_language,
            adult: raw.adult,
            genres: raw.genres || [],
            credits: raw.credits || {},
            releaseDates: raw.release_dates || {}
        };

        if (raw.videos && raw.videos.results) {
            details.relatedVideos = raw.videos.results;
        }

        if (raw.external_ids) {
            details.externalIds = { imdbId: raw.external_ids.imdb_id };
        }

        return details;
    }

    function mapTvDetails(raw) {
        const details = {
            id: raw.id,
            mediaType: 'tv',
            name: raw.name,
            overview: raw.overview,
            backdropPath: raw.backdrop_path,
            posterPath: raw.poster_path,
            voteAverage: raw.vote_average,
            voteCount: raw.vote_count,
            firstAirDate: raw.first_air_date,
            episodeRunTime: raw.episode_run_time || [],
            originalLanguage: raw.original_language,
            genres: raw.genres || [],
            credits: raw.credits || {},
            contentRatings: raw.content_ratings || {}
        };

        if (raw.videos && raw.videos.results) {
            details.relatedVideos = raw.videos.results;
        }

        if (raw.external_ids) {
            details.externalIds = { imdbId: raw.external_ids.imdb_id };
        }

        return details;
    }

    function fetchTmdbLogoPath(mediaId, mediaType, apiKey) {
        const segment = mediaType === 'tv' ? 'tv' : 'movie';
        const base = 'https://api.themoviedb.org/3/' + segment + '/' + mediaId + '/images';
        const filteredUrl = appendTmdbQuery(base, 'include_image_language', 'en,null,en-US');

        return fetchTmdbJson(filteredUrl, apiKey)
            .then(function (payload) {
                let path = pickLogoFilePath(payload.logos);
                if (path) {
                    return path;
                }
                // If no English logo in filtered set, retry with all languages
                return fetchTmdbJson(base, apiKey).then(function (all) {
                    return pickLogoFilePath(all.logos);
                });
            })
            .catch(function (err) {
                console.warn('SeerrFin: TMDB logo fetch failed', err);
                return null;
            });
    }

    function fetchTmdbDetailsFromBrowser(mediaId, mediaType, apiKey) {
        const isTv = mediaType === 'tv';
        const segment = isTv ? 'tv' : 'movie';
        const append = isTv
            ? 'videos,credits,content_ratings,external_ids'
            : 'videos,credits,release_dates,external_ids';
        let detailsUrl = 'https://api.themoviedb.org/3/' + segment + '/' + mediaId;
        detailsUrl = appendTmdbQuery(detailsUrl, 'append_to_response', append);

        return Promise.all([
            fetchTmdbJson(detailsUrl, apiKey),
            fetchTmdbLogoPath(mediaId, mediaType, apiKey)
        ]).then(function (results) {
            const raw = results[0];
            const logoPath = results[1];
            const mapped = isTv ? mapTvDetails(raw) : mapMovieDetails(raw);
            if (logoPath) {
                mapped.logoPath = logoPath;
            }
            return mapped;
        }).catch(function (err) {
            console.warn('SeerrFin: TMDB details fetch failed', err);
            return null;
        });
    }

    function mergeJellyseerrOverlay(tmdbDetails, jellyseerrDetails) {
        if (!jellyseerrDetails) {
            return tmdbDetails;
        }

        // Tmdb gives rich metadata. Seer adds request/availability
        if (jellyseerrDetails.mediaInfo) {
            tmdbDetails.mediaInfo = jellyseerrDetails.mediaInfo;
        }

        ['mediaAdded', 'status', 'status4k', 'inProduction'].forEach(function (key) {
            if (jellyseerrDetails[key] !== undefined && jellyseerrDetails[key] !== null) {
                tmdbDetails[key] = jellyseerrDetails[key];
            }
        });

        return tmdbDetails;
    }

    function fetchJustWatchQualities(mediaId, mediaType) {
        return ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/justwatch/qualities/' + mediaType + '/' + mediaId),
            type: 'GET',
            dataType: 'json'
        }).catch(function (err) {
            if (err && err.status === 404) {
                return null;
            }
            console.warn('SeerrFin: JustWatch qualities fetch failed', err);
            return null;
        });
    }

    function buildJustWatchQualityLines(mediaId, mediaType) {
        const qualityLines = document.createElement('div');
        qualityLines.className = 'bst-sidebar-lines bst-sidebar-lines--qualities';
        qualityLines.hidden = true;

        const highestLine = document.createElement('div');
        highestLine.innerHTML = '<span class="bst-label">Highest released quality:</span> <span class="bst-quality-value">…</span>';
        qualityLines.appendChild(highestLine);

        const commonLine = document.createElement('div');
        commonLine.innerHTML = '<span class="bst-label">Most common quality:</span> <span class="bst-quality-value">…</span>';
        qualityLines.appendChild(commonLine);

        fetchJustWatchQualities(mediaId, mediaType).then(function (result) {
            if (!result) {
                qualityLines.remove();
                return;
            }

            const highestValue = highestLine.querySelector('.bst-quality-value');
            const commonValue = commonLine.querySelector('.bst-quality-value');
            highestValue.textContent =
                result.highestReleasedQuality || result.HighestReleasedQuality || 'Unknown';
            commonValue.textContent =
                result.mostCommonQuality || result.MostCommonQuality || 'Unknown';
            qualityLines.hidden = false;
        });

        return qualityLines;
    }

    function fetchJellyseerrDetails(mediaId, mediaType) {
        return ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/details/' + mediaType + '/' + mediaId),
            type: 'GET',
            dataType: 'json'
        });
    }

    function loadClientSettings() {
        return ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/client-settings'),
            type: 'GET',
            dataType: 'json'
        }).catch(function () {
            return ApiClient.getPluginConfiguration(PLUGIN_ID).catch(function () {
                return {};
            });
        });
    }

    function loadModalDetails(mediaId, mediaType) {
        return loadClientSettings().then(function (config) {
                const apiKey = getTmdbApiKey(config);
                const jellyseerrPromise = fetchJellyseerrDetails(mediaId, mediaType);

                if (!apiKey) {
                    return jellyseerrPromise;
                }

                // Fetch both sources but prefer TMDB content with Seerr status
                return Promise.all([
                    jellyseerrPromise,
                    fetchTmdbDetailsFromBrowser(mediaId, mediaType, apiKey)
                ]).then(function (results) {
                    const jellyseerr = results[0];
                    const tmdb = results[1];
                    if (tmdb) {
                        return mergeJellyseerrOverlay(tmdb, jellyseerr);
                    }
                    return jellyseerr;
                });
            });
    }

    function formatRuntime(minutes) {
        if (!minutes) {
            return '';
        }
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h && m) {
            return h + 'h ' + m + 'm';
        }
        if (h) {
            return h + 'h';
        }
        return m + 'm';
    }

    function formatEndsAt(minutes) {
        if (!minutes) {
            return '';
        }
        const end = new Date(Date.now() + minutes * 60 * 1000);
        return end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function formatReleaseDate(dateStr) {
        if (!dateStr) {
            return '';
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            return dateStr;
        }
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function getCertification(data, mediaType) {
        // Get a US certification from Tmdb release_dates (movies) or content_ratings (TV)
        if (mediaType === 'movie' && data.releaseDates) {
            const us = (data.releaseDates.results || []).find(function (r) { return r.iso_3166_1 === 'US'; });
            const rel = us && us.release_dates && us.release_dates.find(function (rd) { return rd.certification; });
            if (rel && rel.certification) {
                return rel.certification;
            }
        }
        if (mediaType === 'tv' && data.contentRatings) {
            const us = (data.contentRatings.results || []).find(function (r) { return r.iso_3166_1 === 'US'; });
            if (us && us.rating) {
                return us.rating;
            }
        }
        return '';
    }

    function getTrailerKey(data) {
        const videos = data.relatedVideos || data.videos;
        const results = videos && (videos.results || videos);
        if (!results || !results.length) {
            return null;
        }
        const trailer = results.find(function (v) {
            return v.type === 'Trailer' && v.site === 'YouTube';
        }) || results[0];
        return trailer && trailer.key ? trailer.key : null;
    }

    function getCast(data) {
        const credits = data.credits || data.aggregateCredits;
        const cast = credits && (credits.cast || []);
        const crew = credits && (credits.crew || []);
        const directors = crew.filter(function (c) { return c.job === 'Director'; }).slice(0, 2);
        const list = [];

        directors.forEach(function (d) {
            list.push({
                id: d.id,
                name: d.name,
                role: 'Director',
                profile_path: d.profilePath || d.profile_path
            });
        });

        (cast || []).slice(0, 24).forEach(function (c) {
            list.push({
                id: c.id,
                name: c.name,
                role: c.character || (c.roles && c.roles[0] && c.roles[0].character) || '',
                profile_path: c.profilePath || c.profile_path
            });
        });

        return list;
    }

    function removeEscapeHandler() {
        if (escapeHandler) {
            document.removeEventListener('keydown', escapeHandler);
            escapeHandler = null;
        }
    }

    function closeQualityModal() {
        if (activeQualityRoot) {
            activeQualityRoot.remove();
            activeQualityRoot = null;
        }
    }

    function closeSeasonModal() {
        if (activeSeasonRoot) {
            activeSeasonRoot.remove();
            activeSeasonRoot = null;
        }
    }

    function closeDetailsModal() {
        closeQualityModal();
        closeSeasonModal();
        if (activeDetailsRoot) {
            activeDetailsRoot.remove();
            activeDetailsRoot = null;
        }
        removeEscapeHandler();
        document.body.style.overflow = '';
    }

    function getRequestableSeasons(details) {
        return (details.seasons || [])
            .filter(function (season) {
                return season.episodeCount !== 0 && season.seasonNumber > 0;
            })
            .sort(function (a, b) {
                return a.seasonNumber - b.seasonNumber;
            });
    }

    function submitRequest(mediaId, mediaType, option, onSuccess) {
        const payload = {
            MediaType: mediaType,
            MediaId: parseInt(mediaId, 10),
            ServerId: option.serverId,
            ProfileId: option.profileId,
            RootFolder: option.rootFolder || null,
            Is4k: !!option.is4k
        };

        if (mediaType === 'tv' && option.seasons && option.seasons.length) {
            payload.Seasons = option.seasons.slice().sort(function (a, b) { return a - b; });
        }

        return ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/request'),
            type: 'POST',
            data: JSON.stringify(payload),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        }).then(function (response) {
            if (response && response.errors && response.errors.length > 0) {
                Dashboard.alert('Request failed. Check logs for details.');
                console.error('SeerrFin request:', response);
                return;
            }
            Dashboard.alert('Successfully requested');
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        }).catch(function (err) {
            console.error('SeerrFin request:', err);
            Dashboard.alert('Request failed');
        });
    }

    function openSeasonModal(mediaId, mediaType, title, onSuccess, is4k) {
        closeSeasonModal();
        is4k = !!is4k;

        const wrapper = document.createElement('div');
        wrapper.className = 'bst-quality-wrapper';

        const backdrop = document.createElement('div');
        backdrop.className = 'bst-quality-backdrop';
        backdrop.addEventListener('click', closeSeasonModal);

        const panel = document.createElement('div');
        panel.className = 'bst-quality-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');

        const header = document.createElement('div');
        header.className = 'bst-quality-header';
        header.innerHTML = '<h3 id="bst-season-title">Select seasons</h3>';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'bst-quality-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = CLOSE_ICON;
        closeBtn.addEventListener('click', closeSeasonModal);
        header.appendChild(closeBtn);

        const list = document.createElement('div');
        list.className = 'bst-quality-list';
        list.innerHTML = '<div class="bst-quality-loading">Loading seasons…</div>';

        const footer = document.createElement('div');
        footer.className = 'bst-quality-footer';

        const continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'bst-quality-continue';
        continueBtn.textContent = 'Continue';
        continueBtn.disabled = true;
        footer.appendChild(continueBtn);

        panel.appendChild(header);
        panel.appendChild(list);
        panel.appendChild(footer);
        wrapper.appendChild(backdrop);
        wrapper.appendChild(panel);
        document.body.appendChild(wrapper);
        activeSeasonRoot = wrapper;

        let selectedSeasons = [];

        continueBtn.addEventListener('click', function () {
            const seasons = selectedSeasons.slice();
            closeSeasonModal();
            openQualityModal(mediaId, mediaType, title, onSuccess, is4k, seasons);
        });

        fetchJellyseerrDetails(mediaId, mediaType).then(function (details) {
            list.innerHTML = '';
            const seasons = getRequestableSeasons(details);

            if (!seasons.length) {
                list.innerHTML = '<div class="bst-quality-empty">No seasons available.</div>';
                continueBtn.disabled = true;
                return;
            }

            const selectAllRow = document.createElement('label');
            selectAllRow.className = 'bst-season-option bst-season-select-all';
            const selectAllInput = document.createElement('input');
            selectAllInput.type = 'checkbox';
            selectAllInput.className = 'bst-season-checkbox';
            const selectAllText = document.createElement('span');
            selectAllText.className = 'bst-season-label';
            selectAllText.textContent = 'Select all';
            selectAllRow.appendChild(selectAllInput);
            selectAllRow.appendChild(selectAllText);

            function syncSelectAll() {
                const seasonNumbers = seasons.map(function (s) { return s.seasonNumber; });
                selectAllInput.checked = seasonNumbers.every(function (num) {
                    return selectedSeasons.indexOf(num) !== -1;
                });
                selectAllInput.indeterminate = selectedSeasons.length > 0 && !selectAllInput.checked;
                continueBtn.disabled = selectedSeasons.length === 0;
            }

            selectAllInput.addEventListener('change', function () {
                if (selectAllInput.checked) {
                    selectedSeasons = seasons.map(function (s) { return s.seasonNumber; });
                } else {
                    selectedSeasons = [];
                }
                list.querySelectorAll('.bst-season-row-input').forEach(function (input) {
                    input.checked = selectedSeasons.indexOf(parseInt(input.value, 10)) !== -1;
                });
                syncSelectAll();
            });

            list.appendChild(selectAllRow);

            seasons.forEach(function (season) {
                const seasonNumber = season.seasonNumber;

                const row = document.createElement('label');
                row.className = 'bst-season-option';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'bst-season-checkbox bst-season-row-input';
                input.value = String(seasonNumber);

                const label = document.createElement('span');
                label.className = 'bst-season-label';
                const displayName = season.name && season.name !== 'Season ' + seasonNumber
                    ? season.name
                    : 'Season ' + seasonNumber;
                label.appendChild(document.createTextNode(displayName));

                if (season.episodeCount) {
                    const episodes = document.createElement('span');
                    episodes.className = 'bst-season-episodes';
                    episodes.textContent = ' (' + season.episodeCount +
                        (season.episodeCount === 1 ? ' episode' : ' episodes') + ')';
                    label.appendChild(episodes);
                }

                row.appendChild(input);
                row.appendChild(label);

                input.addEventListener('change', function () {
                    if (input.checked) {
                        if (selectedSeasons.indexOf(seasonNumber) === -1) {
                            selectedSeasons.push(seasonNumber);
                        }
                    } else {
                        selectedSeasons = selectedSeasons.filter(function (n) {
                            return n !== seasonNumber;
                        });
                    }
                    syncSelectAll();
                });

                list.appendChild(row);
            });

            syncSelectAll();
        }).catch(function (err) {
            console.error('SeerrFin seasons:', err);
            list.innerHTML = '<div class="bst-quality-empty">Failed to load seasons.</div>';
            continueBtn.disabled = true;
        });
    }

    function openQualityModal(mediaId, mediaType, title, onSuccess, is4k, selectedSeasons) {
        if (mediaType === 'tv' && selectedSeasons === undefined) {
            openSeasonModal(mediaId, mediaType, title, onSuccess, is4k);
            return;
        }

        closeQualityModal();
        is4k = !!is4k;

        const wrapper = document.createElement('div');
        wrapper.className = 'bst-quality-wrapper';

        const backdrop = document.createElement('div');
        backdrop.className = 'bst-quality-backdrop';
        backdrop.addEventListener('click', closeQualityModal);

        const panel = document.createElement('div');
        panel.className = 'bst-quality-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');

        const header = document.createElement('div');
        header.className = 'bst-quality-header';
        header.innerHTML = '<h3 id="bst-quality-title">' + (is4k ? 'Choose 4K quality profile' : 'Choose quality profile') + '</h3>';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'bst-quality-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = CLOSE_ICON;
        closeBtn.addEventListener('click', closeQualityModal);
        header.appendChild(closeBtn);

        const list = document.createElement('div');
        list.className = 'bst-quality-list';
        list.innerHTML = '<div class="bst-quality-loading">Loading profiles…</div>';

        panel.appendChild(header);
        panel.appendChild(list);
        wrapper.appendChild(backdrop);
        wrapper.appendChild(panel);
        document.body.appendChild(wrapper);
        activeQualityRoot = wrapper;

        ApiClient.ajax({
            url: ApiClient.getUrl('SeerrFin/request-options/' + mediaType),
            type: 'GET',
            dataType: 'json'
        }).then(function (options) {
            list.innerHTML = '';
            if (!options || !options.length) {
                list.innerHTML = '<div class="bst-quality-empty">No quality profiles available.</div>';
                return;
            }

            let filteredOptions = options.filter(function (opt) {
                return !!opt.is4k === is4k;
            });
            if (!filteredOptions.length) {
                filteredOptions = options;
            }

            filteredOptions.forEach(function (opt) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'bst-quality-option';
                const label = opt.serverName && opt.serverName !== opt.profileName
                    ? opt.profileName
                    : (opt.profileName || 'Default');
                btn.innerHTML = escapeHtml(label) +
                    (opt.serverName ? '<span class="bst-quality-option-sub">' + escapeHtml(opt.serverName + (opt.is4k ? ' · 4K' : '')) + '</span>' : '');

                btn.addEventListener('click', function () {
                    btn.disabled = true;
                    const request = submitRequest(mediaId, mediaType, {
                        serverId: opt.serverId,
                        profileId: opt.profileId,
                        rootFolder: opt.rootFolder,
                        is4k: is4k,
                        seasons: selectedSeasons
                    }, function () {
                        closeQualityModal();
                        if (typeof onSuccess === 'function') {
                            onSuccess();
                        }
                    });

                    request.then(function () {
                        btn.disabled = false;
                    }, function () {
                        btn.disabled = false;
                    });
                });
                list.appendChild(btn);
            });
        }).catch(function (err) {
            console.error('SeerrFin profiles:', err);
            list.innerHTML = '<div class="bst-quality-empty">Failed to load quality profiles.</div>';
        });
    }

    function buildDetailsDom(data, mediaId, mediaType) {
        const title = data.title || data.name || 'Details';
        const overview = data.overview || '';
        const year = (data.releaseDate || data.firstAirDate || '').substring(0, 4);
        const rating = data.voteAverage != null ? data.voteAverage : data.vote_average;
        const voteCount = data.voteCount != null ? data.voteCount : data.vote_count;
        const backdrop = tmdbImage(data.backdropPath || data.backdrop_path, 'original');
        const runtimeMinutes = data.runtime || (data.episodeRunTime && data.episodeRunTime[0]);
        const runtime = formatRuntime(runtimeMinutes);
        const endsAt = formatEndsAt(runtimeMinutes);
        const language = (data.originalLanguage || data.original_language || '').toUpperCase();
        const releaseLabel = formatReleaseDate(data.releaseDate || data.firstAirDate);
        const certification = getCertification(data, mediaType);
        const genres = data.genres || [];
        const cast = getCast(data);
        const trailerKey = getTrailerKey(data);
        const tmdbId = data.id;
        const imdbId = data.externalIds && (data.externalIds.imdbId || data.externalIds.imdb_id);
        const root = document.createElement('div');
        root.className = 'bst-popout-wrapper';

        const bg = document.createElement('div');
        bg.className = 'bst-popout-backdrop';
        bg.addEventListener('click', closeDetailsModal);

        const center = document.createElement('div');
        center.className = 'bst-popout-center';

        const card = document.createElement('div');
        card.className = 'bst-aether-card';

        const inner = document.createElement('div');
        inner.className = 'bst-aether-card-inner';

        const closeWrap = document.createElement('button');
        closeWrap.type = 'button';
        closeWrap.className = 'bst-modal-close';
        closeWrap.setAttribute('aria-label', 'Close');
        closeWrap.innerHTML = CLOSE_ICON;
        closeWrap.addEventListener('click', closeDetailsModal);

        const scroll = document.createElement('div');
        scroll.className = 'bst-modal-scroll';

        const layout = document.createElement('div');
        layout.className = 'bst-modal-layout';

        const hero = document.createElement('div');
        hero.className = 'bst-hero';
        if (backdrop) {
            const heroBg = document.createElement('div');
            heroBg.className = 'bst-hero-backdrop';
            heroBg.style.backgroundImage = 'url("' + backdrop + '")';
            hero.appendChild(heroBg);
        }

        const heroWrap = document.createElement('div');
        heroWrap.className = 'bst-hero-title-wrap';

        const titleEl = document.createElement('h1');
        titleEl.className = 'bst-hero-title-fallback';
        titleEl.textContent = title;

        const logoUrl = getLogoImageUrl(data);
        if (logoUrl) {
            const logoImg = document.createElement('img');
            logoImg.className = 'bst-hero-logo';
            logoImg.alt = title;
            logoImg.src = logoUrl;
            logoImg.onerror = function () {
                logoImg.remove();
                heroWrap.insertBefore(titleEl, heroWrap.firstChild);
            };
            heroWrap.appendChild(logoImg);
        } else {
            heroWrap.appendChild(titleEl);
        }

        const content = document.createElement('div');
        content.className = 'bst-content';

        const heroMeta = document.createElement('div');
        heroMeta.className = 'bst-hero-meta';
        if (rating) {
            const ratingEl = document.createElement('div');
            ratingEl.className = 'bst-tmdb-rating';
            ratingEl.innerHTML = TMDB_LOGO_SVG +
                '<span class="bst-meta-emphasis">' + Number(rating).toFixed(1) + '</span>' +
                (voteCount ? '<span class="bst-vote-muted">(' + Number(voteCount).toLocaleString() + ')</span>' : '');
            heroMeta.appendChild(ratingEl);
        }
        if (year) {
            if (heroMeta.childElementCount) {
                const dot = document.createElement('span');
                dot.className = 'bst-dot';
                dot.textContent = '•';
                heroMeta.appendChild(dot);
            }
            const yearEl = document.createElement('span');
            yearEl.className = 'bst-meta-emphasis';
            yearEl.textContent = year;
            heroMeta.appendChild(yearEl);
        }
        if (heroMeta.childElementCount) {
            heroWrap.appendChild(heroMeta);
        }
        hero.appendChild(heroWrap);

        const actionsRow = document.createElement('div');
        actionsRow.className = 'bst-actions-row';

        const actionsLeft = document.createElement('div');
        actionsLeft.className = 'bst-actions-left';

        const requestBtn = document.createElement('button');
        requestBtn.type = 'button';
        requestBtn.className = 'bst-btn-request';
        requestBtn.textContent = 'Request';
        requestBtn.addEventListener('click', function () {
            openQualityModal(mediaId, mediaType, title);
        });
        actionsLeft.appendChild(requestBtn);

        const request4kBtn = document.createElement('button');
        request4kBtn.type = 'button';
        request4kBtn.className = 'bst-btn-request-4k';
        request4kBtn.textContent = 'Request 4K';
        request4kBtn.addEventListener('click', function () {
            openQualityModal(mediaId, mediaType, title, undefined, true);
        });
        actionsLeft.appendChild(request4kBtn);

        if (trailerKey) {
            const trailerBtn = document.createElement('button');
            trailerBtn.type = 'button';
            trailerBtn.className = 'bst-btn-trailer';
            trailerBtn.textContent = 'Trailer';
            trailerBtn.addEventListener('click', function () {
                window.open('https://www.youtube.com/watch?v=' + trailerKey, '_blank', 'noopener,noreferrer');
            });
            actionsLeft.appendChild(trailerBtn);
        }

        actionsRow.appendChild(actionsLeft);

        const detailsLayout = document.createElement('div');
        detailsLayout.className = 'bst-details-layout';

        const mainCol = document.createElement('div');
        mainCol.className = 'bst-details-main';
        const overviewEl = document.createElement('p');
        overviewEl.className = 'bst-overview';
        overviewEl.textContent = overview;

        const genresEl = document.createElement('div');
        genresEl.className = 'bst-genres';
        genres.forEach(function (g, i) {
            const pill = document.createElement('span');
            pill.className = 'bst-genre-pill';
            pill.textContent = g.name || g;
            pill.style.animationDelay = (i * 60) + 'ms';
            genresEl.appendChild(pill);
        });

        mainCol.appendChild(overviewEl);
        mainCol.appendChild(genresEl);

        const sidebar = document.createElement('div');
        sidebar.className = 'bst-sidebar';
        const settings = window.seerrFinPlugin && window.seerrFinPlugin._displaySettings;
        const showQualityRecommendations = !settings || settings.QualityRecommendations !== false;
        const qualityLines = showQualityRecommendations ? buildJustWatchQualityLines(tmdbId, mediaType) : null;
        const lines = document.createElement('div');
        lines.className = 'bst-sidebar-lines';

        if (runtime) {
            const line = document.createElement('div');
            let runtimeHtml = '<span class="bst-label">Runtime:</span> ' + escapeHtml(runtime);
            if (endsAt) {
                runtimeHtml += ' <span class="bst-runtime-sep">•</span> Ends at ' + escapeHtml(endsAt);
            }
            line.innerHTML = runtimeHtml;
            lines.appendChild(line);
        }
        if (language) {
            const line = document.createElement('div');
            line.innerHTML = '<span class="bst-label">Language:</span> ' + escapeHtml(language);
            lines.appendChild(line);
        }
        if (releaseLabel) {
            const line = document.createElement('div');
            line.innerHTML = '<span class="bst-label">Release Date:</span> ' + escapeHtml(releaseLabel);
            lines.appendChild(line);
        }
        if (certification) {
            const line = document.createElement('div');
            line.innerHTML = '<span class="bst-label">Rating:</span> ' + escapeHtml(certification);
            lines.appendChild(line);
        }
        if (tmdbId) {
            const line = document.createElement('div');
            line.innerHTML = '<span class="bst-label">ID:</span> ' + escapeHtml(String(tmdbId));
            lines.appendChild(line);
        }

        const links = document.createElement('div');
        links.className = 'bst-external-links';
        if (tmdbId) {
            const a = document.createElement('a');
            a.className = 'bst-external-link tmdb';
            a.href = 'https://www.themoviedb.org/' + (mediaType === 'tv' ? 'tv' : 'movie') + '/' + tmdbId;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.title = 'View on TMDB';
            a.innerHTML = TMDB_LOGO_SVG;
            a.style.animationDelay = '60ms';
            links.appendChild(a);
        }
        if (imdbId) {
            const a = document.createElement('a');
            a.className = 'bst-external-link imdb';
            a.href = 'https://www.imdb.com/title/' + imdbId;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.title = 'View on IMDb';
            a.innerHTML = IMDB_ICON;
            a.style.animationDelay = '120ms';
            links.appendChild(a);
        }
        if (qualityLines) {
            sidebar.appendChild(qualityLines);
        }
        sidebar.appendChild(lines);
        if (links.childElementCount) {
            sidebar.appendChild(links);
        }

        detailsLayout.appendChild(mainCol);
        detailsLayout.appendChild(sidebar);

        content.appendChild(actionsRow);
        content.appendChild(detailsLayout);

        if (cast.length) {
            const castSection = document.createElement('div');
            castSection.className = 'bst-cast-section';
            const castScroll = document.createElement('div');
            castScroll.className = 'bst-cast-scroll';
            cast.forEach(function (person) {
                const cardEl = document.createElement('a');
                cardEl.className = 'bst-cast-card';
                cardEl.href = 'https://www.themoviedb.org/person/' + person.id;
                cardEl.target = '_blank';
                cardEl.rel = 'noopener noreferrer';
                const avatar = document.createElement('div');
                avatar.className = 'bst-cast-avatar';
                const img = document.createElement('img');
                img.alt = person.name;
                img.src = person.profile_path
                    ? tmdbImage(person.profile_path, 'w185')
                    : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="#333" width="128" height="128"/></svg>');
                avatar.appendChild(img);
                const name = document.createElement('span');
                name.className = 'bst-cast-name';
                name.textContent = person.name;
                const role = document.createElement('span');
                role.className = 'bst-cast-role';
                role.textContent = person.role;
                cardEl.appendChild(avatar);
                cardEl.appendChild(name);
                cardEl.appendChild(role);
                castScroll.appendChild(cardEl);
            });
            castSection.appendChild(castScroll);
            content.appendChild(castSection);
        }

        layout.appendChild(hero);
        layout.appendChild(content);
        scroll.appendChild(layout);
        inner.appendChild(closeWrap);
        inner.appendChild(scroll);
        card.appendChild(inner);
        center.appendChild(card);
        root.appendChild(bg);
        root.appendChild(center);

        return root;
    }

    function openDetailsModal(mediaId, mediaType) {
        closeDetailsModal();

        const loading = document.createElement('div');
        loading.className = 'bst-popout-wrapper';
        loading.innerHTML =
            '<div class="bst-popout-backdrop"></div>' +
            '<div class="bst-popout-center"><div class="bst-aether-card">' +
            '<div class="bst-modal-loading">Loading…</div></div></div>';
        document.body.appendChild(loading);
        activeDetailsRoot = loading;
        document.body.style.overflow = 'hidden';

        loadModalDetails(mediaId, mediaType).then(function (data) {
            const dom = buildDetailsDom(data, mediaId, mediaType);
            loading.replaceWith(dom);
            activeDetailsRoot = dom;

            escapeHandler = function (e) {
                if (e.key === 'Escape') {
                    if (activeQualityRoot) {
                        closeQualityModal();
                    } else if (activeSeasonRoot) {
                        closeSeasonModal();
                    } else {
                        closeDetailsModal();
                    }
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }).catch(function (err) {
            console.error('SeerrFin modal:', err);
            closeDetailsModal();
            Dashboard.alert('Failed to load details');
        });
    }

    window.seerrFinModal = {
        open: openDetailsModal,
        close: closeDetailsModal,
        openQualityPicker: openQualityModal
    };
})();
