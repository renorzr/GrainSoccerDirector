import React, { useState, useEffect } from 'react';
import { Edit, Save, X, RefreshCw } from 'lucide-react';
import { Game, UpdateGameForm, TEAM_COLORS, Team } from '../types';
import { getColorValue } from '../utils';
import { videoApi } from '../services/api';
import { Video } from '../types';
import './GameDetailPanel.css';
import { VideoPreviewModal } from './VideoPreviewModal';

interface GameDetailPanelProps {
    game: Game;
    editForm: UpdateGameForm | null;
    isEditMode: boolean;
    onFormChange: (field: keyof UpdateGameForm, value: any) => void;
    onTeamChange: (index: number, field: 'name' | 'color' | 'score', value: any) => void;
    onEditMode: () => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    saving: boolean;
    onRefresh: () => void;
}

export const GameDetailPanel: React.FC<GameDetailPanelProps> = ({
    game,
    editForm,
    isEditMode,
    onFormChange,
    onTeamChange,
    onEditMode,
    onCancelEdit,
    onSaveEdit,
    saving,
    onRefresh
}) => {
    const [availableVideos, setAvailableVideos] = useState<Video[]>([]);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        loadVideos();
    }, []);

    const loadVideos = async () => {
        try {
            const videos = await videoApi.getVideos();
            setAvailableVideos(videos);
        } catch (error) {
            console.error('Failed to load videos:', error);
        }
    };

    const handleVideoChange = (segmentIndex: number, videoName: string) => {
        if (!editForm) return;

        const newVideos = [...editForm.videos];
        newVideos[segmentIndex] = videoName;
        onFormChange('videos', newVideos);
    };

    const generateVideoSelectors = () => {
        if (!editForm) return null;

        const selectors = [];
        for (let i = 1; i <= editForm.segments; i++) {
            selectors.push(
                <div key={i} className="info-item">
                    <label>第{i}节视频:</label>
                    <div className="video-selection-container">
                        <select
                            value={editForm.videos[i - 1] || ''}
                            onChange={(e) => handleVideoChange(i - 1, e.target.value)}
                            className="editable-select segment-video-select"
                            disabled={!isEditMode}
                        >
                            <option value="">请选择视频</option>
                            {availableVideos.map(video => (
                                <option key={video.name} value={video.name}>
                                    {video.name}
                                </option>
                            ))}
                        </select>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => previewVideo(editForm.videos[i - 1])}
                            disabled={!editForm.videos[i - 1]}
                        >
                            预览
                        </button>
                    </div>
                </div>
            );
        }
        return selectors;
    };

    const previewVideo = (videoName: string) => {
        if (!videoName) return;
        const videoUrl = videoApi.getVideoUrl(videoName);
        setPreviewVideoUrl(videoUrl);
    };

    const handleClosePreview = () => {
        setPreviewVideoUrl(null);
    };

    if (!editForm) return null;

    return (
        <>
            <div className="match-details-container">
                {/* 比赛基本信息 */}
                <div className="match-info-section">
                    <h3>📋 比赛信息</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>比赛名称:</label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => onFormChange('name', e.target.value)}
                                className="editable-input"
                                readOnly={!isEditMode}
                            />
                        </div>
                        <div className="info-item full-width">
                            <label>比赛描述:</label>
                            <textarea
                                value={editForm.description}
                                onChange={(e) => onFormChange('description', e.target.value)}
                                className="editable-textarea"
                                rows={2}
                                readOnly={!isEditMode}
                            />
                        </div>
                    </div>
                </div>

                {/* 队伍信息 */}
                <div className="teams-section">
                    <h3>⚽ 队伍信息</h3>
                    <div className="teams-grid">
                        {teamCard(0, editForm.teams[0], onTeamChange, isEditMode)}
                        <div className="vs-divider">
                            <span>VS</span>
                        </div>
                        {teamCard(1, editForm.teams[1], onTeamChange, isEditMode)}
                    </div>
                </div>

                {/* 视频信息 */}
                <div className="video-section">
                    <h3>🎥 视频信息</h3>
                    <div className="video-info">
                        <div className="info-item">
                            <label>比赛节数:</label>
                            <input
                                type="number"
                                value={editForm.segments}
                                onChange={(e) => {
                                    const segments = parseInt(e.target.value) || 4;
                                    const newVideos = Array(segments).fill('');
                                    onFormChange('segments', segments);
                                    onFormChange('videos', newVideos);
                                }}
                                className="editable-input"
                                min="1"
                                max="10"
                                readOnly={!isEditMode}
                            />
                        </div>
                        <div id="segmentsVideoContainer">
                            {generateVideoSelectors()}
                        </div>
                    </div>
                </div>

                {/* 评论要求 */}
                <div className="comment-requirement-section">
                    <h3>💬 评论要求</h3>
                    <div className="info-item">
                        <textarea
                            value={editForm.comment_requirement}
                            onChange={(e) => onFormChange('comment_requirement', e.target.value)}
                            className="editable-textarea"
                            rows={2}
                            readOnly={!isEditMode}
                        />
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="match-actions">
                    {!isEditMode ? (
                        <>
                            <button className="btn btn-primary" onClick={onEditMode}>
                                <Edit size={16} style={{ marginRight: '0.5rem' }} />
                                编辑
                            </button>
                            <button className="btn btn-secondary" onClick={onRefresh}>
                                <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                                刷新信息
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn btn-success"
                                onClick={onSaveEdit}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                                        保存中...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} style={{ marginRight: '0.5rem' }} />
                                        保存
                                    </>
                                )}
                            </button>
                            <button className="btn btn-secondary" onClick={onCancelEdit}>
                                <X size={16} style={{ marginRight: '0.5rem' }} />
                                取消
                            </button>
                        </>
                    )}
                </div>
            </div>

            {previewVideoUrl && (
                <VideoPreviewModal
                    videoUrl={previewVideoUrl}
                    onClose={handleClosePreview}
                />
            )}
        </>
    );
};

const teamCard = (index: number, team: Team, onTeamChange: (index: number, field: 'name' | 'color' | 'score', value: any) => void, isEditMode: boolean) => (
    <div key={index} className="team-card">
        <div className="team-header">
            <div
                className="team-color"
                style={{ backgroundColor: getColorValue(team.color as any) }}
            ></div>
            <input
                type="text"
                value={team.name}
                onChange={(e) => onTeamChange(index, 'name', e.target.value)}
                className="editable-input team-name-input"
                readOnly={!isEditMode}
            />
        </div>
        {isEditMode && (
            <div className="team-color-select">
                <label>队伍颜色:</label>
                <select
                    value={team.color}
                    onChange={(e) => onTeamChange(index, 'color', e.target.value)}
                    className="editable-select"
                >
                    {TEAM_COLORS.map(color => (
                        <option key={color} value={color}>
                            {color}
                        </option>
                    ))}
                </select>
            </div>
        )}
    </div>
);
