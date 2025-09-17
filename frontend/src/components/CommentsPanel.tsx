import React, { useState, useEffect } from 'react';
import { Edit, Play, Save, X } from 'lucide-react';
import { commentsApi } from '../services/api';
import { Comment } from '../types';
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

    useEffect(() => {
        loadComments();
    }, [gameId, currentSegment]);

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

    const handleSegmentChange = (segment: number) => {
        console.log('handleSegmentChange', segment);
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
            setError('评论内容不能为空');
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
        await commentsApi.analyzeGame(gameId, currentSegment);
        await loadComments();
        setError(null);
    };

    const handlePlayComment = async (index: number) => {
        const audio = new Audio(`/api/game/${gameId}/comment/${currentSegment}/${index}/voice`);
        audio.play();
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
                    >
                        {[1, 2, 3, 4].map(segment => (
                            <option key={segment} value={segment}>
                                第{segment}节
                            </option>
                        ))}
                    </select>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleGenerateComments}>
                    生成解说
                </button>
            </div>

            {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} />
            )}

            <div className="comments-list">
                {currentComments.length === 0 ? (
                    <div className="empty-state">
                        <h4>📝 暂无评论数据</h4>
                        <p>该节数还没有评论数据</p>
                    </div>
                ) : (
                    currentComments.map((comment, index) => (
                        <div key={index} className="comment-card">
                            <div className="comment-header">
                                <h4>评论 {index + 1}</h4>
                                <span className="comment-time">{formatTime(comment.time)}</span>
                            </div>

                            {editingComment === index ? (
                                <div className="comment-edit">
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="comment-textarea"
                                        rows={3}
                                        placeholder="输入评论内容..."
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
                                    <div className="comment-actions">
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
