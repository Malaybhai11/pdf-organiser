import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, Scissors, X } from "lucide-react";
import { PageThumbnail } from "./PageThumbnail";

interface Props {
  customerId: string;
  fileName: string;
  onClose: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function PdfPreview({ customerId, fileName, onClose, onNotify }: Props) {
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

      if (response.success && response.data) {
        const downloadResponse: ApiResponse<string> = await invoke("download_file", {
          customerId,
          fileName: response.data,
        });

        if (downloadResponse.success && downloadResponse.data) {
          onNotify(`Extracted pages saved to ${downloadResponse.data}`, "success");
        } else {
          onNotify(`Extracted ${response.data}, but saving to Downloads failed.`, "info");
        }
        onClose();
      } else {
        onNotify(`Extraction failed: ${response.error ?? "Unknown error"}`, "error");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      onNotify("Failed to extract selected pages", "error");
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <div className="preview-overlay">
        <div className="preview-loading">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className="preview-overlay">
      <div className="preview-container">
        <header className="preview-header">
          <div>
            <span className="section-kicker">Page preview</span>
            <h3>{fileName}</h3>
            <p>{pageCount} page(s) available. Select the pages you want to extract as a new PDF.</p>
          </div>

          <div className="preview-actions">
            <span className="selection-counter">{selectedPages.size} pages selected</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={extracting || selectedPages.size === 0}
            >
              <Scissors size={16} />
              {extracting ? "Extracting..." : "Extract to Downloads"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={16} />
              Close
            </button>
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

        <footer className="preview-footer">
          <div className="preview-footer-copy">
            <Download size={16} />
            Extracted pages are automatically copied to the Downloads folder.
          </div>
        </footer>
      </div>
    </div>
  );
}
