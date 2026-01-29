// PrimeTime Media Client - Main Application Logic

let apiClient = null;
let currentView = 'home';
let currentMediaItems = [];
let clientId = PrimeTimeApiClient.generateClientId();
let playbackUpdateInterval = null;
let currentPlayingMedia = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Try to restore session
    const serverUrl = localStorage.getItem('primeTimeServerUrl') || 'http://localhost:8080';
    apiClient = new PrimeTimeApiClient(serverUrl);
    registerUnauthorizedHandler(apiClient);

    await runServerDiscovery(apiClient);
    
    if (apiClient.restoreSession()) {
        // Validate session
        apiClient.validateSession()
            .then(() => {
                showMainScreen();
                loadLibrary();
            })
            .catch(() => {
                showLoginScreen();
            });
    } else {
        showLoginScreen();
    }
    
    setupEventListeners();
}

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });
    
    // Search
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadLibrary({ q: e.target.value });
        }, 500);
    });
    
    // Filters
    document.getElementById('genre-filter').addEventListener('change', () => loadLibrary());
    document.getElementById('year-filter').addEventListener('change', () => loadLibrary());
    document.getElementById('sort-filter').addEventListener('change', () => loadLibrary());
    
    // Player back button
    document.getElementById('back-btn').addEventListener('click', () => {
        stopPlayback();
        showMainScreen();
    });
    
    // Modal close
    document.querySelector('.modal-close').addEventListener('click', closeDetailModal);
    document.getElementById('detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'detail-modal') {
            closeDetailModal();
        }
    });
    
    // Detail modal actions
    document.getElementById('detail-play-btn').addEventListener('click', handleDetailPlay);
    document.getElementById('detail-favorite-btn').addEventListener('click', handleDetailFavorite);
    document.getElementById('detail-watched-btn').addEventListener('click', handleDetailWatched);
}

// Login handling
async function handleLogin(e) {
    e.preventDefault();
    
    const serverUrl = document.getElementById('server-url').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');
    
    // Update UI
    loginBtn.disabled = true;
    loginBtn.querySelector('.btn-text').textContent = 'Anmelden...';
    loginBtn.querySelector('.spinner').style.display = 'inline-block';
    errorDiv.style.display = 'none';
    
    try {
        apiClient = new PrimeTimeApiClient(serverUrl);
        registerUnauthorizedHandler(apiClient);
        await runServerDiscovery(apiClient);
        await apiClient.login(username, password);
        
        // Store server URL
        localStorage.setItem('primeTimeServerUrl', serverUrl);
        
        showMainScreen();
        loadLibrary();
    } catch (error) {
        errorDiv.textContent = `Login fehlgeschlagen: ${error.message}`;
        errorDiv.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.querySelector('.btn-text').textContent = 'Anmelden';
        loginBtn.querySelector('.spinner').style.display = 'none';
    }
}

async function runServerDiscovery(client) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }

    const discovery = await client.discoverServer();
    if (discovery.success) {
        localStorage.setItem('primeTimeApiBasePath', client.basePath || '/');
        return discovery;
    }

    localStorage.setItem('primeTimeApiBasePath', '/');
    const message = 'Server-Discovery fehlgeschlagen. Verwende Standardpfad "/".';
    showDiscoveryError(message);
    return discovery;
}

function showDiscoveryError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    if (!document.getElementById('login-screen').classList.contains('active')) {
        alert(message);
    }
}

async function handleLogout() {
    try {
        await apiClient.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    showLoginScreen();
}

// Screen management
function showLoginScreen() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('player-screen').classList.remove('active');
}

function registerUnauthorizedHandler(client) {
    client.setUnauthorizedHandler(async () => {
        handleUnauthorized();
    });
}

function handleUnauthorized() {
    resetUiForLogin();
    showLoginScreen();
}

function resetUiForLogin() {
    stopPlayback();
    closeDetailModal();
    currentMediaItems = [];
    currentPlayingMedia = null;
    currentView = 'home';

    document.getElementById('user-name').textContent = '';
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === 'home');
    });

    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    const emptyState = document.getElementById('empty-state');
    emptyState.style.display = 'none';
    document.getElementById('loading').style.display = 'none';

    document.getElementById('search-input').value = '';
    document.getElementById('genre-filter').value = '';
    document.getElementById('year-filter').value = '';

    const loginError = document.getElementById('login-error');
    loginError.textContent = 'Sitzung abgelaufen. Bitte erneut anmelden.';
    loginError.style.display = 'block';
}

function showMainScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    document.getElementById('player-screen').classList.remove('active');
    
    // Update user name
    if (apiClient.session) {
        document.getElementById('user-name').textContent = apiClient.session.username;
    }
}

function showPlayerScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('player-screen').classList.add('active');
}

// Navigation
function handleNavigation(e) {
    e.preventDefault();
    
    // Update active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    e.currentTarget.classList.add('active');
    
    currentView = e.currentTarget.dataset.view;
    loadLibrary();
}

// Library loading
async function loadLibrary(additionalParams = {}) {
    const loading = document.getElementById('loading');
    const grid = document.getElementById('library-grid');
    const emptyState = document.getElementById('empty-state');
    
    loading.style.display = 'flex';
    grid.innerHTML = '';
    emptyState.style.display = 'none';
    
    try {
        let items = [];
        const params = {
            sort: document.getElementById('sort-filter').value,
            limit: 100,
            ...additionalParams
        };
        
        // Add filters
        const genre = document.getElementById('genre-filter').value;
        const year = document.getElementById('year-filter').value;
        if (genre) params.genre = genre;
        if (year) params.year = year;
        
        // Load based on current view
        switch (currentView) {
            case 'home':
                {
                    const response = await apiClient.getLibrary(params);
                    items = response?.items ?? response;
                }
                break;
            case 'movies':
                params.type = 'movie';
                {
                    const response = await apiClient.getLibrary(params);
                    items = response?.items ?? response;
                }
                break;
            case 'shows':
                params.type = 'tvshow';
                {
                    const response = await apiClient.getLibrary(params);
                    items = response?.items ?? response;
                }
                break;
            case 'favorites':
                {
                    const response = await apiClient.getFavorites(100);
                    items = response?.items ?? response;
                }
                break;
            case 'continue':
                const playbackResponse = await apiClient.getAllPlaybackStates(clientId, true);
                const playbackStates = playbackResponse?.items ?? playbackResponse;
                if (playbackStates && playbackStates.length > 0) {
                    const playbackById = new Map(playbackStates.map(state => [state.mediaId, state]));
                    const mediaIds = Array.from(playbackById.keys());
                    const mediaItems = await Promise.all(
                        mediaIds.map(async (id) => {
                            try {
                                const item = await apiClient.getMediaItem(id);
                                if (item) {
                                    item.playbackState = playbackById.get(id);
                                }
                                return item;
                            } catch (error) {
                                console.error(`Failed to load media item ${id}:`, error);
                                return null;
                            }
                        })
                    );
                    items = mediaItems.filter(Boolean);
                }
                break;
        }
        
        // Ensure items is always an array
        if (!items || !Array.isArray(items)) {
            items = [];
        }
        
        currentMediaItems = items;
        
        if (items.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            renderMediaGrid(items);
            // Only populate filters if we have items
            if (items.length > 0) {
                populateFilters(items).catch(err => {
                    console.error('Failed to populate filters:', err);
                });
            }
        }
    } catch (error) {
        console.error('Failed to load library:', error);
        emptyState.style.display = 'flex';
        const emptyStateText = emptyState.querySelector('p');
        if (emptyStateText) {
            emptyStateText.textContent = `Fehler: ${error.message}`;
        }
    } finally {
        loading.style.display = 'none';
    }
}

// Render media grid
async function renderMediaGrid(items) {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    
    for (const item of items) {
        const card = createMediaCard(item);
        grid.appendChild(card);
    }
}

function createMediaCard(item) {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.dataset.mediaId = item.id;
    
    // Poster
    const poster = document.createElement('div');
    poster.className = 'media-poster';
    
    if (item.posterPath) {
        const img = document.createElement('img');
        img.src = apiClient.getPosterUrlWithToken(item.id);
        img.alt = item.title;
        img.onerror = () => {
            img.style.display = 'none';
            poster.appendChild(createPosterPlaceholder());
        };
        poster.appendChild(img);
    } else {
        poster.appendChild(createPosterPlaceholder());
    }
    
    // Progress bar
    if (item.playbackState) {
        const progress = document.createElement('div');
        progress.className = 'media-progress';
        const bar = document.createElement('div');
        bar.className = 'media-progress-bar';
        bar.style.width = `${item.playbackState.percentComplete || 0}%`;
        progress.appendChild(bar);
        poster.appendChild(progress);
    }
    
    // Badges
    const badges = document.createElement('div');
    badges.className = 'media-badges';
    badges.innerHTML = `
        <div class="badge badge-favorite" style="display: none;">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
        </div>
        <div class="badge badge-watched" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
    `;
    poster.appendChild(badges);

    // Overlay (hover actions)
    const overlay = document.createElement('div');
    overlay.className = 'media-overlay';
    overlay.innerHTML = `
        <div class="media-overlay-content">
            <button class="media-overlay-play" type="button" aria-label="Wiedergabe starten">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"></path>
                </svg>
            </button>
            <div class="media-overlay-actions">
                <button class="media-overlay-action" type="button" aria-label="Zur Merkliste hinzufügen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 5v14"></path>
                        <path d="M5 12h14"></path>
                    </svg>
                </button>
                <button class="media-overlay-action" type="button" aria-label="Details anzeigen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M12 10v6"></path>
                        <path d="M12 7h.01"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
    overlay.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    });
    overlay.querySelector('.media-overlay-play').addEventListener('click', (event) => {
        event.stopPropagation();
        showDetailModal(item);
    });
    poster.appendChild(overlay);
    
    // Check favorite and watched status
    checkMediaStatus(item.id, badges);
    
    card.appendChild(poster);
    
    // Info
    const info = document.createElement('div');
    info.className = 'media-info';
    
    const title = document.createElement('div');
    title.className = 'media-title';
    title.textContent = item.title;
    
    const meta = document.createElement('div');
    meta.className = 'media-meta';
    
    const size = formatFileSize(item.size);
    meta.innerHTML = `<span>${size}</span>`;
    
    info.appendChild(title);
    info.appendChild(meta);
    card.appendChild(info);
    
    // Click handler
    card.addEventListener('click', () => showDetailModal(item));
    
    return card;
}

function createPosterPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'media-poster-placeholder';
    placeholder.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
            <polyline points="17 2 12 7 7 2"></polyline>
        </svg>
    `;
    return placeholder;
}

async function checkMediaStatus(mediaId, badgesContainer) {
    try {
        const [isFav, isWatch] = await Promise.all([
            apiClient.isFavorite(mediaId),
            apiClient.isWatched(mediaId)
        ]);
        
        if (isFav) {
            badgesContainer.querySelector('.badge-favorite').style.display = 'flex';
        }
        if (isWatch) {
            badgesContainer.querySelector('.badge-watched').style.display = 'flex';
        }
    } catch (error) {
        console.error('Failed to check media status:', error);
    }
}

// Populate filters
async function populateFilters(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return;
    }
    
    const genreFilter = document.getElementById('genre-filter');
    const yearFilter = document.getElementById('year-filter');
    
    // Extract unique genres and years from NFO data
    const genres = new Set();
    const years = new Set();
    
    // Limit to first 20 items for performance
    const itemsToCheck = items.slice(0, 20);
    
    for (const item of itemsToCheck) {
        try {
            const nfo = await apiClient.getNFO(item.id);
            if (nfo && nfo.genres && Array.isArray(nfo.genres)) {
                nfo.genres.forEach(g => genres.add(g));
            }
            if (nfo && nfo.year) {
                years.add(nfo.year);
            }
        } catch (error) {
            // NFO might not exist, skip silently
            console.debug('NFO not found for item:', item.id);
        }
    }
    
    // Update genre filter
    const currentGenre = genreFilter.value;
    genreFilter.innerHTML = '<option value="">Alle Genres</option>';
    if (genres.size > 0) {
        Array.from(genres).sort().forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreFilter.appendChild(option);
        });
    }
    genreFilter.value = currentGenre;
    
    // Update year filter
    const currentYear = yearFilter.value;
    yearFilter.innerHTML = '<option value="">Alle Jahre</option>';
    if (years.size > 0) {
        Array.from(years).sort((a, b) => b - a).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });
    }
    yearFilter.value = currentYear;
}

// Detail Modal
async function showDetailModal(item) {
    const modal = document.getElementById('detail-modal');
    modal.classList.add('active');
    
    // Set basic info
    document.getElementById('detail-title').textContent = item.title;
    
    // Set poster
    const posterImg = document.getElementById('detail-poster-img');
    if (item.posterPath) {
        posterImg.src = apiClient.getPosterUrlWithToken(item.id);
        posterImg.style.display = 'block';
    } else {
        posterImg.style.display = 'none';
    }

    const backdropImg = document.getElementById('detail-backdrop-img');
    if (item.posterPath) {
        backdropImg.src = apiClient.getPosterUrlWithToken(item.id);
        backdropImg.style.display = 'block';
    } else {
        backdropImg.style.display = 'none';
    }
    
    // Clear any previously added dynamic elements
    const existingTagline = document.querySelector('.detail-tagline');
    if (existingTagline) existingTagline.remove();
    const existingTech = document.querySelector('.detail-technical');
    if (existingTech) existingTech.remove();
    
    // Load NFO data
    try {
        const nfo = await apiClient.getNFO(item.id);
        
        document.getElementById('detail-year').textContent = nfo.year || '';
        document.getElementById('detail-rating').textContent = nfo.rating ? `⭐ ${nfo.rating}` : '';
        document.getElementById('detail-runtime').textContent = nfo.runtime ? `${nfo.runtime} min` : '';
        document.getElementById('detail-plot').textContent = nfo.plot || 'Keine Beschreibung verfügbar';
        
        // Genres
        const genresContainer = document.getElementById('detail-genres');
        genresContainer.innerHTML = '';
        if (nfo.genres && nfo.genres.length > 0) {
            nfo.genres.forEach(genre => {
                const tag = document.createElement('span');
                tag.className = 'genre-tag';
                tag.textContent = genre;
                genresContainer.appendChild(tag);
            });
        }
        
        // Cast & Crew - Handle both old format (string array) and new format (Actor objects)
        const actorList = nfo.actors && nfo.actors.length > 0
            ? nfo.actors.map(actor => {
                if (typeof actor === 'string') {
                    return actor;
                }
                if (actor.name) {
                    return actor.role ? `${actor.name} (${actor.role})` : actor.name;
                }
                return '';
            }).filter(Boolean)
            : [];
        renderPeopleList(document.getElementById('detail-actors'), actorList);

        const directorList = nfo.directors && nfo.directors.length > 0 ? nfo.directors : [];
        renderPeopleList(document.getElementById('detail-directors'), directorList);
        
        // Additional metadata - outline, tagline, mpaa, premiered
        const metaEl = document.getElementById('detail-meta');
        if (metaEl) {
            const baseMetaIds = new Set(['detail-year', 'detail-rating', 'detail-runtime']);
            metaEl.querySelectorAll('span').forEach(span => {
                if (!baseMetaIds.has(span.id)) {
                    span.remove();
                }
            });
        }

        const additionalMeta = [];
        if (nfo.mpaa) additionalMeta.push(`FSK: ${nfo.mpaa}`);
        if (nfo.premiered) additionalMeta.push(`Premiere: ${nfo.premiered}`);
        
        // Add tagline if available
        if (nfo.tagline) {
            const taglineEl = document.createElement('p');
            taglineEl.className = 'detail-tagline';
            taglineEl.style.fontStyle = 'italic';
            taglineEl.style.color = '#888';
            taglineEl.style.marginBottom = '1rem';
            taglineEl.textContent = `"${nfo.tagline}"`;
            document.getElementById('detail-plot').parentNode.insertBefore(taglineEl, document.getElementById('detail-plot'));
        }
        
        // Update meta section with additional info
        if (additionalMeta.length > 0 && metaEl) {
            additionalMeta.forEach(meta => {
                const span = document.createElement('span');
                span.className = 'meta-chip';
                span.textContent = meta;
                metaEl.appendChild(span);
            });
        }
        
        // Show outline if available (use it instead of plot if plot is empty)
        if (!nfo.plot && nfo.outline) {
            document.getElementById('detail-plot').textContent = nfo.outline;
        }
        
        // Add technical details if streamDetails are available
        if (nfo.streamDetails) {
            const techDetails = document.createElement('div');
            techDetails.className = 'detail-technical';
            techDetails.style.marginTop = '1.5rem';
            techDetails.style.padding = '1rem';
            techDetails.style.backgroundColor = 'rgba(255,255,255,0.05)';
            techDetails.style.borderRadius = '8px';
            
            let techHTML = '<h3 style="margin-bottom: 0.5rem;">Technische Details</h3>';
            
            // Video info
            if (nfo.streamDetails.video && nfo.streamDetails.video.length > 0) {
                const video = nfo.streamDetails.video[0];
                const videoInfo = [];
                if (video.width && video.height) videoInfo.push(`${video.width}x${video.height}`);
                if (video.codec) videoInfo.push(video.codec.toUpperCase());
                if (video.frameRate) videoInfo.push(`${parseFloat(video.frameRate).toFixed(2)} fps`);
                if (videoInfo.length > 0) {
                    techHTML += `<p><strong>Video:</strong> ${videoInfo.join(' • ')}</p>`;
                }
            }
            
            // Audio info
            if (nfo.streamDetails.audio && nfo.streamDetails.audio.length > 0) {
                const audioTracks = nfo.streamDetails.audio.map(audio => {
                    const parts = [];
                    if (audio.language) parts.push(audio.language.toUpperCase());
                    if (audio.codec) parts.push(audio.codec.toUpperCase());
                    if (audio.channels) parts.push(`${audio.channels} CH`);
                    return parts.join(' ');
                }).filter(a => a);
                if (audioTracks.length > 0) {
                    techHTML += `<p><strong>Audio:</strong> ${audioTracks.join(' | ')}</p>`;
                }
            }
            
            // Subtitle info
            if (nfo.streamDetails.subtitle && nfo.streamDetails.subtitle.length > 0) {
                const subtitles = nfo.streamDetails.subtitle.map(sub => 
                    sub.language ? sub.language.toUpperCase() : ''
                ).filter(s => s);
                if (subtitles.length > 0) {
                    techHTML += `<p><strong>Untertitel:</strong> ${subtitles.join(', ')}</p>`;
                }
            }
            
            techDetails.innerHTML = techHTML;
            document.querySelector('.detail-info').appendChild(techDetails);
        }
    } catch (error) {
        console.error('Failed to load NFO:', error);
    }
    
    // Update button states
    updateDetailButtons(item.id);
    
    // Store current item
    modal.dataset.mediaId = item.id;
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('active');
}

function renderPeopleList(container, people) {
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const list = people && people.length > 0 ? people : ['Keine Informationen'];
    list.forEach(person => {
        const pill = document.createElement('span');
        pill.className = 'detail-person';
        pill.textContent = person;
        container.appendChild(pill);
    });
}

async function updateDetailButtons(mediaId) {
    try {
        const [isFav, isWatch] = await Promise.all([
            apiClient.isFavorite(mediaId),
            apiClient.isWatched(mediaId)
        ]);
        
        const favBtn = document.getElementById('detail-favorite-btn');
        const watchBtn = document.getElementById('detail-watched-btn');
        
        favBtn.innerHTML = isFav 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Favorit entfernen'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Favorit';
        
        watchBtn.innerHTML = isWatch
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg> Als ungesehen markieren'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg> Als gesehen markieren';
    } catch (error) {
        console.error('Failed to update button states:', error);
    }
}

// Detail modal actions
async function handleDetailPlay() {
    const mediaId = document.getElementById('detail-modal').dataset.mediaId;
    const item = currentMediaItems.find(i => i.id === mediaId);
    if (item) {
        closeDetailModal();
        playMedia(item);
    }
}

async function handleDetailFavorite() {
    const mediaId = document.getElementById('detail-modal').dataset.mediaId;
    try {
        const isFav = await apiClient.isFavorite(mediaId);
        if (isFav) {
            await apiClient.removeFromFavorites(mediaId);
        } else {
            await apiClient.addToFavorites(mediaId);
        }
        updateDetailButtons(mediaId);
        loadLibrary(); // Refresh grid
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}

async function handleDetailWatched() {
    const mediaId = document.getElementById('detail-modal').dataset.mediaId;
    try {
        const isWatch = await apiClient.isWatched(mediaId);
        if (isWatch) {
            await apiClient.markAsUnwatched(mediaId);
        } else {
            await apiClient.markAsWatched(mediaId);
        }
        updateDetailButtons(mediaId);
        loadLibrary(); // Refresh grid
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}

// Video playback
async function playMedia(item) {
    currentPlayingMedia = item;
    showPlayerScreen();
    
    const video = document.getElementById('video-player');
    const streamUrl = item?.playback?.protocol === 'hls'
        ? apiClient.getHLSStreamUrlWithToken(item.id, item?.playback?.profile || '720p')
        : apiClient.getStreamUrlWithToken(item.id);
    
    // Video tags can't set auth headers, so we pass the token via query string.
    // Set video source with auth token
    video.src = streamUrl;
    
    // Update player info
    document.getElementById('player-title').textContent = item.title;
    
    try {
        const nfo = await apiClient.getNFO(item.id);
        const meta = [];
        if (nfo.year) meta.push(nfo.year);
        if (nfo.runtime) meta.push(`${nfo.runtime} min`);
        document.getElementById('player-meta').textContent = meta.join(' • ');
    } catch (error) {
        document.getElementById('player-meta').textContent = '';
    }
    
    // Try to restore playback position
    try {
        const playback = await apiClient.getPlaybackState(item.id, clientId);
        if (playback && playback.positionSeconds > 0) {
            video.currentTime = playback.positionSeconds;
        }
    } catch (error) {
        console.error('Failed to restore playback position:', error);
    }
    
    // Start playback tracking
    video.play();
    startPlaybackTracking(item.id, video);
}

function startPlaybackTracking(mediaId, video) {
    // Clear existing interval
    if (playbackUpdateInterval) {
        clearInterval(playbackUpdateInterval);
    }
    
    // Update every 10 seconds
    playbackUpdateInterval = setInterval(async () => {
        if (!video.paused && video.duration > 0) {
            try {
                const percentComplete = (video.currentTime / video.duration) * 100;
                await apiClient.updatePlaybackState(
                    mediaId,
                    clientId,
                    Math.floor(video.currentTime),
                    Math.floor(video.duration),
                    percentComplete,
                    'playing',
                    'progress'
                );
            } catch (error) {
                console.error('Failed to update playback state:', error);
            }
        }
    }, 10000);
    
    // Also update on pause/end
    video.addEventListener('pause', async () => {
        if (video.duration > 0) {
            try {
                const percentComplete = (video.currentTime / video.duration) * 100;
                await apiClient.updatePlaybackState(
                    mediaId,
                    clientId,
                    Math.floor(video.currentTime),
                    Math.floor(video.duration),
                    percentComplete,
                    'paused',
                    'pause'
                );
            } catch (error) {
                console.error('Failed to update playback state:', error);
            }
        }
    });

    video.addEventListener('ended', async () => {
        if (video.duration > 0) {
            try {
                await apiClient.updatePlaybackState(
                    mediaId,
                    clientId,
                    Math.floor(video.duration),
                    Math.floor(video.duration),
                    100,
                    'ended',
                    'ended'
                );
            } catch (error) {
                console.error('Failed to update playback state:', error);
            }
        }
    });

    video.addEventListener('seeking', async () => {
        if (video.duration > 0) {
            try {
                const percentComplete = (video.currentTime / video.duration) * 100;
                await apiClient.updatePlaybackState(
                    mediaId,
                    clientId,
                    Math.floor(video.currentTime),
                    Math.floor(video.duration),
                    percentComplete,
                    'seeking',
                    'seeking'
                );
            } catch (error) {
                console.error('Failed to update playback state:', error);
            }
        }
    });
}

function stopPlayback() {
    const video = document.getElementById('video-player');
    video.pause();
    video.src = '';
    
    if (playbackUpdateInterval) {
        clearInterval(playbackUpdateInterval);
        playbackUpdateInterval = null;
    }
    
    currentPlayingMedia = null;
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
