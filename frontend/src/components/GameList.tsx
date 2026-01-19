import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2, Play } from 'lucide-react';
import { gameApi } from '../services/api';
import { getErrorMessage } from '../utils';
import { CreateGameModal } from './CreateGameModal';
import { Alert } from './Alert';
import './GameList.css';

export const GameList: React.FC = () => {
    const [games, setGames] = useState<{ name: string; id: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deletingGame, setDeletingGame] = useState<string | null>(null);
    const navigate = useNavigate();

    const loadGames = async () => {
        try {
            setLoading(true);
            setError(null);
            const gameList = await gameApi.getGames();
            setGames(gameList);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGames();
    }, []);

    const handleCreateGame = () => {
        setShowCreateModal(true);
    };

    const handleGameCreated = (gameId: string) => {
        setShowCreateModal(false);
        // 跳转到比赛详情页面
        navigate(`/g/${gameId}`);
    };

    const handleDeleteGame = async (gameId: string) => {
        const confirmString = window.prompt(`确定要删除比赛 ${gameId} 吗？此操作不可撤销！\n请输入 "${gameId}" 确认删除：`);
        if (confirmString !== gameId) {
            return;
        }


        try {
            setDeletingGame(gameId);
            await gameApi.deleteGame(gameId);
            setGames(games.filter(game => game.id !== gameId));
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeletingGame(null);
        }
    };

    const handleEnterGame = (gameId: string) => {
        navigate(`/g/${gameId}`);
    };

    if (loading) {
        return (
            <div className="game-list-container">
                <div className="loading-container">
                    <div className="loading"></div>
                    <span style={{ marginLeft: '1rem' }}>加载中...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="game-list-container">
            <div className="page-header">
                <div>
                    <h1>⚽ 足球导演</h1>
                    <p>Soccer Director - 智能足球视频制作系统</p>
                </div>
            </div>

            <div className="main-content">
                <div className="content-header">
                    <h2>比赛管理</h2>
                    <div className="page-actions">
                        <button className="btn btn-primary" onClick={handleCreateGame}>
                            <Plus size={16} style={{ marginRight: '0.5rem' }} />
                            创建新比赛
                        </button>
                        <button className="btn btn-secondary" onClick={loadGames}>
                            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                            刷新比赛列表
                        </button>
                    </div>
                </div>

                {error && (
                    <Alert type="error" message={error} onClose={() => setError(null)} />
                )}

                <div className="games-grid">
                    {games.length === 0 ? (
                        <div className="empty-state">
                            <h3>📁 暂无比赛数据</h3>
                            <p>点击"创建新比赛"按钮开始创建您的第一个比赛</p>
                            <button className="btn btn-primary" onClick={handleCreateGame}>
                                <Plus size={16} style={{ marginRight: '0.5rem' }} />
                                创建比赛
                            </button>
                        </div>
                    ) : (
                        games.map(({ id: gameId, name: gameName }) => (
                            <div key={gameId} className="game-card">
                                <div className="game-card-header">
                                    <h3>比赛: {gameName}</h3>
                                    <span className="game-id">ID: {gameId}</span>
                                </div>
                                <div className="game-card-content">
                                    <p>点击进入比赛详情页面，管理比赛信息、事件、视频制作等。</p>
                                </div>
                                <div className="game-card-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleEnterGame(gameId)}
                                    >
                                        <Play size={16} style={{ marginRight: '0.5rem' }} />
                                        进入比赛
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => handleDeleteGame(gameId)}
                                        disabled={deletingGame === gameId}
                                    >
                                        {deletingGame === gameId ? (
                                            <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                                        ) : (
                                            <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                                        )}
                                        删除比赛
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {showCreateModal && (
                <CreateGameModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleGameCreated}
                />
            )}
        </div>
    );
};
