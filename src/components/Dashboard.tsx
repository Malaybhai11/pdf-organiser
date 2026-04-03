import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import FileSection from './FileSection';
import { ProgressBar } from './ProgressBar';
import { Notification } from './Notification';
import { Layout, FileText, Scissors, Upload, Filter } from 'lucide-react';

interface Customer {
  id: string | number;
  name: string;
}

interface DashboardProps {
  selectedCustomer: Customer | null;
  onPreview: (fileName: string) => void;
}

interface ProgressPayload {
  status: string;
  message: string;
}

const Dashboard: React.FC<DashboardProps> = ({ selectedCustomer, onPreview }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, { tags: string[] }>>({});
  const [progress, setProgress] = useState<{ message: string; percentage: number } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerData();
    } else {
      setFiles([]);
      setMetadata({});
    }
  }, [selectedCustomer]);

  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<ProgressPayload>('pdf-progress', (event) => {
        setProgress(prev => {
          const current = prev ? prev.percentage : 0;
          return { message: event.payload.message, percentage: Math.min(current + 10, 95) };
        });
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then(f => f());
    };
  }, []);

  const loadCustomerData = async () => {
    if (!selectedCustomer) return;
    try {
      const filesResp = await invoke<any>('get_customer_files', { customerId: selectedCustomer.id.toString() });
      const metaResp = await invoke<any>('get_customer_metadata', { customerId: selectedCustomer.id.toString() });
      
      if (filesResp.success) setFiles(filesResp.data);
      if (metaResp.success) setMetadata(metaResp.data.files || {});
    } catch (err) {
      setNotification({ message: "Failed to load customer data", type: 'error' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCustomer || !e.target.files) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      try {
        await invoke('save_customer_file', {
          customerId: selectedCustomer.id.toString(),
          fileName: file.name,
          fileData: Array.from(uint8Array)
        });
        loadCustomerData();
        setNotification({ message: `Uploaded ${file.name}`, type: 'success' });
      } catch (err) {
        setNotification({ message: "Upload failed", type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMerge = async () => {
    if (!selectedCustomer || files.length === 0) return;
    setProgress({ message: "Initializing PDF engine...", percentage: 5 });
    try {
      const resp = await invoke<any>('merge_documents', {
        customerId: selectedCustomer.id.toString(),
        fileNames: files
      });
      if (resp.success) {
        setProgress({ message: "Done!", percentage: 100 });
        setTimeout(() => setProgress(null), 1000);
        setNotification({ message: "All documents merged into final.pdf", type: 'success' });
        loadCustomerData();
      } else {
        setNotification({ message: resp.error || "Merge failed", type: 'error' });
        setProgress(null);
      }
    } catch (err) {
      setNotification({ message: "Merge process error", type: 'error' });
      setProgress(null);
    }
  };

  const handleQuickExtract = async (template: string, pages: number[], tag: string) => {
    if (!selectedCustomer) return;
    const sourceFile = files.find(f => f === "final.pdf") || files.find(f => f.endsWith(".pdf"));
    if (!sourceFile) {
      setNotification({ message: "No PDF found to extract from", type: 'error' });
      return;
    }

    setProgress({ message: `Extracting ${template}...`, percentage: 20 });
    try {
      const resp = await invoke<any>('extract_pages', {
        customerId: selectedCustomer.id.toString(),
        fileName: sourceFile,
        pageIndices: pages
      });
      if (resp.success) {
        await handleTagUpdate(resp.data, [tag]);
        setNotification({ message: `${template} created and tagged as ${tag}`, type: 'success' });
        loadCustomerData();
      } else {
        setNotification({ message: resp.error || "Extraction failed", type: 'error' });
      }
    } catch (err) {
      setNotification({ message: "Extraction process error", type: 'error' });
    } finally {
      setProgress(null);
    }
  };

  const handleTagUpdate = async (fileName: string, tags: string[]) => {
    if (!selectedCustomer) return;
    try {
      await invoke('update_file_tags', {
        customerId: selectedCustomer.id.toString(),
        fileName,
        tags
      });
      loadCustomerData();
    } catch (err) {
      setNotification({ message: "Failed to update tags", type: 'error' });
    }
  };

  const filteredFiles = filter === 'All' 
    ? files 
    : files.filter(f => metadata[f]?.tags?.includes(filter));

  if (!selectedCustomer) {
    return (
      <div className="empty-state">
        <div className="placeholder-icon"><Layout size={64} /></div>
        <h3>Select a customer to start managing documents</h3>
        <p>Manage invoices, service reports, and visit forms in one place.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      {progress && (
        <ProgressBar percentage={progress.percentage} message={progress.message} />
      )}

      <div className="dashboard-actions">
        <button className="action-card" onClick={handleMerge} disabled={!!progress}>
          <div className="action-icon-wrap"><FileText size={24} /></div>
          <div className="action-info">
            <span>Finalize Folder</span>
            <small>Merge all files into final.pdf</small>
          </div>
        </button>
        <div className="quick-extract-group">
          <button className="action-card" onClick={() => handleQuickExtract("Visit Form", [0, 1], "Visit Form")} disabled={!!progress}>
            <div className="action-icon-wrap"><Scissors size={24} /></div>
            <div className="action-info">
              <span>Visit Form</span>
              <small>Extract Pages 1-2</small>
            </div>
          </button>
          <button className="action-card" onClick={() => handleQuickExtract("Invoice", [0], "Invoice")} disabled={!!progress}>
            <div className="action-icon-wrap"><Scissors size={24} /></div>
            <div className="action-info">
              <span>Invoice</span>
              <small>Extract Page 1</small>
            </div>
          </button>
        </div>
      </div>

      <div className="section-title">
        <Filter size={18} />
        <h3>Filter by Tag</h3>
      </div>
      <div className="filter-bar">
        {['All', 'Invoice', 'Service', 'Visit Form'].map(f => (
          <button 
            key={f} 
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="files-container">
        <label className="dropzone">
          <Upload size={32} />
          <p>Click or drag files here to upload</p>
          <input 
            type="file" 
            id="file-upload" 
            hidden 
            onChange={handleFileUpload}
          />
        </label>

        <FileSection 
          files={filteredFiles} 
          metadata={metadata} 
          onTagUpdate={handleTagUpdate}
          onPreview={onPreview}
        />
      </div>
    </div>
  );
};

export default Dashboard;
