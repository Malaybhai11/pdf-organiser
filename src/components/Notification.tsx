import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />
  };

  return (
    <div className={`notification-toast ${type}`}>
      <div className={`notification-icon ${type}`}>
        {icons[type]}
      </div>
      <div className="notification-content">
        {message}
      </div>
      <button className="notification-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
};
