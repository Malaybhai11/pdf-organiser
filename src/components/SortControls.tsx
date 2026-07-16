import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type SortField = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

interface SortControlsProps {
  onSortChange: (field: SortField, direction: SortDirection) => void;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date Modified' },
  { value: 'size', label: 'File Size' },
];

const SortControls: React.FC<SortControlsProps> = ({ onSortChange }) => {
  const [activeField, setActiveField] = useState<SortField>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    let newDir: SortDirection = 'asc';
    if (field === activeField) {
      newDir = direction === 'asc' ? 'desc' : 'asc';
    }
    setActiveField(field);
    setDirection(newDir);
    onSortChange(field, newDir);
  };

  return (
    <div className="sort-controls" style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)'
    }}>
      <ArrowUpDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginRight: '6px' }}>Sort:</span>
      {SORT_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleSort(opt.value)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: activeField === opt.value ? 'rgba(99,102,241,0.12)' : 'transparent',
            color: activeField === opt.value ? '#818cf8' : 'rgba(255,255,255,0.5)',
            fontSize: '12px', cursor: 'pointer'
          }}
        >
          {opt.label}
          {activeField === opt.value && (
            direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
          )}
        </button>
      ))}
    </div>
  );
};

export default SortControls;
export type { SortField, SortDirection };
