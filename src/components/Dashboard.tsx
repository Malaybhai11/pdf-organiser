import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import FileSection from './FileSection';
import { ProgressBar } from './ProgressBar';
import { Notification } from './Notification';
import { Upload } from 'lucide-react';

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
  const [progress, setProgress] = useState<{ message: string; percentage: number } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedCustomerRef = useRef(selectedCustomer);
  const lastDropTimeRef = useRef<number>(0);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerData();
    } else {
      setFiles([]);
    }
  }, [selectedCustomer]);

  // Tauri native file drop listener
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    let unlistenDrop: (() => void) | null = null;

    appWindow.onDragDropEvent((event) => {
      if (event.payload.type === 'enter') {
        setIsDragOver(true);
      } else if (event.payload.type === 'leave') {
        setIsDragOver(false);
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false);
        const now = Date.now();
        if (now - lastDropTimeRef.current < 500) {
            // Ignore rapid duplicate drop events
            return;
        }
        lastDropTimeRef.current = now;

        const customer = selectedCustomerRef.current;
        if (!customer) return;

        const paths: string[] = (event.payload as any).paths ?? [];
        if (paths.length === 0) return;

        (async () => {
          let successCount = 0;
          for (const filePath of paths) {
            try {
              await invoke('upload_file_from_path', {
                customerId: customer.id.toString(),
                filePath,
              });
              successCount++;
            } catch (err) {
              console.error(`Upload failed for ${filePath}:`, err);
              setNotification({ message: `Upload failed: ${filePath.split('/').pop()}`, type: 'error' });
            }
          }
          if (successCount > 0) {
            loadCustomerData();
            setNotification({ message: `Uploaded ${successCount} file(s)`, type: 'success' });
          }
        })();
      }
    }).then((fn) => { unlistenDrop = fn; });

    return () => {
      if (unlistenDrop) unlistenDrop();
    };
  }, []);

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
    if (!selectedCustomerRef.current) return;
    try {
      const filesResp = await invoke<any>('get_customer_files', { customerId: selectedCustomerRef.current.id.toString() });
      if (filesResp.success) setFiles(filesResp.data);
    } catch (err) {
      setNotification({ message: "Failed to load customer data", type: 'error' });
    }
  };

  const processUploadedFiles = async (uploadedFiles: File[]) => {
    if (!selectedCustomer) return;
    
    let successCount = 0;
    
    for (const file of uploadedFiles) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            await invoke('save_customer_file', {
                customerId: selectedCustomer.id.toString(),
                fileName: file.name,
                fileData: Array.from(uint8Array)
            });
            successCount++;
        } catch (err) {
            console.error(`Upload failed for ${file.name}:`, err);
            setNotification({ message: `Upload failed: ${file.name}`, type: 'error' });
        }
    }
    
    if (successCount > 0) {
        loadCustomerData();
        setNotification({ message: `Successfully uploaded ${successCount} file(s)`, type: 'success' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processUploadedFiles(Array.from(e.target.files));
    }
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

  if (!selectedCustomer) return null;

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

      <div className="dashboard-header">
          <h2>{selectedCustomer.name}</h2>
          <span className="folder-id">ID: {selectedCustomer.id}</span>
      </div>

      <div className="dashboard-actions">
        <button className="btn btn-primary" onClick={handleMerge} disabled={!!progress || files.length === 0}>
          Finalize & Merge Folder
        </button>
      </div>

      <div className="files-container" style={{ marginTop: '3rem' }}>
        <div 
            className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
        >
          <Upload size={32} />
          <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>Drop files here or click to upload</label>
          <input 
            type="file" 
            id="file-upload" 
            hidden 
            multiple
            onChange={handleFileUpload}
          />
        </div>

        <FileSection 
          files={files} 
          customerId={selectedCustomer.id.toString()}
          onPreview={onPreview}
          onNotify={(msg, type) => setNotification({ message: msg, type })}
          onFileDeleted={loadCustomerData}
        />
      </div>
    </div>
  );
};

export default Dashboard;
