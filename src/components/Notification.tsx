import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

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
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />
  };

  return (
    <div className={`notification-toast ${type}`}>
      <div className="notification-icon">
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
