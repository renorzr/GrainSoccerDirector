import axios, { AxiosResponse } from 'axios';
import {
    Game,
    GameListResponse,
    EventsResponse,
    CommentsResponse,
    VideoListResponse,
    Task,
    CreateGameForm,
    UpdateGameForm,
    Event,
    Comment
} from '../types';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error('API Response Error:', error);
        if (error.response?.data?.detail) {
            error.message = error.response.data.detail;
        }
        return Promise.reject(error);
    }
);

// Game API
export const gameApi = {
    // Get all games
    getGames: async (): Promise<{ name: string; id: string }[]> => {
        const response: AxiosResponse<GameListResponse> = await api.get('/games');
        return response.data.games;
    },

    // Get game details
    getGame: async (gameId: string): Promise<Game> => {
        const response: AxiosResponse<Game> = await api.get(`/game/${gameId}`);
        return { ...response.data, id: gameId };
    },

    // Create new game
    createGame: async (gameData: CreateGameForm): Promise<void> => {
        await api.post('/game', gameData);
    },

    // Update game
    updateGame: async (gameId: string, gameData: UpdateGameForm): Promise<void> => {
        await api.put(`/game/${gameId}`, gameData);
    },

    // Delete game
    deleteGame: async (gameId: string): Promise<void> => {
        await api.post(`/game/${gameId}/clean`);
    },
};

// Events API
export const eventsApi = {
    // Get events for a game
    getEvents: async (gameId: string, segment: number): Promise<Event[]> => {
        const response: AxiosResponse<EventsResponse> = await api.get(`/game/${gameId}/events/${segment}`);
        return response.data.events || [];
    },

    // Save events for a game
    saveEvents: async (gameId: string, events: Event[], segment: number): Promise<void> => {
        await api.post(`/game/${gameId}/events/${segment}`, { events });
    },
};

// Comments API
export const commentsApi = {
    // Get comments for a game
    getComments: async (gameId: string, segment: number): Promise<Comment[]> => {
        const response: AxiosResponse<CommentsResponse> = await api.get(`/game/${gameId}/comments/${segment}`);
        return response.data.comments || [];
    },

    // Update a specific comment
    updateComment: async (gameId: string, segment: number, commentIndex: number, comment: Comment): Promise<void> => {
        await api.post(`/game/${gameId}/comments/${segment}/${commentIndex}`, comment);
    },

    // Analyze game
    analyzeGame: async (gameId: string, segment: number): Promise<void> => {
        await api.post(`/game/${gameId}/analyze/${segment}`);
    },
};

// Video API
export const videoApi = {
    // Get video list
    getVideos: async (gameId: string): Promise<VideoListResponse['videos']> => {
        const response: AxiosResponse<VideoListResponse> = await api.get(`/videos/${gameId}`);
        return response.data.videos;
    },

    // Upload video
    uploadVideo: async (gameId: string, file: File, onProgress?: (progress: number) => void): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post(`/upload/${gameId}/${encodeURIComponent(file.name)}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(progress);
                }
            },
        });

        return response.data;
    },

    // Delete video
    deleteVideo: async (gameId: string, videoName: string): Promise<void> => {
        await api.delete(`/video/${gameId}/${encodeURIComponent(videoName)}`);
    },

    // Get video URL
    getVideoUrl: (gameId: string, videoName: string): string => {
        return `${API_BASE}/video/${gameId}/${encodeURIComponent(videoName)}`;
    },

    getVideoPreviewUrl: (gameId: string, videoName: string, size: string = "200,150"): string => {
        return `${API_BASE}/video/${gameId}/${encodeURIComponent(videoName)}/preview?size=${size}`;
    },
};

// Task API
export const taskApi = {
    // Get task status
    getTaskStatus: async (gameId: string, taskName: 'make_video' | 'analyze_game'): Promise<Task> => {
        try {
            const response: AxiosResponse<Task> = await api.get(`/game/${gameId}/task/${taskName}/status`);
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return {
                    id: gameId,
                    name: taskName,
                    status: 'no_task',
                    message: '暂无任务'
                };
            }
            throw error;
        }
    },

    // Start video making task
    startVideoMaking: async (gameId: string, segment: number): Promise<void> => {
        await api.post(`/game/${gameId}/make/${segment}`);
    },

    // Start final video making task
    startFinalVideoMaking: async (gameId: string): Promise<void> => {
        await api.post(`/game/${gameId}/final`);
    },

    // Start analyze game task
    startAnalyzeGame: async (gameId: string, segment: number): Promise<void> => {
        await api.post(`/game/${gameId}/analyze/${segment}`);
    },

    // Cancel task
    cancelTask: async (gameId: string, taskName: 'make_video' | 'analyze_game'): Promise<void> => {
        await api.post(`/game/${gameId}/task/${taskName}/cancel`);
    },
};

export default api;
