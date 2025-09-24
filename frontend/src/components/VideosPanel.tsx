import React, { useState, useEffect } from 'react';
import { Upload, RefreshCw, Trash2, Copy, Play, Eye, Link, Scissors, Edit3 } from 'lucide-react';
import { videoApi } from '../services/api';
import { Video } from '../types';
import { getErrorMessage, formatFileSize, formatDate, copyToClipboard } from '../utils';
import { Alert } from './Alert';
import { VideoPreviewModal } from './VideoPreviewModal';
import { JoinVideoModal } from './JoinVideoModal';
import { TrimVideoModal } from './TrimVideoModal';
import { RenameVideoModal } from './RenameVideoModal';
import './VideosPanel.css';

interface VideosPanelProps {
    gameId: string;
}

interface VideoPreviewThumbnailProps {
    gameId: string;
    video: Video;
    onPreviewClick: () => void;
}

const VideoPreviewThumbnail: React.FC<VideoPreviewThumbnailProps> = ({
    gameId,
    video,
    onPreviewClick
}) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const handleImageError = () => {
        setImageError(true);
        setImageLoading(false);
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    return (
        <div
            className="video-preview"
            onClick={onPreviewClick}
        >
            {!imageError ? (
                <>
                    {imageLoading && (
                        <div className="video-preview-loading">
                            <div className="loading" style={{ width: '20px', height: '20px' }}></div>
                        </div>
                    )}
                    <img
                        src={videoApi.getVideoPreviewUrl(gameId, video.name, "160,90")}
                        alt={`${video.name} preview`}
                        className="video-preview-image"
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        style={{ display: imageLoading ? 'none' : 'block' }}
                    />
                </>
            ) : (
                <Eye size={24} />
            )}
        </div>
    );
};

export const VideosPanel: React.FC<VideosPanelProps> = ({ gameId }) => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deletingVideo, setDeletingVideo] = useState<string | null>(null);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [selectedVideoForJoin, setSelectedVideoForJoin] = useState<Video | null>(null);
    const [trimModalOpen, setTrimModalOpen] = useState(false);
    const [selectedVideoForTrim, setSelectedVideoForTrim] = useState<Video | null>(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [selectedVideoForRename, setSelectedVideoForRename] = useState<Video | null>(null);



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
        const videoUrl = videoApi.getVideoUrl(gameId, video.name);
        const success = await copyToClipboard(videoUrl);
        if (success) {
            // Show success message
            setError(null);
        } else {
            setError('复制失败，请手动复制链接');
        }
    };

    const handlePreviewVideo = (video: Video) => {
        setPreviewVideoUrl(videoApi.getVideoUrl(gameId, video.name));
    };

    const handleClosePreview = () => {
        setPreviewVideoUrl(null);
    };

    const handleJoinVideo = (video: Video) => {
        setSelectedVideoForJoin(video);
        setJoinModalOpen(true);
    };

    const handleCloseJoinModal = () => {
        setJoinModalOpen(false);
        setSelectedVideoForJoin(null);
    };

    const handleJoinComplete = () => {
        // Refresh video list after join is complete
        loadVideos();
    };

    const handleTrimVideo = (video: Video) => {
        setSelectedVideoForTrim(video);
        setTrimModalOpen(true);
    };

    const handleCloseTrimModal = () => {
        setTrimModalOpen(false);
        setSelectedVideoForTrim(null);
    };

    const handleTrimComplete = () => {
        // Refresh video list after trim is complete
        loadVideos();
    };

    const handleRenameVideo = (video: Video) => {
        setSelectedVideoForRename(video);
        setRenameModalOpen(true);
    };

    const handleCloseRenameModal = () => {
        setRenameModalOpen(false);
        setSelectedVideoForRename(null);
    };

    const handleRenameComplete = () => {
        // Refresh video list after rename is complete
        loadVideos();
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
                                <VideoPreviewThumbnail
                                    gameId={gameId}
                                    video={video}
                                    onPreviewClick={() => handlePreviewVideo(video)}
                                />

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
                                        className="btn btn-info btn-sm"
                                        onClick={() => handleRenameVideo(video)}
                                        title="重命名"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        className="btn btn-warning btn-sm"
                                        onClick={() => handleTrimVideo(video)}
                                        title="修剪视频"
                                    >
                                        <Scissors size={16} />
                                    </button>
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => handleJoinVideo(video)}
                                        title="拼接视频"
                                    >
                                        <Link size={16} />
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

            {joinModalOpen && selectedVideoForJoin && (
                <JoinVideoModal
                    gameId={gameId}
                    sourceVideo={selectedVideoForJoin}
                    availableVideos={videos}
                    onClose={handleCloseJoinModal}
                    onJoinComplete={handleJoinComplete}
                />
            )}

            {trimModalOpen && selectedVideoForTrim && (
                <TrimVideoModal
                    gameId={gameId}
                    sourceVideo={selectedVideoForTrim}
                    onClose={handleCloseTrimModal}
                    onTrimComplete={handleTrimComplete}
                />
            )}

            {renameModalOpen && selectedVideoForRename && (
                <RenameVideoModal
                    gameId={gameId}
                    sourceVideo={selectedVideoForRename}
                    onClose={handleCloseRenameModal}
                    onRenameComplete={handleRenameComplete}
                />
            )}
        </div>
    );
};
