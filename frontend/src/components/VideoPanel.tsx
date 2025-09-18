import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Video, FileVideo } from 'lucide-react';
import { gameApi, taskApi, videoApi } from '../services/api';
import { Game, Task } from '../types';
import { getErrorMessage } from '../utils';
import { Alert } from './Alert';
import { VideoPreviewModal } from './VideoPreviewModal';
import './VideoPanel.css';

interface VideoPanelProps {
    gameId: string;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({ gameId }) => {
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSegment, setSelectedSegment] = useState(1);
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [polling, setPolling] = useState(false);
    const [game, setGame] = useState<Game | null>(null);
    const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; videoUrl: string }>({
        isOpen: false,
        videoUrl: ''
    });

    useEffect(() => {
        loadGame();
        loadTaskStatus();
    }, [gameId]);

    useEffect(() => {
        if (polling) {
            const interval = setInterval(loadTaskStatus, 2000);
            return () => clearInterval(interval);
        }
    }, [polling]);

    const loadGame = async () => {
        const game = await gameApi.getGame(gameId);
        setGame(game);
    };

    const loadTaskStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const taskData = await taskApi.getTaskStatus(gameId, 'make_video');
            setTask(taskData);

            // 如果任务完成或失败，停止轮询
            if (taskData.status === 'completed' || taskData.status === 'failed' || taskData.status === 'cancelled') {
                setPolling(false);
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleStartVideoMaking = async () => {
        try {
            setStarting(true);
            setError(null);
            await taskApi.startVideoMaking(gameId, selectedSegment);
            setPolling(true);
            await loadTaskStatus();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setStarting(false);
        }
    };

    const handleCancelVideoMaking = async () => {
        if (!window.confirm('确定要取消视频制作任务吗？')) {
            return;
        }

        try {
            setCancelling(true);
            setError(null);
            await taskApi.cancelTask(gameId, 'make_video');
            setPolling(false);
            await loadTaskStatus();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setCancelling(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap = {
            pending: { class: 'status-pending', label: '等待中' },
            running: { class: 'status-running', label: '运行中' },
            completed: { class: 'status-completed', label: '已完成' },
            failed: { class: 'status-failed', label: '失败' },
            cancelled: { class: 'status-cancelled', label: '已取消' },
            no_task: { class: 'status-no-task', label: '无任务' }
        };

        const statusInfo = statusMap[status as keyof typeof statusMap] || { class: 'status-unknown', label: status };

        return (
            <span className={`status-badge ${statusInfo.class}`}>
                {statusInfo.label}
            </span>
        );
    };

    const formatDateTime = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('zh-CN');
    };

    const handleVideoPreview = (videoIndex: number) => {
        const videoUrl = videoApi.getVideoUrl(`output-${videoIndex + 1}.mp4`);
        setPreviewModal({
            isOpen: true,
            videoUrl: videoUrl
        });
    };

    const closePreviewModal = () => {
        setPreviewModal({
            isOpen: false,
            videoUrl: ''
        });
    };

    const checkVideoExists = async (filename: string): Promise<boolean> => {
        try {
            const response = await fetch(videoApi.getVideoUrl(filename), { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    };

    if (loading && !task) {
        return (
            <div className="loading-container">
                <div className="loading"></div>
                <span style={{ marginLeft: '1rem' }}>加载中...</span>
            </div>
        );
    }

    return (
        <div className="video-panel">
            <h3>已生成视频</h3>
            <div className="video-preview-grid">
                {game?.videos.map((video, index) => (
                    <VideoPreviewCard
                        key={index}
                        index={index}
                        onPreview={handleVideoPreview}
                    />
                ))}
            </div>

            <h3>视频生成</h3>

            <div className="video-generation-header">
                <div className="segment-selector">
                    <label>选择节数:</label>
                    <select
                        value={selectedSegment}
                        onChange={(e) => setSelectedSegment(parseInt(e.target.value))}
                        disabled={starting || cancelling}
                    >
                        {game?.videos.map((_, index) => (
                            <option key={index} value={index + 1}>
                                第{index + 1}节
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} />
            )}

            <div className="video-actions">
                <button
                    className="btn btn-primary"
                    onClick={handleStartVideoMaking}
                    disabled={starting || cancelling || (task?.status === 'running')}
                >
                    {starting ? (
                        <>
                            <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                            启动中...
                        </>
                    ) : (
                        <>
                            <Play size={16} style={{ marginRight: '0.5rem' }} />
                            开始生成视频
                        </>
                    )}
                </button>

                <button
                    className="btn btn-danger"
                    onClick={handleCancelVideoMaking}
                    disabled={starting || cancelling || (task?.status !== 'running')}
                >
                    {cancelling ? (
                        <>
                            <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                            取消中...
                        </>
                    ) : (
                        <>
                            <Square size={16} style={{ marginRight: '0.5rem' }} />
                            取消生成
                        </>
                    )}
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={loadTaskStatus}
                    disabled={starting || cancelling}
                >
                    <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                    刷新状态
                </button>
            </div>

            {task && (
                <div className="task-status">
                    <h4>任务状态</h4>

                    {task.status === 'no_task' ? (
                        <div className="alert alert-info">
                            <h5>无任务</h5>
                            <p>当前没有正在运行的视频生成任务</p>
                        </div>
                    ) : (
                        <div className="task-details">
                            <div className="task-info">
                                <div className="info-row">
                                    <span className="label">状态:</span>
                                    {getStatusBadge(task.status)}
                                </div>

                                <div className="info-row">
                                    <span className="label">任务ID:</span>
                                    <span className="value">{task.id}</span>
                                </div>

                                <div className="info-row">
                                    <span className="label">当前步骤:</span>
                                    <span className="value">{task.stage}</span>
                                </div>

                                {task.created_at && (
                                    <div className="info-row">
                                        <span className="label">创建时间:</span>
                                        <span className="value">{formatDateTime(task.created_at)}</span>
                                    </div>
                                )}

                                {task.started_at && (
                                    <div className="info-row">
                                        <span className="label">开始时间:</span>
                                        <span className="value">{formatDateTime(task.started_at)}</span>
                                    </div>
                                )}

                                {task.completed_at && (
                                    <div className="info-row">
                                        <span className="label">完成时间:</span>
                                        <span className="value">{formatDateTime(task.completed_at)}</span>
                                    </div>
                                )}

                                {task.message && (
                                    <div className="info-row">
                                        <span className="label">消息:</span>
                                        <span className="value">{task.message}</span>
                                    </div>
                                )}

                                {task.error && (
                                    <div className="info-row error-row">
                                        <span className="label">错误:</span>
                                        <span className="value error-text">{task.error}</span>
                                    </div>
                                )}
                            </div>

                            {/* 进度条 */}
                            {task.status === 'running' && (
                                <div className="progress-section">
                                    <div className="progress-header">
                                        <div className="loading"></div>
                                        <span>视频生成中...</span>
                                        <span className="progress-percentage">{Math.floor(task.progress || 0)}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${task.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 视频预览模态框 */}
            {previewModal.isOpen && (
                <VideoPreviewModal
                    videoUrl={previewModal.videoUrl}
                    onClose={closePreviewModal}
                />
            )}
        </div>
    );
};

// 视频预览卡片组件
interface VideoPreviewCardProps {
    index: number;
    onPreview: (index: number) => void;
}

const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({ index, onPreview }) => {
    const [videoExists, setVideoExists] = useState<boolean | null>(null);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        const checkExists = async () => {
            try {
                const response = await fetch(videoApi.getVideoPreviewUrl(`output-${index + 1}.mp4`), { method: 'HEAD' });
                setVideoExists(response.ok);
            } catch {
                setVideoExists(false);
            }
        };
        checkExists();
    }, [index]);

    const handleClick = () => {
        if (videoExists) {
            onPreview(index);
        }
    };

    const handleImageError = () => {
        setImageError(true);
    };

    return (
        <div
            className={`video-preview-card ${videoExists ? 'exists' : 'placeholder'}`}
            onClick={handleClick}
        >
            <div className="video-preview-content">
                {videoExists ? (
                    <>
                        {!imageError ? (
                            <img
                                src={videoApi.getVideoPreviewUrl(`output-${index + 1}.mp4`, "200,150")}
                                alt={`第${index + 1}节`}
                                onError={handleImageError}
                            />
                        ) : (
                            <div className="video-placeholder">
                                <Video size={32} />
                            </div>
                        )}
                        <div className="video-overlay">
                            <Play size={24} />
                        </div>
                    </>
                ) : (
                    <div className="video-placeholder">
                        <FileVideo size={32} />
                        <span>视频未生成</span>
                    </div>
                )}
            </div>
            <div className="video-preview-label">
                第{index + 1}节
            </div>
        </div>
    );
};
