import React, { useState, useEffect } from 'react'

interface RecentFile {
  name: string
  path: string
  openedAt: string
}

export function RecentFiles() {
  const [files, setFiles] = useState<RecentFile[]>([])
  
  useEffect(() => {
    const stored = localStorage.getItem('recentFiles')
    if (stored) setFiles(JSON.parse(stored).slice(0, 10))
  }, [])
  
  if (files.length === 0) return null
  
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-2">Recent Files</h3>
      <ul className="space-y-1">
        {files.map((f, i) => (
          <li key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="flex-1 truncate">{f.name}</span>
            <span className="text-xs text-gray-400">{new Date(f.openedAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
