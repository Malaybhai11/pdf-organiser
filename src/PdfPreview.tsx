import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageThumbnail } from "./PageThumbnail";

interface Props {
  customerId: string;
  fileName: string;
  onClose: () => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function PdfPreview({ customerId, fileName, onClose }: Props) {
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    async function fetchPageCount() {
      try {
        const response: ApiResponse<number> = await invoke("get_pdf_page_count", {
          customerId,
          fileName,
        });
        if (response.success && response.data !== undefined) {
          setPageCount(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch page count:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPageCount();
  }, [customerId, fileName]);

  const togglePage = (index: number) => {
    const newSelection = new Set(selectedPages);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedPages(newSelection);
  };

  const handleExtract = async () => {
    if (selectedPages.size === 0) return;
    setExtracting(true);

    try {
      const indices = Array.from(selectedPages).sort((a, b) => a - b);
      const response: ApiResponse<string> = await invoke("extract_pages", {
        customerId,
        fileName,
        pageIndices: indices,
      });

      if (response.success) {
        alert(`Successfully extracted to ${response.data}`);
        onClose();
      } else {
        alert("Extraction failed: " + response.error);
      }
    } catch (err) {
      console.error("Extraction error:", err);
    } finally {
      setExtracting(false);
    }
  };

  if (loading) return <div className="preview-overlay">Loading preview...</div>;

  return (
    <div className="preview-overlay">
      <div className="preview-container">
        <header className="preview-header">
          <h3>Preview: {fileName}</h3>
          <div className="preview-actions">
            <span>{selectedPages.size} pages selected</span>
            <button 
              onClick={handleExtract} 
              disabled={extracting || selectedPages.size === 0}
            >
              {extracting ? "Extracting..." : "Extract Selected Pages"}
            </button>
            <button className="secondary" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className="thumbnail-grid">
          {Array.from({ length: pageCount }).map((_, i) => (
            <PageThumbnail
              key={i}
              customerId={customerId}
              fileName={fileName}
              pageIndex={i}
              isSelected={selectedPages.has(i)}
              onToggle={togglePage}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
