import React, { useState, useEffect } from 'react';
import { Edit, Play, Save, X, Square, RefreshCw } from 'lucide-react';
import { commentsApi, gameApi, taskApi } from '../services/api';
import { Comment, Game, Task } from '../types';
import { formatTime, getErrorMessage } from '../utils';
import { Alert } from './Alert';
import './CommentsPanel.css';

interface CommentsPanelProps {
    gameId: string;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({ gameId }) => {
    const [currentSegment, setCurrentSegment] = useState(1);
    const [currentComments, setCurrentComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [analyzeTask, setAnalyzeTask] = useState<Task | null>(null);
    const [generating, setGenerating] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [polling, setPolling] = useState(false);
    const [game, setGame] = useState<Game | null>(null);

    useEffect(() => {
        loadGame();
        loadComments();
        loadAnalyzeTaskStatus();
    }, [gameId, currentSegment]);

    useEffect(() => {
        if (polling) {
            const interval = setInterval(loadAnalyzeTaskStatus, 2000);
            return () => clearInterval(interval);
        }
    }, [polling]);

    const loadGame = async () => {
        const game = await gameApi.getGame(gameId);
        setGame(game);
    };

    const loadComments = async () => {
        try {
            setLoading(true);
            setError(null);
            const comments = await commentsApi.getComments(gameId, currentSegment);
            console.log('loadComments', comments);
            setCurrentComments(comments);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const loadAnalyzeTaskStatus = async () => {
        try {
            const taskData = await taskApi.getTaskStatus(gameId, 'analyze_game');
            setAnalyzeTask(taskData);

            // 如果任务完成或失败，停止轮询
            if (taskData.status === 'completed' || taskData.status === 'failed' || taskData.status === 'cancelled') {
                setPolling(false);
                setGenerating(false);
                // 任务完成后重新加载解说
                if (taskData.status === 'completed') {
                    await loadComments();
                }
            }
        } catch (err) {
            console.error('Failed to load analyze task status:', err);
        }
    };

    const handleSegmentChange = (segment: number) => {
        setCurrentSegment(segment);
        setEditingComment(null);
        setEditText('');
        loadComments();
    };

    const handleEditComment = (index: number) => {
        const comment = currentComments[index];
        setEditText(comment.text);
        setEditingComment(index);
    };

    const handleSaveComment = async () => {
        if (!editText.trim()) {
            setError('解说内容不能为空');
            return;
        }

        try {
            const comment = currentComments[editingComment!];
            await commentsApi.updateComment(gameId, currentSegment, editingComment!, {
                time: comment.time,
                text: editText.trim()
            });

            await loadComments();
            setEditingComment(null);
            setEditText('');
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const handleCancelEdit = () => {
        setEditingComment(null);
        setEditText('');
    };

    const handleGenerateComments = async () => {
        try {
            setGenerating(true);
            setError(null);
            await taskApi.startAnalyzeGame(gameId, currentSegment);
            setPolling(true);
            await loadAnalyzeTaskStatus();
        } catch (err) {
            setError(getErrorMessage(err));
            setGenerating(false);
        }
    };

    const handleCancelGenerate = async () => {
        if (!window.confirm('确定要取消生成解说任务吗？')) {
            return;
        }

        try {
            setCancelling(true);
            setError(null);
            await taskApi.cancelTask(gameId, 'analyze_game');
            setPolling(false);
            setGenerating(false);
            await loadAnalyzeTaskStatus();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setCancelling(false);
        }
    };

    const handlePlayComment = async (index: number) => {
        const audio = new Audio(`/api/game/${gameId}/comment/${currentSegment}/${index}/voice`);
        audio.play();
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

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading"></div>
                <span style={{ marginLeft: '1rem' }}>加载中...</span>
            </div>
        );
    }

    return (
        <div className="comments-panel">
            <h3>解说管理</h3>

            <div className="comments-header">
                <div className="segment-selector">
                    <label>选择节数:</label>
                    <select
                        value={currentSegment}
                        onChange={(e) => handleSegmentChange(parseInt(e.target.value))}
                        disabled={generating || cancelling}
                    >
                        {game?.videos.map((_, index) => (
                            <option key={index} value={index + 1}>
                                第{index + 1}节
                            </option>
                        ))}
                    </select>
                </div>
                <div className="comment-actions">
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleGenerateComments}
                        disabled={generating || cancelling || (analyzeTask?.status === 'running')}
                    >
                        {generating ? (
                            <>
                                <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                                生成中...
                            </>
                        ) : (
                            '生成解说'
                        )}
                    </button>

                    {analyzeTask?.status === 'running' && (
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={handleCancelGenerate}
                            disabled={cancelling}
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
                    )}

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={loadAnalyzeTaskStatus}
                        disabled={generating || cancelling}
                    >
                        <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                        刷新状态
                    </button>
                </div>
            </div>

            {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} />
            )}

            {/* 任务状态显示 */}
            {analyzeTask && analyzeTask.status !== 'no_task' && (
                <div className="task-status">
                    <h4>生成解说任务状态</h4>
                    <div className="task-details">
                        <div className="task-info">
                            <div className="info-row">
                                <span className="label">状态:</span>
                                {getStatusBadge(analyzeTask.status)}
                            </div>

                            {analyzeTask.created_at && (
                                <div className="info-row">
                                    <span className="label">创建时间:</span>
                                    <span className="value">{formatDateTime(analyzeTask.created_at)}</span>
                                </div>
                            )}

                            {analyzeTask.started_at && (
                                <div className="info-row">
                                    <span className="label">开始时间:</span>
                                    <span className="value">{formatDateTime(analyzeTask.started_at)}</span>
                                </div>
                            )}

                            {analyzeTask.completed_at && (
                                <div className="info-row">
                                    <span className="label">完成时间:</span>
                                    <span className="value">{formatDateTime(analyzeTask.completed_at)}</span>
                                </div>
                            )}

                            {analyzeTask.message && (
                                <div className="info-row">
                                    <span className="label">消息:</span>
                                    <span className="value">{analyzeTask.message}</span>
                                </div>
                            )}

                            {analyzeTask.error && (
                                <div className="info-row error-row">
                                    <span className="label">错误:</span>
                                    <span className="value error-text">{analyzeTask.error}</span>
                                </div>
                            )}
                        </div>

                        {/* 进度条 */}
                        {analyzeTask.status === 'running' && (
                            <div className="progress-section">
                                <div className="progress-header">
                                    <div className="loading"></div>
                                    <span>生成解说中...</span>
                                    <span className="progress-percentage">{Math.floor(analyzeTask.progress || 0)}%</span>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${analyzeTask.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="comments-list">
                {/* 生成解说时不显示已有解说列表 */}
                {analyzeTask?.status === 'running' ? (
                    <div className="empty-state">
                        <h4>🔄 正在生成解说...</h4>
                        <p>请稍候，解说生成完成后将自动显示</p>
                    </div>
                ) : currentComments.length === 0 ? (
                    <div className="empty-state">
                        <h4>📝 暂无解说数据</h4>
                        <p>该节数还没有解说数据</p>
                    </div>
                ) : (
                    currentComments.map((comment, index) => (
                        <div key={index} className="comment-card">
                            <div className="comment-header">
                                <h4>解说 {index + 1}</h4>
                                <span className="comment-time">{formatTime(comment.time)}</span>
                            </div>

                            {editingComment === index ? (
                                <div className="comment-edit">
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="comment-textarea"
                                        rows={3}
                                        placeholder="输入解说内容..."
                                    />
                                    <div className="comment-edit-actions">
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={handleSaveComment}
                                        >
                                            <Save size={16} style={{ marginRight: '0.5rem' }} />
                                            保存
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={handleCancelEdit}
                                        >
                                            <X size={16} style={{ marginRight: '0.5rem' }} />
                                            取消
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="comment-content">
                                    <p className="comment-text">{comment.text}</p>
                                    <div className="comment-card-actions">
                                        <button
                                            className="btn btn-warning btn-sm"
                                            onClick={() => handleEditComment(index)}
                                        >
                                            <Edit size={16} style={{ marginRight: '0.5rem' }} />
                                            编辑
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handlePlayComment(index)}
                                        >
                                            <Play size={16} style={{ marginRight: '0.5rem' }} />
                                            播放
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
