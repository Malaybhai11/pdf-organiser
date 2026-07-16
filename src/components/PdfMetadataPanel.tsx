import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Calendar, User, BookOpen, HardDrive, X, RefreshCw } from 'lucide-react';

interface PdfMetadata {
  title: string | null;
  author: string | null;
  creator: string | null;
  producer: string | null;
  page_count: number;
  created: string | null;
  modified: string | null;
  file_size: number;
  file_name: string;
}

interface PdfMetadataPanelProps {
  customerId: string;
  fileName: string;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

const PdfMetadataPanel: React.FC<PdfMetadataPanelProps> = ({ customerId, fileName, onClose }) => {
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: any = await invoke('get_pdf_metadata', { customerId, fileName });
      setMetadata(result.data);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  }, [customerId, fileName]);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  if (loading) {
    return (
      <div className="metadata-panel" style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)' }}>
          <RefreshCw size={16} className="spin" />
          Loading metadata...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="metadata-panel" style={{ padding: '20px', background: 'rgba(220,38,38,0.1)', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)' }}>
        <p style={{ color: '#ef4444', fontSize: '14px' }}>Failed to load metadata: {error}</p>
        <button onClick={fetchMetadata} style={{ marginTop: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>Retry</button>
      </div>
    );
  }

  if (!metadata) return null;

  const rows = [
    { icon: <FileText size={16} />, label: 'Title', value: metadata.title || 'Untitled' },
    { icon: <User size={16} />, label: 'Author', value: metadata.author || 'Unknown' },
    { icon: <User size={16} />, label: 'Creator', value: metadata.creator || 'Unknown' },
    { icon: <HardDrive size={16} />, label: 'Producer', value: metadata.producer || 'Unknown' },
    { icon: <BookOpen size={16} />, label: 'Pages', value: String(metadata.page_count) },
    { icon: <HardDrive size={16} />, label: 'File Size', value: formatFileSize(metadata.file_size) },
    { icon: <Calendar size={16} />, label: 'Created', value: formatDate(metadata.created) },
    { icon: <Calendar size={16} />, label: 'Modified', value: formatDate(metadata.modified) },
  ];

  return (
    <div className="metadata-panel" style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>PDF Metadata</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: 'rgba(99,102,241,0.6)', width: '20px', display: 'flex', justifyContent: 'center' }}>{row.icon}</div>
            <div style={{ minWidth: '80px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{row.label}</div>
            <div style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PdfMetadataPanel;
