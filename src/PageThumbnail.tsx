import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  customerId: string;
  fileName: string;
  pageIndex: number;
  isSelected: boolean;
  onToggle: (pageIndex: number) => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function PageThumbnail({ customerId, fileName, pageIndex, isSelected, onToggle }: Props) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadThumbnail() {
      try {
        const response: ApiResponse<string> = await invoke("render_pdf_page", {
          customerId,
          fileName,
          pageIndex,
        });

        if (isMounted && response.success && response.data) {
          setThumbnail(response.data);
        }
      } catch (err) {
        console.error(`Failed to load thumbnail for page ${pageIndex}:`, err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadThumbnail();
    return () => { isMounted = false; };
  }, [customerId, fileName, pageIndex]);

  return (
    <div 
      className={`thumbnail-item ${isSelected ? "selected" : ""}`}
      onClick={() => onToggle(pageIndex)}
    >
      <div className="thumbnail-wrapper">
        {loading ? (
          <div className="thumbnail-loader">Loading...</div>
        ) : thumbnail ? (
          <img src={thumbnail} alt={`Page ${pageIndex + 1}`} />
        ) : (
          <div className="thumbnail-error">Error</div>
        )}
        <div className="page-number">{pageIndex + 1}</div>
        {isSelected && <div className="selection-badge">✓</div>}
      </div>
    </div>
  );
}
