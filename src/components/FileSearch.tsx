import React, { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface FileSearchProps {
  onSearch: (query: string) => void;
  onFilterChange: (filter: string) => void;
}

const FILE_FILTERS = [
  { value: 'all', label: 'All Files' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'other', label: 'Other' },
];

const FileSearch: React.FC<FileSearchProps> = ({ onSearch, onFilterChange }) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  const handleFilter = useCallback((filter: string) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  }, [onFilterChange]);

  return (
    <div className="file-search-bar" style={{
      display: 'flex', gap: '12px', alignItems: 'center',
      padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div className="search-input-wrapper" style={{
        position: 'relative', flex: 1, maxWidth: '320px'
      }}>
        <Search size={16} style={{
          position: 'absolute', left: '12px', top: '50%',
          transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)'
        }} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search files..."
          style={{
            width: '100%', padding: '8px 12px 8px 36px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', color: '#fff',
            fontSize: '14px', outline: 'none'
          }}
        />
        {query && (
          <button onClick={() => handleSearch('')} style={{
            position: 'absolute', right: '8px', top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer'
          }}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="file-filters" style={{ display: 'flex', gap: '6px' }}>
        {FILE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            style={{
              padding: '6px 14px', borderRadius: '6px',
              border: activeFilter === f.value
                ? '1px solid rgba(99,102,241,0.5)'
                : '1px solid rgba(255,255,255,0.08)',
              background: activeFilter === f.value
                ? 'rgba(99,102,241,0.15)'
                : 'transparent',
              color: activeFilter === f.value ? '#818cf8' : 'rgba(255,255,255,0.6)',
              fontSize: '13px', cursor: 'pointer', fontWeight: activeFilter === f.value ? 600 : 400
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FileSearch;
