import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Save, X, RefreshCw } from 'lucide-react';
import { gameApi } from '../services/api';
import { Game, UpdateGameForm } from '../types';
import { getErrorMessage } from '../utils';
import { Alert } from './Alert';
import { GameDetailTabs } from './GameDetailTabs';
import './GameDetail.css';

type TabType = 'detail' | 'events' | 'video' | 'comments' | 'videos';

export const GameDetail: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('detail');
    const [isEditMode, setIsEditMode] = useState(false);
    const [editForm, setEditForm] = useState<UpdateGameForm | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (gameId) {
            loadGameDetail();
        }
    }, [gameId]);

    const loadGameDetail = async () => {
        if (!gameId) return;

        try {
            setLoading(true);
            setError(null);
            const gameData = await gameApi.getGame(gameId);
            setGame(gameData);
            setEditForm({
                name: gameData.name,
                description: gameData.description || '',
                segments: gameData.segments,
                videos: gameData.videos,
                comment_requirement: gameData.comment_requirement || '',
                teams: gameData.teams
            });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        navigate('/');
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
    };

    const handleEditMode = () => {
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        if (game) {
            setEditForm({
                name: game.name,
                description: game.description || '',
                segments: game.segments,
                videos: game.videos,
                comment_requirement: game.comment_requirement || '',
                teams: game.teams
            });
        }
    };

    const handleSaveEdit = async () => {
        if (!gameId || !editForm) return;

        try {
            setSaving(true);
            setError(null);

            await gameApi.updateGame(gameId, editForm);
            await loadGameDetail();
            setIsEditMode(false);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleFormChange = (field: keyof UpdateGameForm, value: any) => {
        if (!editForm) return;

        setEditForm(prev => ({
            ...prev!,
            [field]: value
        }));
    };

    const handleTeamChange = (index: number, field: 'name' | 'color' | 'score', value: any) => {
        if (!editForm) return;

        setEditForm(prev => ({
            ...prev!,
            teams: prev!.teams.map((team, i) =>
                i === index ? { ...team, [field]: value } : team
            )
        }));
    };

    if (loading) {
        return (
            <div className="game-detail-container">
                <div className="loading-container">
                    <div className="loading"></div>
                    <span style={{ marginLeft: '1rem' }}>加载中...</span>
                </div>
            </div>
        );
    }

    if (error && !game) {
        return (
            <div className="game-detail-container">
                <Alert type="error" message={error} />
                <button className="btn btn-primary" onClick={handleBack}>
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} />
                    返回比赛管理
                </button>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="game-detail-container">
                <Alert type="error" message="比赛不存在" />
                <button className="btn btn-primary" onClick={handleBack}>
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} />
                    返回比赛管理
                </button>
            </div>
        );
    }

    return (
        <div className="game-detail-container">
            <div className="page-header">
                <button className="btn btn-secondary back-btn" onClick={handleBack}>
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} />
                    返回比赛管理
                </button>
                <h2>比赛: {game.name} ({gameId})</h2>
            </div>

            {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} />
            )}

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'detail' ? 'active' : ''}`}
                    onClick={() => handleTabChange('detail')}
                >
                    比赛详情
                </button>
                <button
                    className={`tab ${activeTab === 'events' ? 'active' : ''}`}
                    onClick={() => handleTabChange('events')}
                >
                    事件编辑
                </button>
                <button
                    className={`tab ${activeTab === 'comments' ? 'active' : ''}`}
                    onClick={() => handleTabChange('comments')}
                >
                    解说管理
                </button>
                <button
                    className={`tab ${activeTab === 'video' ? 'active' : ''}`}
                    onClick={() => handleTabChange('video')}
                >
                    视频生成
                </button>
                <button
                    className={`tab ${activeTab === 'videos' ? 'active' : ''}`}
                    onClick={() => handleTabChange('videos')}
                >
                    视频管理
                </button>
            </div>

            <div className="tab-content">
                <GameDetailTabs
                    activeTab={activeTab}
                    game={game}
                    editForm={editForm}
                    isEditMode={isEditMode}
                    onFormChange={handleFormChange}
                    onTeamChange={handleTeamChange}
                    onEditMode={handleEditMode}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    saving={saving}
                    onRefresh={loadGameDetail}
                />
            </div>
        </div>
    );
};
