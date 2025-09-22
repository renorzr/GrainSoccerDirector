import React, { useState, useEffect } from 'react';
import { Upload, RefreshCw, Trash2, Copy, Play, Eye } from 'lucide-react';
import { videoApi } from '../services/api';
import { Video } from '../types';
import { getErrorMessage, formatFileSize, formatDate, copyToClipboard } from '../utils';
import { Alert } from './Alert';
import { VideoPreviewModal } from './VideoPreviewModal';
import './VideosPanel.css';

interface VideosPanelProps {
    gameId: string;
}

export const VideosPanel: React.FC<VideosPanelProps> = ({ gameId }) => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deletingVideo, setDeletingVideo] = useState<string | null>(null);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        loadVideos();
    }, [gameId]);

    const loadVideos = async () => {
        try {
            setLoading(true);
            setError(null);
            const videoList = await videoApi.getVideos(gameId);
            setVideos(videoList);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            setUploadProgress(0);
            setError(null);

            await videoApi.uploadVideo(gameId, file, (progress) => {
                setUploadProgress(progress);
            });

            await loadVideos();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setUploading(false);
            setUploadProgress(0);
            // Reset file input
            event.target.value = '';
        }
    };

    const handleDeleteVideo = async (videoName: string) => {
        if (!window.confirm('确定要删除这个视频文件吗？此操作不可撤销。')) {
            return;
        }

        try {
            setDeletingVideo(videoName);
            setError(null);
            await videoApi.deleteVideo(gameId, videoName);
            await loadVideos();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeletingVideo(null);
        }
    };

    const handleCopyUrl = async (video: Video) => {
        const success = await copyToClipboard(video.access_url);
        if (success) {
            // Show success message
            setError(null);
        } else {
            setError('复制失败，请手动复制链接');
        }
    };

    const handlePreviewVideo = (video: Video) => {
        setPreviewVideoUrl('/api' + video.access_url);
    };

    const handleClosePreview = () => {
        setPreviewVideoUrl(null);
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
        <div className="videos-panel">
            <div className="video-management-header">
                <h3>🎥 视频管理</h3>
                <div className="video-actions">
                    <input
                        type="file"
                        id="videoUploadInput"
                        accept="video/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <label htmlFor="videoUploadInput" className="btn btn-primary">
                        <Upload size={16} style={{ marginRight: '0.5rem' }} />
                        📤 上传视频
                    </label>
                    <button className="btn btn-secondary" onClick={loadVideos}>
                        <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                        🔄 刷新列表
                    </button>
                </div>
            </div>

            {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} />
            )}

            {uploading && (
                <div className="upload-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                    <span>上传中... {uploadProgress}%</span>
                </div>
            )}

            <div className="video-list-container">
                {videos.length === 0 ? (
                    <div className="empty-state">
                        <h4>📁 暂无视频文件</h4>
                        <p>点击"上传视频"按钮开始上传您的第一个视频文件</p>
                    </div>
                ) : (
                    <div className="video-list">
                        {videos.map(video => (
                            <div key={video.name} className="video-item">
                                <div
                                    className="video-preview"
                                    onClick={() => handlePreviewVideo(video)}
                                >
                                    <Eye size={24} />
                                </div>

                                <div className="video-info">
                                    <div className="video-name">{video.name}</div>
                                    <div className="video-meta">
                                        <span>📏 {formatFileSize(video.size)}</span>
                                        <span>📅 {formatDate(video.last_modified)}</span>
                                    </div>
                                </div>

                                <div className="video-actions-item">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleCopyUrl(video)}
                                        title="复制链接"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handlePreviewVideo(video)}
                                        title="预览"
                                    >
                                        <Play size={16} />
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleDeleteVideo(video.name)}
                                        disabled={deletingVideo === video.name}
                                        title="删除"
                                    >
                                        {deletingVideo === video.name ? (
                                            <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {previewVideoUrl && (
                <VideoPreviewModal
                    videoUrl={previewVideoUrl}
                    onClose={handleClosePreview}
                />
            )}
        </div>
    );
};
