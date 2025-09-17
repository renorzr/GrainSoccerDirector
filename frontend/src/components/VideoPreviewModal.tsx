import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './VideoPreviewModal.css';

interface VideoPreviewModalProps {
    videoUrl: string;
    onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ videoUrl, onClose }) => {
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <h2>视频预览</h2>

                <div className="video-container">
                    <video
                        src={videoUrl}
                        controls
                        preload="metadata"
                        className="preview-video"
                    />
                </div>
            </div>
        </div>
    );
};
