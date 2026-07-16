import React from 'react';
import { Trash2, Download, Tags, X } from 'lucide-react';

interface BatchActionsProps {
  selectedCount: number;
  onDelete: () => void;
  onDownload: () => void;
  onTag: () => void;
  onClear: () => void;
}

const BatchActions: React.FC<BatchActionsProps> = ({ selectedCount, onDelete, onDownload, onTag, onClear }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="batch-actions" style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px', background: 'rgba(99,102,241,0.08)',
      borderBottom: '1px solid rgba(99,102,241,0.15)',
      borderRadius: '8px', margin: '8px 16px'
    }}>
      <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
        {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={onDelete} style={btnStyle}>
        <Trash2 size={14} /> Delete
      </button>
      <button onClick={onDownload} style={btnStyle}>
        <Download size={14} /> Download
      </button>
      <button onClick={onTag} style={btnStyle}>
        <Tags size={14} /> Tag
      </button>
      <button onClick={onClear} style={{ ...btnStyle, color: 'rgba(255,255,255,0.4)' }}>
        <X size={14} /> Clear
      </button>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '6px 12px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px', color: '#fff', fontSize: '13px',
  cursor: 'pointer'
};

export default BatchActions;
