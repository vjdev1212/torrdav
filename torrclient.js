import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

class TorrServerClient {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL.replace(/\/$/, '');
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: options.timeout || 30000
        });
    }

    async echo() {
        const response = await this.client.get('/echo');
        return response.data;
    }

    async shutdown() {
        await this.client.get('/shutdown');
    }

    async listTorrents() {
        const response = await this.client.post('/torrents', {
            action: 'list'
        });
        return response.data;
    }

    async addTorrent(params) {
        const response = await this.client.post('/torrents', {
            action: 'add',
            link: params.link,
            title: params.title,
            poster: params.poster,
            category: params.category,
            save_to_db: params.save_to_db || false,
            data: params.data
        });
        return response.data;
    }

    async getTorrent(hash) {
        const response = await this.client.post('/torrents', {
            action: 'get',
            hash: hash
        });
        return response.data;
    }

    async setTorrent(hash, params) {
        const response = await this.client.post('/torrents', {
            action: 'set',
            hash: hash,
            ...params
        });
        return response.data;
    }

    async removeTorrent(hash) {
        await this.client.post('/torrents', {
            action: 'rem',
            hash: hash
        });
    }

    async dropTorrent(hash) {
        await this.client.post('/torrents', {
            action: 'drop',
            hash: hash
        });
    }

    async wipeTorrents() {
        await this.client.post('/torrents', {
            action: 'wipe'
        });
    }

    async uploadTorrent(filePath, params = {}) {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        if (params.save) form.append('save', params.save);
        if (params.title) form.append('title', params.title);
        if (params.category) form.append('category', params.category);
        if (params.poster) form.append('poster', params.poster);
        if (params.data) form.append('data', params.data);

        const response = await this.client.post('/torrent/upload', form, {
            headers: form.getHeaders()
        });
        return response.data;
    }

    getPlayURL(hash, fileIndex = 1) {
        return `${this.baseURL}/play/${hash}/${fileIndex}`;
    }

    getStreamURL(hash, fileName, fileIndex = 1) {
        return `${this.baseURL}/stream/${fileName}?link=${hash}&index=${fileIndex}&play&preload`;
    }

    async streamFile(hash, fileIndex) {
        const response = await this.client.get(`/play/${hash}/${fileIndex}`, {
            responseType: 'stream'
        });
        return response.data;
    }

    async stream(params) {
        const response = await this.client.get('/stream', {
            params: params,
            responseType: params.play ? 'stream' : 'json'
        });
        return response.data;
    }

    async getPlaylist(hash, fromLast = false) {
        const response = await this.client.get('/playlist', {
            params: {
                hash: hash,
                fromlast: fromLast
            }
        });
        return response.data;
    }

    async getAllPlaylist() {
        const response = await this.client.get('/playlistall/all.m3u');
        return response.data;
    }

    async getCacheStats(hash, action = 'get') {
        const response = await this.client.post('/cache', {
            action: action,
            hash: hash
        });
        return response.data;
    }

    async getSettings() {
        const response = await this.client.post('/settings', {
            action: 'get'
        });
        return response.data;
    }

    async setSettings(settings) {
        const response = await this.client.post('/settings', {
            action: 'set',
            sets: settings
        });
        return response.data;
    }

    async resetSettings() {
        const response = await this.client.post('/settings', {
            action: 'def'
        });
        return response.data;
    }

    async listViewed() {
        const response = await this.client.post('/viewed', {
            action: 'list'
        });
        return response.data;
    }

    async setViewed(hash, fileIndex) {
        await this.client.post('/viewed', {
            action: 'set',
            hash: hash,
            file_index: fileIndex
        });
    }

    async removeViewed(hash, fileIndex) {
        await this.client.post('/viewed', {
            action: 'rem',
            hash: hash,
            file_index: fileIndex
        });
    }

    async search(query) {
        const response = await this.client.get('/search', {
            params: { query: query }
        });
        return response.data;
    }

    async getFFProbe(hash, fileIndex) {
        const response = await this.client.get(`/ffp/${hash}/${fileIndex}`);
        return response.data;
    }

    async getStats() {
        const response = await this.client.get('/stat');
        return response.data;
    }

    async getMagnets() {
        const response = await this.client.get('/magnets');
        return response.data;
    }

    async downloadTestFile(sizeMB) {
        const response = await this.client.get(`/download/${sizeMB}`, {
            responseType: 'stream'
        });
        return response.data;
    }
}

export default TorrServerClient;