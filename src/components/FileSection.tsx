import React from 'react';

interface FileSectionProps {
  files: string[];
  metadata: Record<string, { tags: string[] }>;
  onTagUpdate: (fileName: string, tags: string[]) => void;
  onPreview: (fileName: string) => void;
}

const FileSection: React.FC<FileSectionProps> = ({ files, metadata, onTagUpdate, onPreview }) => {
  const availableTags = ['Invoice', 'Service', 'Visit Form'];

  const toggleTag = (fileName: string, tag: string) => {
    const currentTags = metadata[fileName]?.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    onTagUpdate(fileName, newTags);
  };

  // Only show files that are not "final.pdf" in the original files section
  const originalFiles = files.filter(f => f !== "final.pdf");
  const finalizedFile = files.find(f => f === "final.pdf");

  return (
    <div className="files-section">
      {finalizedFile && (
        <div className="finalized-file-card">
          <div className="card-badge">Finalized Version</div>
          <div className="file-row highlight">
            <span className="file-icon">✅</span>
            <span className="file-name">{finalizedFile}</span>
            <button className="primary-btn sm" onClick={() => onPreview(finalizedFile)}>Open Preview</button>
          </div>
        </div>
      )}

      <div className="files-header">
        <h3>Original Files</h3>
      </div>
      <div className="file-list">
        {originalFiles.length === 0 ? (
          <p className="empty-msg">No files uploaded yet.</p>
        ) : (
          originalFiles.map(file => (
            <div key={file} className="file-row">
              <span className="file-icon">📄</span>
              <span className="file-name" title={file}>{file}</span>
              <div className="tag-picker-inline">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag-dot ${metadata[file]?.tags?.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(file, tag)}
                    title={tag}
                  >
                    {tag[0]}
                  </button>
                ))}
              </div>
              <button className="secondary-btn sm" onClick={() => onPreview(file)}>Preview</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileSection;
