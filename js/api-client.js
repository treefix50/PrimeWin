// PrimeTime API Client - JavaScript Implementation
class PrimeTimeApiClient {
    constructor(baseUrl, basePath = '') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.basePath = this.normalizeBasePath(basePath);
        this.token = null;
        this.session = null;
        this.onUnauthorized = null;
        this.discoveryResults = [];
    }

    normalizeBasePath(basePath) {
        if (!basePath) {
            return '';
        }
        const trimmed = basePath.trim();
        if (trimmed === '/' || trimmed === '') {
            return '';
        }
        const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return withLeadingSlash.replace(/\/$/, '');
    }

    setBasePath(basePath) {
        this.basePath = this.normalizeBasePath(basePath);
    }

    buildApiUrl(path) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${this.baseUrl}${this.basePath}${normalizedPath}`;
    }

    // Helper method for API requests
    async request(endpoint, options = {}) {
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${this.basePath}${normalizedEndpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle specific status codes
            if (response.status === 401) {
                this.token = null;
                this.session = null;
                localStorage.removeItem('primeTimeToken');
                localStorage.removeItem('primeTimeSession');
                if (typeof this.onUnauthorized === 'function') {
                    await this.onUnauthorized();
                }
                throw new Error('Unauthorized - Session expired');
            }

            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 30;
                throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
            }

            if (response.status === 404) {
                throw new Error('Resource not found');
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }

            // Return null for 204 No Content
            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authentication
    async login(username, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            skipAuth: true
        });

        this.token = response.token;
        this.session = response;
        
        // Store token in localStorage
        localStorage.setItem('primeTimeToken', this.token);
        localStorage.setItem('primeTimeSession', JSON.stringify(this.session));
        
        return response;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.token = null;
            this.session = null;
            localStorage.removeItem('primeTimeToken');
            localStorage.removeItem('primeTimeSession');
        }
    }

    async validateSession() {
        const response = await this.request('/auth/session');
        this.session = response;
        return response;
    }

    // Restore session from localStorage
    restoreSession() {
        const token = localStorage.getItem('primeTimeToken');
        const sessionStr = localStorage.getItem('primeTimeSession');
        
        if (token && sessionStr) {
            this.token = token;
            this.session = JSON.parse(sessionStr);
            return true;
        }
        return false;
    }

    setUnauthorizedHandler(handler) {
        this.onUnauthorized = handler;
    }

    async discoverServer() {
        const candidates = [
            { endpoint: '/version', basePath: '' },
            { endpoint: '/info', basePath: '' },
            { endpoint: '/health', basePath: '' },
            { endpoint: '/api/version', basePath: '/api' },
            { endpoint: '/api/info', basePath: '/api' },
            { endpoint: '/api/health', basePath: '/api' },
            { endpoint: '/api/v1/version', basePath: '/api/v1' },
            { endpoint: '/api/v1/info', basePath: '/api/v1' },
            { endpoint: '/api/v1/health', basePath: '/api/v1' }
        ];

        this.discoveryResults = [];

        for (const candidate of candidates) {
            const url = `${this.baseUrl}${candidate.endpoint}`;
            try {
                const response = await fetch(url, { method: 'GET' });
                let payload = null;
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    payload = await response.text();
                }

                const result = {
                    endpoint: candidate.endpoint,
                    basePath: candidate.basePath,
                    status: response.status,
                    ok: response.ok,
                    payload
                };
                this.discoveryResults.push(result);

                if (response.ok) {
                    this.setBasePath(candidate.basePath);
                    return { ...result, success: true };
                }
            } catch (error) {
                this.discoveryResults.push({
                    endpoint: candidate.endpoint,
                    basePath: candidate.basePath,
                    ok: false,
                    error: error.message
                });
            }
        }

        this.setBasePath('');
        return { success: false };
    }

    /**
     * Expected server list schema:
     * - Array response: [item, ...]
     * - Object response: { items: [...], total?: number, limit?: number, offset?: number }
     * - Legacy object response: { results: [...] }
     */
    normalizeListResponse(response) {
        if (Array.isArray(response)) {
            return response;
        }

        if (response && typeof response === 'object') {
            const items = response.items ?? response.results;
            if (Array.isArray(items)) {
                const hasMeta = ['total', 'limit', 'offset'].some((key) => key in response);
                if (hasMeta) {
                    const { total, limit, offset } = response;
                    return { items, total, limit, offset };
                }
                return items;
            }
        }

        return [];
    }

    // Library
    async getLibrary(params = {}) {
        const queryParams = new URLSearchParams();
        
        if (params.q) queryParams.append('q', params.q);
        if (params.sort) queryParams.append('sort', params.sort);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.offset) queryParams.append('offset', params.offset);
        if (params.genre) queryParams.append('genre', params.genre);
        if (params.year) queryParams.append('year', params.year);
        if (params.type) queryParams.append('type', params.type);
        if (params.rating) queryParams.append('rating', params.rating);

        const query = queryParams.toString();
        const endpoint = query ? `/library?${query}` : '/library';
        
        const response = await this.request(endpoint);
        return this.normalizeListResponse(response);
    }

    async triggerLibraryScan() {
        return await this.request('/library', { method: 'POST' });
    }

    async getRecentlyAdded(limit = 20, days = null, type = null) {
        const params = new URLSearchParams({ limit: limit.toString() });
        if (days) params.append('days', days.toString());
        if (type) params.append('type', type);
        
        return await this.request(`/library/recent?${params.toString()}`);
    }

    // Media Items
    async getMediaItem(id) {
        return await this.request(`/items/${id}`);
    }

    async getNFO(id) {
        return await this.request(`/items/${id}/nfo`);
    }

    buildMediaUrl(path, params = {}) {
        const url = new URL(this.buildApiUrl(path));
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, value);
            }
        });
        if (this.token) {
            url.searchParams.set('token', this.token);
        }
        return url.toString();
    }

    getStreamUrl(id, profile = null) {
        let url = this.buildApiUrl(`/items/${id}/stream`);
        if (profile) {
            url += `?profile=${encodeURIComponent(profile)}`;
        }
        return url;
    }

    getStreamUrlWithToken(id, profile = null) {
        const params = profile ? { profile } : {};
        return this.buildMediaUrl(`/items/${id}/stream`, params);
    }

    getHLSStreamUrl(id, profile = '720p') {
        return `${this.buildApiUrl(`/items/${id}/stream.m3u8`)}?profile=${encodeURIComponent(profile)}`;
    }

    getHLSStreamUrlWithToken(id, profile = '720p') {
        return this.buildMediaUrl(`/items/${id}/stream.m3u8`, { profile });
    }

    getPosterUrl(id) {
        return this.buildApiUrl(`/items/${id}/poster`);
    }

    getPosterUrlWithToken(id) {
        return this.buildMediaUrl(`/items/${id}/poster`);
    }

    async posterExists(id) {
        const response = await this.request(`/items/${id}/poster/exists`);
        return response.exists;
    }

    // Playback
    async getPlaybackState(mediaId, clientId) {
        try {
            return await this.request(`/items/${mediaId}/playback?clientId=${encodeURIComponent(clientId)}`);
        } catch (error) {
            if (error.message.includes('not found')) {
                return null;
            }
            throw error;
        }
    }

    async updatePlaybackState(
        mediaId,
        clientId,
        positionSeconds,
        durationSeconds,
        percentComplete = null,
        state = 'playing',
        event = 'progress'
    ) {
        const payload = {
            event,
            position: positionSeconds,
            duration: durationSeconds,
            state,
            lastPlayedAt: Math.floor(Date.now() / 1000),
            clientId
        };

        if (Number.isFinite(percentComplete)) {
            payload.percentComplete = percentComplete;
        }

        return await this.request(`/items/${mediaId}/playback?clientId=${encodeURIComponent(clientId)}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async getAllPlaybackStates(clientId = null, onlyUnfinished = false) {
        const params = new URLSearchParams();
        if (clientId) params.append('clientId', clientId);
        if (onlyUnfinished) params.append('unfinished', '1');
        
        const query = params.toString();
        const endpoint = query ? `/playback?${query}` : '/playback';
        
        const response = await this.request(endpoint);
        return this.normalizeListResponse(response);
    }

    // Favorites
    async getFavorites(limit = null, offset = null) {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        
        const query = params.toString();
        const endpoint = query ? `/favorites?${query}` : '/favorites';
        
        const response = await this.request(endpoint);
        return this.normalizeListResponse(response);
    }

    async addToFavorites(mediaId) {
        return await this.request(`/items/${mediaId}/favorite`, { method: 'POST' });
    }

    async removeFromFavorites(mediaId) {
        return await this.request(`/items/${mediaId}/favorite`, { method: 'DELETE' });
    }

    async isFavorite(mediaId) {
        const response = await this.request(`/items/${mediaId}/favorite`);
        return response.favorite;
    }

    // Watched
    async getWatchedItems(limit = null, offset = null) {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        
        const query = params.toString();
        const endpoint = query ? `/watched?${query}` : '/watched';
        
        const response = await this.request(endpoint);
        return this.normalizeListResponse(response);
    }

    async markAsWatched(mediaId) {
        return await this.request(`/items/${mediaId}/watched`, { method: 'POST' });
    }

    async markAsUnwatched(mediaId) {
        return await this.request(`/items/${mediaId}/watched`, { method: 'DELETE' });
    }

    async isWatched(mediaId) {
        const response = await this.request(`/items/${mediaId}/watched`);
        return response.watched;
    }

    // Collections
    async getCollections(limit = null, offset = null) {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        
        const query = params.toString();
        const endpoint = query ? `/collections?${query}` : '/collections';
        
        const response = await this.request(endpoint);
        return this.normalizeListResponse(response);
    }

    async createCollection(name, description = null) {
        return await this.request('/collections', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });
    }

    async getCollection(id) {
        return await this.request(`/collections/${id}`);
    }

    async getCollectionItems(collectionId) {
        return await this.request(`/collections/${collectionId}/items`);
    }

    async addItemToCollection(collectionId, mediaId, position = 0) {
        return await this.request(`/collections/${collectionId}/items`, {
            method: 'POST',
            body: JSON.stringify({ mediaId, position })
        });
    }

    async removeItemFromCollection(collectionId, mediaId) {
        return await this.request(`/collections/${collectionId}/items/${mediaId}`, {
            method: 'DELETE'
        });
    }

    async deleteCollection(id) {
        return await this.request(`/collections/${id}`, { method: 'DELETE' });
    }

    // TV Shows
    async getTVShows(limit = null, offset = null) {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        
        const query = params.toString();
        const endpoint = query ? `/shows?${query}` : '/shows';
        
        const response = await this.request(endpoint);
        return this.normalizeListResponse(response);
    }

    async getTVShow(id) {
        return await this.request(`/shows/${id}`);
    }

    async getSeasons(showId) {
        return await this.request(`/shows/${showId}/seasons`);
    }

    async getEpisodes(showId, seasonNumber) {
        return await this.request(`/shows/${showId}/seasons/${seasonNumber}/episodes`);
    }

    async getNextUnwatchedEpisode(showId, userId = null) {
        const url = userId 
            ? `/shows/${showId}/next-episode?userId=${encodeURIComponent(userId)}`
            : `/shows/${showId}/next-episode`;
        
        try {
            return await this.request(url);
        } catch (error) {
            if (error.message.includes('not found')) {
                return null;
            }
            throw error;
        }
    }

    async triggerEpisodeGrouping() {
        return await this.request('/shows', { method: 'POST' });
    }

    // Transcoding
    async getTranscodingProfiles() {
        return await this.request('/transcoding/profiles');
    }

    // Helper: Generate client ID
    static generateClientId() {
        const stored = localStorage.getItem('primeTimeClientId');
        if (stored) return stored;
        
        const clientId = `web-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('primeTimeClientId', clientId);
        return clientId;
    }
}
