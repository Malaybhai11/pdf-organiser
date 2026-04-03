import React from 'react';

interface ProgressBarProps {
  percentage: number;
  message: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, message }) => {
  return (
    <div className="progress-container">
      <div className="progress-info">
        <span className="progress-message">{message}</span>
        <span className="progress-percentage">{Math.round(percentage)}%</span>
      </div>
      <div className="progress-bar-bg">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};
