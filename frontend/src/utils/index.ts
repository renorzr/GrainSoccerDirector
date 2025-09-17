import { COLOR_MAP, TeamColor } from '../types';

// Time formatting utilities
export const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00.0';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const decimalSeconds = Math.floor(seconds * 10 % 10);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${decimalSeconds}`;
};

export const parseTime = (timeString: string): number => {
    const [minutes, seconds] = timeString.split(':');
    return parseInt(minutes) * 60 + parseFloat(seconds);
};

// File size formatting
export const formatFileSize = (size: number): string => {
    if (size < 1024) {
        return size + ' B';
    } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + ' KB';
    } else if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(2) + ' MB';
    } else {
        return (size / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }
};

// Date formatting
export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Color utilities
export const getColorValue = (colorName: TeamColor): string => {
    return COLOR_MAP[colorName] || '#6c757d';
};

// Validation utilities
export const validateGameId = (id: string): boolean => {
    return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0;
};

export const validateGameName = (name: string): boolean => {
    return name.trim().length > 0;
};

export const validateTeamName = (name: string): boolean => {
    return name.trim().length > 0;
};

// Error handling utilities
export const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') {
        return error;
    }

    if (error?.response?.data?.detail) {
        return error.response.data.detail;
    }

    if (error?.response?.data?.error) {
        return error.response.data.error;
    }

    if (error?.message) {
        return error.message;
    }

    return '发生未知错误';
};

// Local storage utilities
export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    set: <T>(key: string, value: T): void => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    },

    remove: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
        }
    }
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Array utilities
export const sortEventsByTime = (events: any[]): any[] => {
    return events.sort((a, b) => parseTime(a.time) - parseTime(b.time));
};

// URL utilities
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};

// Video utilities
export const getVideoThumbnail = (videoUrl: string): string => {
    // This would typically generate a thumbnail URL
    // For now, return a placeholder
    return '/video-thumbnail-placeholder.png';
};

// Form utilities
export const createFormData = (data: Record<string, any>): FormData => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
            formData.append(key, value);
        } else if (value !== null && value !== undefined) {
            formData.append(key, String(value));
        }
    });

    return formData;
};

// Game ID generation
export const generateGameId = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `${year}${month}${day}-${randomNum}`;
};
