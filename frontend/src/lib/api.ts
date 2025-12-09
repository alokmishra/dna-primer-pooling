// lib/api.ts
import axios from 'axios';
import { Primer } from './types';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000, // 5 minutes for large optimizations
    headers: {
        'Content-Type': 'application/json',
    },
});

// Error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);
        throw error;
    }
);

// API endpoints
export const primerApi = {
    // Upload primers (as JSON)
    uploadFile: async (primers: Primer[]) => {
        const response = await api.post('/api/upload', primers);
        return response.data;
    },

    // Start optimization
    startOptimization: async (data: {
        primers: Primer[];
        n_pools: number;
        max_primers_per_pool?: number;
        max_iterations?: number;
    }) => {
        const response = await api.post('/api/analyze', data);
        return response.data;
    },

    // Check job status
    getJobStatus: async (jobId: string) => {
        const response = await api.get(`/api/results/${jobId}`);
        return response.data;
    },

    // Get API statistics
    getStats: async () => {
        const response = await api.get('/api/stats');
        return response.data;
    },

    // Quick test
    testConnection: async () => {
        try {
            const response = await api.get('/');
            return { connected: true, data: response.data };
        } catch (error) {
            return { connected: false, error };
        }
    },
};