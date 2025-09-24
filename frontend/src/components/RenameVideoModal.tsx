import React, { useState, useEffect } from 'react';
import { X, Edit3, AlertCircle } from 'lucide-react';
import { videoApi } from '../services/api';
import { Video } from '../types';
import { getErrorMessage } from '../utils';
import { Alert } from './Alert';
import './RenameVideoModal.css';

interface RenameVideoModalProps {
    gameId: string;
    sourceVideo: Video;
    onClose: () => void;
    onRenameComplete: () => void;
}

export const RenameVideoModal: React.FC<RenameVideoModalProps> = ({
    gameId,
    sourceVideo,
    onClose,
    onRenameComplete
}) => {
    const [newFilename, setNewFilename] = useState<string>('');
    const [renaming, setRenaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Extract filename without extension and extension separately
    const getFilenameParts = (filename: string) => {
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return { name: filename, extension: '' };
        }
        return {
            name: filename.substring(0, lastDotIndex),
            extension: filename.substring(lastDotIndex)
        };
    };

    const { name: originalName, extension } = getFilenameParts(sourceVideo.name);

    useEffect(() => {
        // Initialize with original filename (without extension)
        setNewFilename(originalName);
    }, [originalName]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleRenameVideo = async () => {
        if (!newFilename.trim()) {
            setError('文件名不能为空');
            return;
        }

        if (newFilename.trim() === originalName) {
            setError('新文件名与当前文件名相同');
            return;
        }

        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(newFilename)) {
            setError('文件名包含无效字符: < > : " / \\ | ? *');
            return;
        }

        const fullNewFilename = newFilename.trim() + extension;

        try {
            setRenaming(true);
            setError(null);

            await videoApi.renameVideo(gameId, sourceVideo.name, fullNewFilename);

            // Rename completed successfully
            onRenameComplete();
            onClose();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setRenaming(false);
        }
    };

    const handleCancel = () => {
        onClose();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Prevent entering extension characters
        if (!value.includes('.')) {
            setNewFilename(value);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleCancel}>
            <div className="rename-video-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={handleCancel}>
                    <X size={24} />
                </button>

                <h2>✏️ 重命名视频</h2>

                <div className="rename-video-info">
                    <div className="source-video">
                        <h4>当前文件名：</h4>
                        <div className="video-item-small">
                            <span className="video-name">{sourceVideo.name}</span>
                        </div>
                    </div>

                    <div className="rename-settings">
                        <h4>新文件名：</h4>
                        <div className="filename-input-group">
                            <div className="filename-input-container">
                                <input
                                    type="text"
                                    value={newFilename}
                                    onChange={handleInputChange}
                                    disabled={renaming}
                                    className="filename-input"
                                    placeholder="请输入新文件名"
                                    maxLength={100}
                                />
                                <span className="extension-display">{extension}</span>
                            </div>
                            <div className="filename-preview">
                                完整文件名: <span className="preview-filename">{newFilename.trim() || '新文件名'}{extension}</span>
                            </div>
                        </div>

                        <div className="rename-tips">
                            <AlertCircle size={16} />
                            <span>提示：只能修改主文件名，扩展名 {extension} 不可修改</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <Alert type="error" message={error} onClose={() => setError(null)} />
                )}

                <div className="modal-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                        disabled={renaming}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleRenameVideo}
                        disabled={renaming || !newFilename.trim() || newFilename.trim() === originalName}
                    >
                        {renaming ? (
                            <>
                                <div className="loading" style={{ width: '16px', height: '16px', marginRight: '0.5rem' }}></div>
                                重命名中...
                            </>
                        ) : (
                            <>
                                <Edit3 size={16} style={{ marginRight: '0.5rem' }} />
                                确认重命名
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
