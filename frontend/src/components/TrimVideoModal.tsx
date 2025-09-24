import React, { useState, useEffect } from 'react';
import { X, Scissors, AlertCircle } from 'lucide-react';
import { videoApi, taskApi } from '../services/api';
import { Video, Task } from '../types';
import { getErrorMessage } from '../utils';
import { Alert } from './Alert';
import './TrimVideoModal.css';

interface TrimVideoModalProps {
    gameId: string;
    sourceVideo: Video;
    onClose: () => void;
    onTrimComplete: () => void;
}

export const TrimVideoModal: React.FC<TrimVideoModalProps> = ({
    gameId,
    sourceVideo,
    onClose,
    onTrimComplete
}) => {
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(sourceVideo.duration);
    const [trimming, setTrimming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [taskStatus, setTaskStatus] = useState<Task | null>(null);
    const [taskInterval, setTaskInterval] = useState<NodeJS.Timeout | null>(null);

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
                    setTrimming(false);

                    if (status.status === 'completed') {
                        onTrimComplete();
                        onClose();
                    }
                }
            } catch (err) {
                console.error('Failed to get task status:', err);
            }
        }, 1000);

        setTaskInterval(interval);
    };

    const handleTrimVideo = async () => {
        if (startTime >= endTime) {
            setError('开始时间必须小于结束时间');
            return;
        }

        if (startTime < 0 || endTime > sourceVideo.duration) {
            setError('时间范围超出视频长度');
            return;
        }

        try {
            setTrimming(true);
            setError(null);

            await videoApi.trimVideo(gameId, sourceVideo.name, startTime, endTime);

            // Start monitoring task status
            startTaskMonitoring();
        } catch (err) {
            setError(getErrorMessage(err));
            setTrimming(false);
        }
    };

    const handleCancel = () => {
        if (taskInterval) {
            clearInterval(taskInterval);
            setTaskInterval(null);
        }
        setTrimming(false);
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
                return '修剪完成！';
            case 'failed':
                return '修剪失败';
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

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartTimeChange = (value: string) => {
        const time = parseFloat(value);
        if (!isNaN(time)) {
            setStartTime(time);
        }
    };

    const handleEndTimeChange = (value: string) => {
        const time = parseFloat(value);
        if (!isNaN(time)) {
            setEndTime(time);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleCancel}>
            <div className="trim-video-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={handleCancel}>
                    <X size={24} />
                </button>

                <h2>✂️ 修剪视频</h2>

                <div className="trim-video-info">
                    <div className="source-video">
                        <h4>源视频：</h4>
                        <div className="video-item-small">
                            <span className="video-name">{sourceVideo.name}</span>
                            <span className="video-duration">时长: {formatTime(sourceVideo.duration)}</span>
                        </div>
                    </div>

                    <div className="trim-settings">
                        <h4>设置裁剪时间：</h4>
                        <div className="time-inputs">
                            <div className="time-input-group">
                                <label>开始时间 (秒):</label>
                                <input
                                    type="number"
                                    value={startTime}
                                    onChange={(e) => handleStartTimeChange(e.target.value)}
                                    min="0"
                                    max={sourceVideo.duration}
                                    step="0.1"
                                    disabled={trimming}
                                    className="time-input"
                                />
                                <span className="time-display">{formatTime(startTime)}</span>
                            </div>

                            <div className="time-input-group">
                                <label>结束时间 (秒):</label>
                                <input
                                    type="number"
                                    value={endTime}
                                    onChange={(e) => handleEndTimeChange(e.target.value)}
                                    min="0"
                                    max={sourceVideo.duration}
                                    step="0.1"
                                    disabled={trimming}
                                    className="time-input"
                                />
                                <span className="time-display">{formatTime(endTime)}</span>
                            </div>
                        </div>

                        <div className="duration-info">
                            <span>裁剪后时长: {formatTime(endTime - startTime)}</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <Alert type="error" message={error} onClose={() => setError(null)} />
                )}

                {trimming && (
                    <div className="trim-progress">
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
                        disabled={trimming}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleTrimVideo}
                        disabled={trimming || startTime >= endTime}
                    >
                        {trimming ? (
                            <>
                                <div className="loading" style={{ width: '16px', height: '16px', marginRight: '0.5rem' }}></div>
                                修剪中...
                            </>
                        ) : (
                            <>
                                <Scissors size={16} style={{ marginRight: '0.5rem' }} />
                                开始修剪
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
