import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import { taskApi } from '../services/api';
import { Task } from '../types';
import { getErrorMessage } from '../utils';
import { Alert } from './Alert';
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

    useEffect(() => {
        loadTaskStatus();
    }, [gameId]);

    useEffect(() => {
        if (polling) {
            const interval = setInterval(loadTaskStatus, 2000);
            return () => clearInterval(interval);
        }
    }, [polling]);

    const loadTaskStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const taskData = await taskApi.getTaskStatus(gameId);
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
            await taskApi.cancelVideoMaking(gameId);
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
            <h3>视频制作</h3>

            <div className="video-generation-header">
                <div className="segment-selector">
                    <label>选择节数:</label>
                    <select
                        value={selectedSegment}
                        onChange={(e) => setSelectedSegment(parseInt(e.target.value))}
                        disabled={starting || cancelling}
                    >
                        {[1, 2, 3, 4].map(segment => (
                            <option key={segment} value={segment}>
                                第{segment}节
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
                            开始制作视频
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
                            取消制作
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

            <div className="task-status-container">
                {task && (
                    <div className="task-status">
                        <h4>任务状态</h4>

                        {task.status === 'no_task' ? (
                            <div className="alert alert-info">
                                <h5>无任务</h5>
                                <p>当前没有正在运行的任务</p>
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

                                {task.status === 'running' && (
                                    <div className="progress-indicator">
                                        <div className="loading"></div>
                                        <span>任务正在运行中...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
