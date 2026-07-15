export const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  doc: '#3b82f6',
  docx: '#2563eb',
  xls: '#22c55e',
  xlsx: '#16a34a',
  ppt: '#f97316',
  pptx: '#ea580c',
  jpg: '#a855f7',
  jpeg: '#a855f7',
  png: '#a855f7',
  gif: '#ec4899',
  svg: '#eab308',
  txt: '#64748b',
  csv: '#14b8a6',
  zip: '#78716c',
  rar: '#78716c',
  default: '#64748b',
};

export function getFileTypeLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'unknown';
  return ext.toUpperCase();
}

export function getFileTypeColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'default';
  return FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.default;
}
