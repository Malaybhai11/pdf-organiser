import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import FileSection from './FileSection';
import { ProgressBar } from './ProgressBar';
import { Notification } from './Notification';
import { Download, Files, Sparkles, Upload } from 'lucide-react';

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

interface CommandResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

const NATIVE_DROP_DEDUPE_WINDOW_MS = 2000;

const normalizeNativeDropPaths = (paths: string[]) =>
  Array.from(
    new Set(
      paths
        .map((path) => path.trim())
        .filter(Boolean)
    )
  );

const createNativeDropBatchKey = (customerId: string | number, paths: string[]) =>
  `${customerId}::${[...normalizeNativeDropPaths(paths)].sort().join('::')}`;

const Dashboard: React.FC<DashboardProps> = ({ selectedCustomer, onPreview }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ message: string; percentage: number } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [lastMergedPath, setLastMergedPath] = useState<string | null>(null);
  const selectedCustomerRef = useRef(selectedCustomer);
  const activeNativeDropBatchesRef = useRef<Set<string>>(new Set());
  const recentNativeDropBatchesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer) {
      setLastMergedPath(null);
      void loadCustomerData();
    } else {
      setFiles([]);
      setLastMergedPath(null);
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
        const customer = selectedCustomerRef.current;
        if (!customer) return;

        const paths = normalizeNativeDropPaths((event.payload as any).paths ?? []);
        if (paths.length === 0) return;

        const batchKey = createNativeDropBatchKey(customer.id, paths);
        const now = Date.now();
        const recentBatches = recentNativeDropBatchesRef.current;

        for (const [key, seenAt] of recentBatches.entries()) {
          if (now - seenAt > NATIVE_DROP_DEDUPE_WINDOW_MS) {
            recentBatches.delete(key);
          }
        }

        if (activeNativeDropBatchesRef.current.has(batchKey)) {
          return;
        }

        const lastSeenAt = recentBatches.get(batchKey);
        if (lastSeenAt && now - lastSeenAt <= NATIVE_DROP_DEDUPE_WINDOW_MS) {
          return;
        }

        activeNativeDropBatchesRef.current.add(batchKey);
        recentBatches.set(batchKey, now);

        (async () => {
          let completedSuccessfully = false;

          try {
            const response = await invoke<CommandResponse<string[]>>('upload_files_from_paths', {
              customerId: customer.id.toString(),
              filePaths: paths,
            });

            if (!response.success) {
              throw new Error(response.error ?? 'Upload failed');
            }

            const uploadedCount = response.data?.length ?? 0;
            if (uploadedCount > 0) {
              await loadCustomerData();
              setNotification({ message: `Uploaded ${uploadedCount} file(s)`, type: 'success' });
            }
            completedSuccessfully = true;
          } catch (err) {
            console.error('Native file drop upload failed:', err);
            recentNativeDropBatchesRef.current.delete(batchKey);
            setNotification({ message: 'Upload failed for dropped file(s)', type: 'error' });
          } finally {
            activeNativeDropBatchesRef.current.delete(batchKey);
            if (completedSuccessfully) {
              recentNativeDropBatchesRef.current.set(batchKey, Date.now());
            }
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
      const filesResp = await invoke<CommandResponse<string[]>>('get_customer_files', { customerId: selectedCustomerRef.current.id.toString() });
      if (filesResp.success && filesResp.data) {
        setFiles(filesResp.data);
      }
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
            
            const response = await invoke<CommandResponse<string>>('save_customer_file', {
                customerId: selectedCustomer.id.toString(),
                fileName: file.name,
                fileData: Array.from(uint8Array)
            });

            if (response.success) {
              successCount++;
            } else {
              setNotification({ message: response.error ?? `Upload failed: ${file.name}`, type: 'error' });
            }
        } catch (err) {
            console.error(`Upload failed for ${file.name}:`, err);
            setNotification({ message: `Upload failed: ${file.name}`, type: 'error' });
        }
    }
    
    if (successCount > 0) {
        await loadCustomerData();
        setNotification({ message: `Successfully uploaded ${successCount} file(s)`, type: 'success' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void processUploadedFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };


  const handleMerge = async () => {
    if (!selectedCustomer || files.length === 0 || isMerging) return;

    setIsMerging(true);
    setLastMergedPath(null);
    setProgress({ message: "Preparing merged export...", percentage: 5 });
    try {
      const resp = await invoke<CommandResponse<string>>('merge_documents', {
        customerId: selectedCustomer.id.toString(),
        fileNames: files
      });

      if (resp.success && resp.data) {
        setLastMergedPath(resp.data);
        setProgress({ message: "Saved to Downloads", percentage: 100 });
        setTimeout(() => setProgress(null), 1200);
        setNotification({ message: `Merged PDF saved to ${resp.data}`, type: 'success' });
        await loadCustomerData();
      } else {
        setNotification({ message: resp.error || "Merge failed", type: 'error' });
        setProgress(null);
      }
    } catch (err) {
      setNotification({ message: "Merge process error", type: 'error' });
      setProgress(null);
    } finally {
      setIsMerging(false);
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

      <div className="dashboard-hero">
        <div className="dashboard-header">
          <div>
            <span className="section-kicker">Customer workspace</span>
            <h2>{selectedCustomer.name}</h2>
            <p>Upload the source documents, review them, and export a fresh merged PDF directly into the Downloads folder.</p>
          </div>

          <div className="dashboard-badges">
            <div className="info-pill">Customer ID {selectedCustomer.id}</div>
            <div className="info-pill">{files.length} source file(s)</div>
          </div>
        </div>

        <div className="dashboard-overview">
          <div className={`dropzone ${isDragOver ? 'drag-over' : ''}`}>
            <div className="dropzone-icon">
              <Upload size={30} />
            </div>
            <div className="dropzone-copy">
              <h3>Drop files here or choose files manually</h3>
              <p>Supports PDFs plus JPG and PNG images. Native drag and drop is deduped to prevent accidental repeat uploads.</p>
            </div>
            <label className="btn btn-secondary dropzone-trigger" htmlFor="file-upload">
              <Upload size={16} />
              Choose Files
            </label>
            <input
              type="file"
              id="file-upload"
              hidden
              multiple
              onChange={handleFileUpload}
            />
          </div>

          <aside className="summary-card">
            <div className="summary-card-header">
              <span className="section-kicker">Export</span>
              <h3>Finalize and save</h3>
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span><Files size={15} /> Uploaded files</span>
                <strong>{files.length}</strong>
              </div>
              <div className="summary-row">
                <span><Download size={15} /> Save location</span>
                <strong>Downloads</strong>
              </div>
              <div className="summary-row">
                <span><Sparkles size={15} /> Export name</span>
                <strong>final.pdf</strong>
              </div>
            </div>

            <button className="btn btn-primary btn-wide" onClick={handleMerge} disabled={isMerging || files.length === 0}>
              <Download size={16} />
              {isMerging ? 'Merging and Saving...' : 'Finalize & Save to Downloads'}
            </button>

            <p className="summary-footnote">
              The app still builds the merged file inside its workspace, then immediately copies the finished export into the user's Downloads folder.
            </p>
          </aside>
        </div>

        {lastMergedPath && (
          <div className="export-banner">
            <div className="export-banner-label">Latest export</div>
            <code>{lastMergedPath}</code>
          </div>
        )}
      </div>

      <section className="files-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Source files</span>
            <h3>Ready to merge</h3>
            <p>Click any file to preview it. Use the action menu for download, rename-safe export, or delete.</p>
          </div>
        </div>

        <FileSection 
          files={files}
          customerId={selectedCustomer.id.toString()}
          onPreview={onPreview}
          onNotify={(msg, type) => setNotification({ message: msg, type })}
          onFileDeleted={() => {
            void loadCustomerData();
          }}
        />
      </section>
    </div>
  );
};

export default Dashboard;
