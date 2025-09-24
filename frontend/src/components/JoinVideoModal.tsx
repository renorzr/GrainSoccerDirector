import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle } from 'lucide-react';
import { videoApi, taskApi } from '../services/api';
import { Video, Task } from '../types';
import { getErrorMessage } from '../utils';
import { Alert } from './Alert';
import './JoinVideoModal.css';

interface JoinVideoModalProps {
    gameId: string;
    sourceVideo: Video;
    availableVideos: Video[];
    onClose: () => void;
    onJoinComplete: () => void;
}

export const JoinVideoModal: React.FC<JoinVideoModalProps> = ({
    gameId,
    sourceVideo,
    availableVideos,
    onClose,
    onJoinComplete
}) => {
    const [selectedVideo, setSelectedVideo] = useState<string>('');
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [taskStatus, setTaskStatus] = useState<Task | null>(null);
    const [taskInterval, setTaskInterval] = useState<NodeJS.Timeout | null>(null);

    // Filter out the source video from available videos
    const otherVideos = availableVideos.filter(video => video.name !== sourceVideo.name);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (taskInterval) {
                clearInterval(taskInterval);
            }
        };
    }, [taskInterval]);

    const startTaskMonitoring = () => {
        const interval = setInterval(async () => {
            try {
                const status = await taskApi.getTaskStatus(gameId, 'preprocess_video');
                setTaskStatus(status);

                if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
                    clearInterval(interval);
                    setTaskInterval(null);
                    setJoining(false);

                    if (status.status === 'completed') {
                        onJoinComplete();
                        onClose();
                    }
                }
            } catch (err) {
                console.error('Failed to get task status:', err);
            }
        }, 1000);

        setTaskInterval(interval);
    };

    const handleJoinVideos = async () => {
        if (!selectedVideo) {
            setError('请选择要拼接的视频');
            return;
        }

        try {
            setJoining(true);
            setError(null);

            const videos = [sourceVideo.name, selectedVideo];
            await videoApi.joinVideos(gameId, videos);

            // Start monitoring task status
            startTaskMonitoring();
        } catch (err) {
            setError(getErrorMessage(err));
            setJoining(false);
        }
    };

    const handleCancel = () => {
        if (taskInterval) {
            clearInterval(taskInterval);
            setTaskInterval(null);
        }
        setJoining(false);
        setTaskStatus(null);
        onClose();
    };

    const getTaskStatusText = () => {
        if (!taskStatus) return '';

        switch (taskStatus.status) {
            case 'pending':
                return '等待中...';
            case 'running':
                return `处理中... ${Math.floor(taskStatus.progress || 0)}%`;
            case 'completed':
                return '拼接完成！';
            case 'failed':
                return '拼接失败';
            case 'cancelled':
                return '已取消';
            default:
                return '未知状态';
        }
    };

    const getTaskProgress = () => {
        if (!taskStatus || taskStatus.status !== 'running') return 0;
        return taskStatus.progress || 0;
    };

    return (
        <div className="modal-overlay" onClick={handleCancel}>
            <div className="join-video-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={handleCancel}>
                    <X size={24} />
                </button>

                <h2>🎬 拼接视频</h2>

                <div className="join-video-info">
                    <div className="source-video">
                        <h4>源视频：</h4>
                        <div className="video-item-small">
                            <span className="video-name">{sourceVideo.name}</span>
                        </div>
                    </div>

                    <div className="arrow">→</div>

                    <div className="target-video">
                        <h4>选择要拼接的视频：</h4>
                        <select
                            value={selectedVideo}
                            onChange={(e) => setSelectedVideo(e.target.value)}
                            disabled={joining}
                            className="video-select"
                        >
                            <option value="">请选择视频</option>
                            {otherVideos.map(video => (
                                <option key={video.name} value={video.name}>
                                    {video.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <Alert type="error" message={error} onClose={() => setError(null)} />
                )}

                {joining && (
                    <div className="join-progress">
                        <div className="progress-header">
                            <AlertCircle size={16} />
                            <span>{getTaskStatusText()}</span>
                        </div>
                        {taskStatus?.status === 'running' && (
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${getTaskProgress()}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}

                <div className="modal-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                        disabled={joining}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleJoinVideos}
                        disabled={joining || !selectedVideo}
                    >
                        {joining ? (
                            <>
                                <div className="loading" style={{ width: '16px', height: '16px', marginRight: '0.5rem' }}></div>
                                拼接中...
                            </>
                        ) : (
                            <>
                                <Play size={16} style={{ marginRight: '0.5rem' }} />
                                开始拼接
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
