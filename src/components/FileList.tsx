import React, { useRef, useState, useEffect, useCallback } from 'react';

interface FileListProps {
  files: Array<{ id: string; name: string; size: number; date: string }>;
  itemHeight?: number;
  overscan?: number;
  renderItem: (file: { id: string; name: string; size: number; date: string; style: React.CSSProperties }) => React.ReactNode;
}

export function FileList({ files, itemHeight = 48, overscan = 5, renderItem }: FileListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setContainerHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = files.length * itemHeight;
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIdx = Math.min(files.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);
  const visibleItems = files.slice(startIdx, endIdx);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="overflow-auto h-full" style={{ maxHeight: containerHeight }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((file, i) =>
          renderItem({
            ...file,
            style: {
              position: 'absolute',
              top: (startIdx + i) * itemHeight,
              height: itemHeight,
              left: 0,
              right: 0,
            },
          })
        )}
      </div>
    </div>
  );
}
