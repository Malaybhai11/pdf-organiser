import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FileSectionProps {
  files: string[];
  customerId: string;
  onPreview: (fileName: string) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  onFileDeleted?: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  file: string | null;
}

const FileSection: React.FC<FileSectionProps> = ({ files, customerId, onPreview, onNotify, onFileDeleted }) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, file: null });

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ ...contextMenu, visible: false });
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  const handleFileClick = (e: React.MouseEvent, file: string) => {
    e.stopPropagation();
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file
    });
  };

  const handleCopy = async () => {
    if (contextMenu.file) {
      try {
        await navigator.clipboard.writeText(contextMenu.file);
        onNotify(`Copied filename: ${contextMenu.file}`, 'success');
      } catch (err) {
        onNotify('Failed to copy to clipboard', 'error');
      }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleDownload = async () => {
    if (contextMenu.file && customerId) {
      try {
        const resp = await invoke<any>('download_file', { 
            customerId: customerId.toString(), 
            fileName: contextMenu.file 
        });
        if (resp.success) {
            onNotify(`Downloaded to: ${resp.data}`, 'success');
        } else {
            onNotify(resp.error || 'Failed to download', 'error');
        }
      } catch (err) {
        onNotify('Failed to trigger download', 'error');
      }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleDelete = async () => {
    if (contextMenu.file && customerId) {
      const confirmDelete = window.confirm(`Are you sure you want to delete ${contextMenu.file}?`);
      if (confirmDelete) {
        try {
          const resp = await invoke<any>('delete_file', { 
              customerId: customerId.toString(), 
              fileName: contextMenu.file 
          });
          if (resp.success) {
              onNotify(`Deleted ${contextMenu.file}`, 'success');
              if (onFileDeleted) onFileDeleted();
          } else {
              onNotify(resp.error || 'Failed to delete file', 'error');
          }
        } catch (err) {
          onNotify('Failed to trigger delete', 'error');
        }
      }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  return (
    <div className="file-grid" style={{ position: 'relative' }}>
      {files.length === 0 ? (
        <p className="empty-msg" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No files uploaded.</p>
      ) : (
        files.map(file => (
          <div 
            key={file} 
            className="file-item" 
            onDoubleClick={() => onPreview(file)}
            onClick={(e) => handleFileClick(e, file)}
          >
            <div className="file-icon"></div>
            <span className="file-name" title={file}>{file}</span>
          </div>
        ))
      )}

      {contextMenu.visible && (
        <div 
            className="context-menu" 
            style={{ 
                top: contextMenu.y, 
                left: contextMenu.x 
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="context-menu-item" onClick={handleCopy}>
                Copy Filename to Clipboard
            </div>
            <div className="context-menu-item" onClick={handleDownload}>
                Download to /Downloads
            </div>
            <div className="context-menu-item delete-item" onClick={handleDelete}>
                Delete File
            </div>
        </div>
      )}
    </div>
  );
};

export default FileSection;
