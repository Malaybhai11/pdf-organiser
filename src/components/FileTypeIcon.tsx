import React from 'react'

interface FileTypeIconProps { fileName: string; size?: 'sm' | 'md' | 'lg'; }

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700 border-red-200',
  doc: 'bg-blue-100 text-blue-700 border-blue-200', docx: 'bg-blue-100 text-blue-700 border-blue-200',
  xls: 'bg-green-100 text-green-700 border-green-200', xlsx: 'bg-green-100 text-green-700 border-green-200',
  jpg: 'bg-purple-100 text-purple-700 border-purple-200', jpeg: 'bg-purple-100 text-purple-700 border-purple-200',
  png: 'bg-purple-100 text-purple-700 border-purple-200',
  txt: 'bg-gray-100 text-gray-700 border-gray-200',
  zip: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : 'unknown'
}

export function FileTypeIcon({ fileName, size = 'md' }: FileTypeIconProps) {
  const ext = getExtension(fileName)
  const colors = TYPE_COLORS[ext] || 'bg-gray-100 text-gray-600 border-gray-200'
  const sizes = { sm: 'text-xs px-1.5 py-0.5', md: 'text-sm px-2 py-1', lg: 'text-base px-3 py-1.5' }
  
  return (
    <span className={`inline-block rounded border font-medium uppercase ${colors} ${sizes[size]}`}>
      {ext}
    </span>
  )
}
