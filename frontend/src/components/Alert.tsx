import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import './Alert.css';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
    type: AlertType;
    message: string;
    onClose?: () => void;
    autoClose?: boolean;
    duration?: number;
}

const iconMap = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

export const Alert: React.FC<AlertProps> = ({
    type,
    message,
    onClose,
    autoClose = true,
    duration = 5000
}) => {
    const [visible, setVisible] = useState(true);
    const Icon = iconMap[type];

    useEffect(() => {
        if (autoClose && onClose) {
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onClose, 300); // Wait for animation to complete
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [autoClose, duration, onClose]);

    const handleClose = () => {
        setVisible(false);
        if (onClose) {
            setTimeout(onClose, 300); // Wait for animation to complete
        }
    };

    if (!visible) {
        return null;
    }

    return (
        <div className={`alert alert-${type} ${visible ? 'alert-visible' : 'alert-hidden'}`}>
            <div className="alert-content">
                <Icon size={20} className="alert-icon" />
                <span className="alert-message">{message}</span>
                {onClose && (
                    <button className="alert-close" onClick={handleClose}>
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};
