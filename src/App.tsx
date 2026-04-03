import { useState, useEffect, DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ProgressPayload {
  status: string;
  message: string;
}

function App() {
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [mergeStatus, setMergeStatus] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  // Fetch all customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Listen for PDF progress events from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    const setupListener = async () => {
      unlisten = await listen<ProgressPayload>("pdf-progress", (event) => {
        setMergeStatus(event.payload.message);
      });
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Fetch files when a customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchFiles(selectedCustomerId);
      setMergeStatus("");
    } else {
      setFiles([]);
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    try {
      const response: ApiResponse<string[]> = await invoke("get_customers");
      if (response.success && response.data) {
        setCustomers(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    }
  };

  const fetchFiles = async (id: string) => {
    try {
      const response: ApiResponse<string[]> = await invoke("get_customer_files", { customerId: id });
      if (response.success && response.data) {
        setFiles(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const response: ApiResponse<void> = await invoke("create_customer_folder", { 
        customerId: newCustomerName.trim() 
      });
      if (response.success) {
        setNewCustomerName("");
        await fetchCustomers();
        setSelectedCustomerId(newCustomerName.trim());
      } else {
        alert("Error: " + response.error);
      }
    } catch (err) {
      console.error("Failed to create customer:", err);
    }
  };

  const handleUpload = async (fileList: FileList) => {
    if (!selectedCustomerId) return;
    setIsUploading(true);
    setUploadProgress(`Uploading ${fileList.length} file(s)...`);

    try {
      for (const file of Array.from(fileList)) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        await invoke("save_customer_file", {
          customerId: selectedCustomerId,
          fileName: file.name,
          fileData: Array.from(uint8Array),
        });
      }
      await fetchFiles(selectedCustomerId);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleMerge = async () => {
    if (!selectedCustomerId || files.length === 0) return;
    setIsMerging(true);
    setMergeStatus("Initializing PDFium...");

    try {
      const response: ApiResponse<string> = await invoke("merge_documents", {
        customerId: selectedCustomerId,
        fileNames: files,
      });

      if (response.success) {
        setMergeStatus("Successfully merged into final.pdf!");
        // Refresh or notify user
      } else {
        setMergeStatus("Error: " + response.error);
      }
    } catch (err) {
      console.error("Merge failed:", err);
      setMergeStatus("Failed to merge documents.");
    } finally {
      setIsMerging(false);
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Customers</h2>
        <div className="customer-list">
          {customers.map((id) => (
            <div
              key={id}
              className={`customer-item ${selectedCustomerId === id ? "active" : ""}`}
              onClick={() => setSelectedCustomerId(id)}
            >
              {id}
            </div>
          ))}
          {customers.length === 0 && <div className="empty-state">No customers yet</div>}
        </div>

        <div className="new-customer">
          <input
            type="text"
            placeholder="New customer name..."
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
          />
          <button onClick={handleAddCustomer} style={{ width: "100%" }}>
            Add Customer
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-panel">
        {!selectedCustomerId ? (
          <div className="empty-state" style={{ marginTop: "20%" }}>
            <h1>Document Manager</h1>
            <p>Select or add a customer to get started.</p>
          </div>
        ) : (
          <>
            <header className="header">
              <h1>{selectedCustomerId}</h1>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {mergeStatus && <span style={{ fontSize: "0.9rem", color: "#888" }}>{mergeStatus}</span>}
                <button 
                  onClick={handleMerge} 
                  disabled={isMerging || files.length === 0}
                >
                  {isMerging ? "Merging..." : "Merge All PDFs"}
                </button>
              </div>
            </header>

            <div
              className={`dropzone ${isDragging ? "dragging" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <p>Drag and drop files here, or click to browse</p>
              <input
                id="file-input"
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
              {isUploading && <div className="uploading-overlay">{uploadProgress}</div>}
            </div>

            <div className="file-list">
              {files.map((file) => (
                <div key={file} className="file-item">
                  📄 {file}
                </div>
              ))}
              {files.length === 0 && !isUploading && (
                <div className="empty-state">No files uploaded yet</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
