import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GripVertical, X, ArrowUp, ArrowDown, FileText } from 'lucide-react';

interface MergeQueueProps {
  files: string[];
  customerId: string;
  onReorder: (files: string[]) => void;
  onRemove: (fileName: string) => void;
  onMerge: () => void;
}

const MergeQueue: React.FC<MergeQueueProps> = ({ files, customerId, onReorder, onRemove, onMerge }) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const newFiles = [...files];
    const [removed] = newFiles.splice(dragIndex, 1);
    newFiles.splice(index, 0, removed);
    onReorder(newFiles);
    setDragIndex(null);
  }, [dragIndex, files, onReorder]);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newFiles = [...files];
    [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
    onReorder(newFiles);
  }, [files, onReorder]);

  const moveDown = useCallback((index: number) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
    onReorder(newFiles);
  }, [files, onReorder]);

  if (files.length === 0) return null;

  return (
    <div className="merge-queue" style={{
      marginTop: '16px', background: 'rgba(99,102,241,0.05)',
      border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid rgba(99,102,241,0.1)'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} /> Merge Queue ({files.length})
        </h3>
        <button onClick={onMerge} style={{
          padding: '6px 16px', background: '#818cf8', border: 'none',
          borderRadius: '6px', color: '#fff', fontWeight: 600,
          fontSize: '13px', cursor: 'pointer'
        }}>
          Merge All
        </button>
      </div>
      <div style={{ padding: '8px' }}>
        {files.map((file, i) => (
          <div key={file} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', marginBottom: '4px',
            background: dragIndex === i ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
            borderRadius: '8px', border: dragIndex === i ? '1px dashed rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.04)',
            cursor: 'move', transition: 'all 0.15s'
          }}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
          >
            <div style={{ color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center' }}>
              <GripVertical size={14} />
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', minWidth: '20px' }}>{i + 1}.</span>
            <span style={{ flex: 1, fontSize: '14px', color: '#fff' }}>{file}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => moveUp(i)} disabled={i === 0}
                style={{ background: 'none', border: 'none', color: i === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)', cursor: i === 0 ? 'default' : 'pointer' }}>
                <ArrowUp size={14} />
              </button>
              <button onClick={() => moveDown(i)} disabled={i === files.length - 1}
                style={{ background: 'none', border: 'none', color: i === files.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)', cursor: i === files.length - 1 ? 'default' : 'pointer' }}>
                <ArrowDown size={14} />
              </button>
              <button onClick={() => onRemove(file)}
                style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MergeQueue;
