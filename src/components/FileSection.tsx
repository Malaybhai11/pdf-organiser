import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Copy, Download, Eye, FileText, MoreHorizontal, Trash2 } from 'lucide-react';

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
      setContextMenu((current) => ({ ...current, visible: false }));
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const openFileMenu = (e: React.MouseEvent, file: string) => {
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
    setContextMenu((current) => ({ ...current, visible: false }));
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
    setContextMenu((current) => ({ ...current, visible: false }));
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
    setContextMenu((current) => ({ ...current, visible: false }));
  };

  const getFileLabel = (file: string) => {
    const extension = file.split('.').pop()?.toUpperCase();
    return extension || 'FILE';
  };

  return (
    <div className="file-grid">
      {files.length === 0 ? (
        <div className="empty-state-card compact">
          <div className="empty-state-icon">
            <FileText size={28} />
          </div>
          <h3>No source files yet</h3>
          <p>Drop PDFs or images into the upload area above to start building the final merged document.</p>
        </div>
      ) : (
        files.map(file => (
          <div 
            key={file} 
            className="file-item" 
            onClick={() => onPreview(file)}
            onContextMenu={(e) => openFileMenu(e, file)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPreview(file);
              }
            }}
          >
            <button
              type="button"
              className="card-menu-btn file-menu-btn"
              onClick={(e) => openFileMenu(e, file)}
              aria-label={`Open actions for ${file}`}
            >
              <MoreHorizontal size={16} />
            </button>

            <div className="file-icon">
              <FileText size={28} />
              <span className="file-badge">{getFileLabel(file)}</span>
            </div>

            <div className="file-card-copy">
              <span className="file-name" title={file}>{file}</span>
              <span className="file-hint">
                <Eye size={14} />
                Click to preview
              </span>
            </div>
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
            <button type="button" className="context-menu-item" onClick={handleCopy}>
                <Copy size={14} />
                Copy Filename to Clipboard
            </button>
            <button type="button" className="context-menu-item" onClick={handleDownload}>
                <Download size={14} />
                Download to /Downloads
            </button>
            <button type="button" className="context-menu-item delete-item" onClick={handleDelete}>
                <Trash2 size={14} />
                Delete File
            </button>
        </div>
      )}
    </div>
  );
};

export default FileSection;
