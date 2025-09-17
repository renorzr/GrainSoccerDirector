import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { gameApi } from '../services/api';
import { CreateGameForm } from '../types';
import { getErrorMessage, validateGameName, generateGameId } from '../utils';
import { Alert } from './Alert';
import './CreateGameModal.css';

interface CreateGameModalProps {
    onClose: () => void;
    onSuccess: (gameId: string) => void;
}

export const CreateGameModal: React.FC<CreateGameModalProps> = ({ onClose, onSuccess }) => {
    const [gameName, setGameName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 验证比赛名称
        if (!validateGameName(gameName)) {
            setError('比赛名称不能为空');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // 生成比赛ID
            const gameId = generateGameId();

            // 创建默认的比赛数据
            const gameData: CreateGameForm = {
                id: gameId,
                name: gameName,
                segments: 4,
                videos: ['', '', '', ''], // 默认4节，都为空
                teams: [
                    { name: '队伍1', color: '深蓝' },
                    { name: '队伍2', color: '浅蓝' }
                ]
            };

            await gameApi.createGame(gameData);
            onSuccess(gameId);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <h2>创建新比赛</h2>

                {error && (
                    <Alert type="error" message={error} onClose={() => setError(null)} />
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="gameName">比赛名称:</label>
                        <input
                            type="text"
                            id="gameName"
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            required
                            placeholder="输入比赛名称"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-info">
                        <p>💡 比赛ID将自动生成（格式：年月日-随机数字）</p>
                        <p>📝 创建后可以在比赛详情页面进行详细配置</p>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (
                                <>
                                    <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                                    创建中...
                                </>
                            ) : (
                                <>
                                    <Plus size={16} style={{ marginRight: '0.5rem' }} />
                                    创建比赛
                                </>
                            )}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                            取消
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};