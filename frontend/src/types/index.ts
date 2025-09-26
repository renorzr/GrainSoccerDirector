// API Response Types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    detail?: string;
}

// Game Types
export interface Team {
    name: string;
    color: string;
    code: string;
    score: number;
}

export interface Game {
    id: string;
    name: string;
    description?: string;
    segments: number;
    videos: string[];
    comment_requirement?: string;
    teams: Team[];
}

export interface GameListResponse {
    games: {
        name: string;
        id: string;
    }[];
}

// Event Types
export interface Event {
    time: string;
    type: string;
    team: number | null;
    player?: string;
    desc?: string;
}

export interface EventsResponse {
    events: Event[];
}

// Comment Types
export interface Comment {
    time: number;
    text: string;
}

export interface CommentsResponse {
    comments: Comment[];
}

// Video Types
export interface Video {
    name: string;
    size: number;
    last_modified: string;
    fps: number;
    frame_count: number;
    duration: number;
    codec: string;
}

export interface VideoListResponse {
    videos: Video[];
}

// Task Types
export interface Task {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'no_task';
    stage?: string;
    message?: string;
    created_at?: string;
    started_at?: string;
    completed_at?: string;
    error?: string;
    progress?: number; // 任务进度百分比 (0-100)
}

// Event Type Options
export interface EventType {
    value: string;
    label: string;
}

// UI State Types
export interface AppState {
    currentGameId: string | null;
    currentSegment: number;
    isEditMode: boolean;
    loading: boolean;
    error: string | null;
}

export type TabType = 'detail' | 'events' | 'video' | 'comments' | 'videos';

// Form Types
export interface CreateGameForm {
    id: string;
    name: string;
    segments: number;
    videos: string[];
    teams: {
        name: string;
        color: string;
    }[];
}

export interface UpdateGameForm {
    name: string;
    description: string;
    segments: number;
    videos: string[];
    comment_requirement: string;
    teams: Team[];
}

// Color Options
export const TEAM_COLORS = [
    '深蓝', '浅蓝', '红色', '绿色', '黄色',
    '橙色', '紫色', '粉色', '黑色', '白色'
] as const;

export type TeamColor = typeof TEAM_COLORS[number];

// Event Types
export const EVENT_TYPES: EventType[] = [
    { value: "Goal", label: "进球" },
    { value: "Miss", label: "射门未进" },
    { value: "Foul", label: "犯规" },
    { value: "Out", label: "出界" },
    { value: "Continue", label: "比赛继续" },
    { value: "Breakthrough", label: "突破" },
    { value: "Save", label: "扑救" },
    { value: "Kickoff", label: "开球" },
    { value: "Tackle", label: "抢断" },
    { value: "Pass", label: "传球" },
    { value: "Comment", label: "解说" },
    { value: "Start", label: "比赛开始" },
    { value: "End", label: "比赛结束" },
    { value: "Other", label: "其它事件" },
];

// Color mapping
export const COLOR_MAP: Record<TeamColor, string> = {
    '深蓝': '#1e3a8a',
    '浅蓝': '#3b82f6',
    '红色': '#dc2626',
    '绿色': '#16a34a',
    '黄色': '#eab308',
    '橙色': '#ea580c',
    '紫色': '#9333ea',
    '粉色': '#ec4899',
    '黑色': '#1f2937',
    '白色': '#f3f4f6'
};
