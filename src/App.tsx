import { useState, useEffect, DragEvent, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PdfPreview } from "./PdfPreview";
import "./App.css";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  user_feedback?: string;
}

interface ProgressPayload {
  status: string;
  message: string;
}

type Tag = "Invoice" | "Service" | "Visit Form";

interface FileMetadata {
  tags: Tag[];
}

type CustomerMetadata = Record<string, FileMetadata>;

const AVAILABLE_TAGS: Tag[] = ["Invoice", "Service", "Visit Form"];

function App() {
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<CustomerMetadata>({});
  const [activeFilter, setActiveFilter] = useState<Tag | "All">("All");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [mergeStatus, setMergeStatus] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const unlistenFn = await listen<ProgressPayload>("pdf-progress", (event) => {
          setMergeStatus(event.payload.message);
        });
        unlisten = unlistenFn;
      } catch (err) {
        console.error("Failed to setup event listener:", err);
      }
    };
    setupListener();
    return () => { if (unlisten) unlisten(); };
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchFiles(selectedCustomerId);
      fetchMetadata(selectedCustomerId);
      setMergeStatus("");
      setActiveFilter("All");
    } else {
      setFiles([]);
      setMetadata({});
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    try {
      const response: ApiResponse<string[]> = await invoke("get_customers");
      if (response.success && response.data) setCustomers(response.data);
    } catch (err) { console.error(err); }
  };

  const fetchFiles = async (id: string) => {
    try {
      const response: ApiResponse<string[]> = await invoke("get_customer_files", { customerId: id });
      if (response.success && response.data) setFiles(response.data);
    } catch (err) { console.error(err); }
  };

  const fetchMetadata = async (id: string) => {
    try {
      const response: ApiResponse<CustomerMetadata> = await invoke("get_customer_metadata", { customerId: id });
      if (response.success && response.data) setMetadata(response.data);
    } catch (err) { console.error(err); }
  };

  const handleUpdateTags = async (fileName: string, tag: Tag) => {
    if (!selectedCustomerId) return;
    const currentTags = metadata[fileName]?.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    try {
      const response: ApiResponse<void> = await invoke("update_file_tags", {
        customerId: selectedCustomerId,
        fileName,
        tags: newTags,
      });
      if (response.success) {
        setMetadata(prev => ({
          ...prev,
          [fileName]: { tags: newTags }
        }));
      }
    } catch (err) { console.error(err); }
  };

  const handleFinalize = async () => {
    if (!selectedCustomerId || files.length === 0) {
      setMergeStatus("Error: No files to finalize.");
      return;
    }
    setIsMerging(true);
    setMergeStatus("Finalizing customer folder...");
    try {
      const response: ApiResponse<string> = await invoke("merge_documents", {
        customerId: selectedCustomerId,
        fileNames: files,
      });
      if (response.success) {
        setMergeStatus(`Finalized successfully as ${response.data}`);
        await fetchFiles(selectedCustomerId);
        await fetchMetadata(selectedCustomerId);
      } else {
        setMergeStatus(`Error: ${response.error}`);
      }
    } catch (err) {
      setMergeStatus(`Failed to finalize: ${err}`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleQuickExtract = async (templateName: string, pages: number[], tag: Tag) => {
    if (!selectedCustomerId) return;
    
    // We usually extract from the final.pdf if it exists, otherwise the first PDF
    const sourceFile = files.find(f => f === "final.pdf") || files.find(f => f.endsWith(".pdf"));
    
    if (!sourceFile) {
      setMergeStatus("Error: No PDF found to extract from.");
      return;
    }

    setMergeStatus(`Extracting ${templateName}...`);
    try {
      const response: ApiResponse<string> = await invoke("extract_pages", {
        customerId: selectedCustomerId,
        fileName: sourceFile,
        pageIndices: pages,
      });

      if (response.success && response.data) {
        const newFileName = response.data;
        // Auto-tag the extracted file
        await invoke("update_file_tags", {
          customerId: selectedCustomerId,
          fileName: newFileName,
          tags: [tag],
        });
        
        setMergeStatus(`${templateName} created and tagged!`);
        await fetchFiles(selectedCustomerId);
        await fetchMetadata(selectedCustomerId);
      } else {
        setMergeStatus(`Error: ${response.error}`);
      }
    } catch (err) {
      setMergeStatus(`Failed to extract: ${err}`);
    }
  };

  const filteredFiles = useMemo(() => {
    if (activeFilter === "All") return files;
    return files.filter(file => metadata[file]?.tags.includes(activeFilter as Tag));
  }, [files, metadata, activeFilter]);

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const response: ApiResponse<void> = await invoke("create_customer_folder", { customerId: newCustomerName.trim() });
      if (response.success) {
        setNewCustomerName("");
        await fetchCustomers();
        setSelectedCustomerId(newCustomerName.trim());
      }
    } catch (err) { console.error(err); }
  };

  const handleUpload = async (fileList: FileList) => {
    if (!selectedCustomerId) return;
    setIsUploading(true);
    setUploadProgress(`Uploading ${fileList.length} file(s)...`);
    try {
      for (const file of Array.from(fileList)) {
        const arrayBuffer = await file.arrayBuffer();
        await invoke("save_customer_file", {
          customerId: selectedCustomerId,
          fileName: file.name,
          fileData: Array.from(new Uint8Array(arrayBuffer)),
        });
      }
      await fetchFiles(selectedCustomerId);
    } catch (err) { console.error(err); }
    finally { setIsUploading(false); setUploadProgress(""); }
  };

  const handleMerge = async () => {
    if (!selectedCustomerId || files.length === 0) return;
    setIsMerging(true);
    setMergeStatus("Merging...");
    try {
      const response: ApiResponse<string> = await invoke("merge_documents", {
        customerId: selectedCustomerId,
        fileNames: files,
      });
      if (response.success) {
        setMergeStatus("Success!");
        await fetchFiles(selectedCustomerId);
      }
    } catch (err) { console.error(err); }
    finally { setIsMerging(false); }
  };

  return (
    <div className="container">
      <aside className="sidebar">
        <h2>Customers</h2>
        <div className="customer-list">
          {customers.map((id) => (
            <div key={id} className={`customer-item ${selectedCustomerId === id ? "active" : ""}`} onClick={() => setSelectedCustomerId(id)}>{id}</div>
          ))}
        </div>
        <div className="new-customer">
          <input type="text" placeholder="New customer..." value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
          <button onClick={handleAddCustomer} style={{width: '100%', marginTop: '5px'}}>Add</button>
        </div>
      </aside>

      <main className="main-panel">
        {!selectedCustomerId ? (
          <div className="empty-state">Select a customer</div>
        ) : (
          <>
            <header className="header">
              <h1>{selectedCustomerId}</h1>
              <div className="header-actions">
                <button onClick={handleFinalize} disabled={isMerging || files.length === 0} className="primary-btn">
                  Finalize & Merge
                </button>
              </div>
            </header>

            <div className="workflow-bar">
               <span className="workflow-label">Quick Templates:</span>
               <button className="secondary-btn" onClick={() => handleQuickExtract("Visit Form", [0, 1], "Visit Form")}>
                 Visit Form (P1-2)
               </button>
               <button className="secondary-btn" onClick={() => handleQuickExtract("Invoice", [0], "Invoice")}>
                 Invoice (P1)
               </button>
            </div>

            {mergeStatus && (
              <div className={`status-banner ${mergeStatus.startsWith("Error") ? "error" : "success"}`}>
                {mergeStatus}
              </div>
            )}

            <div className="filters">
              <button className={`filter-btn ${activeFilter === "All" ? "active" : ""}`} onClick={() => setActiveFilter("All")}>All</button>
              {AVAILABLE_TAGS.map(tag => (
                <button key={tag} className={`filter-btn ${activeFilter === tag ? "active" : ""}`} onClick={() => setActiveFilter(tag)}>{tag}</button>
              ))}
            </div>

            <div className={`dropzone ${isDragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}>
              {isUploading ? uploadProgress : "Drop files here"}
            </div>

            <div className="file-list">
              {filteredFiles.map((file) => (
                <div key={file} className="file-item-card">
                  <div className="file-item-header">
                    <span onClick={() => file.endsWith(".pdf") && setPreviewFile(file)} style={{ cursor: file.endsWith(".pdf") ? "pointer" : "default" }}>
                      📄 {file}
                    </span>
                    <div className="tag-picker">
                      {AVAILABLE_TAGS.map(tag => (
                        <button
                          key={tag}
                          className={`tag-option ${metadata[file]?.tags.includes(tag) ? "selected" : ""}`}
                          onClick={() => handleUpdateTags(file, tag)}
                        >
                          {tag[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="tag-container">
                    {metadata[file]?.tags.map(tag => (
                      <span key={tag} className={`tag tag-${tag.toLowerCase().replace(" ", "")}`}>{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {previewFile && selectedCustomerId && (
        <PdfPreview customerId={selectedCustomerId} fileName={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}

export default App;
