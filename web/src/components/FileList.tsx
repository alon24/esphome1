import '../styles/FileList.css'

interface File {
  name: string
  size: number
  path: string
  ext: string
}

interface FileListProps {
  files: File[]
  loading: boolean
  onDelete: (path: string) => void
}

function FileList({ files, loading, onDelete }: FileListProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i]
  }

  const getExtIcon = (ext: string) => {
    const lower = ext.toLowerCase()
    if (['png', 'jpg', 'jpeg'].includes(lower)) return '🖼️'
    if (lower === 'gif') return '🎬'
    return '📄'
  }

  if (loading && files.length === 0) {
    return <div className="file-list-empty">Loading files...</div>
  }

  if (files.length === 0) {
    return <div className="file-list-empty">No files on SD card</div>
  }

  return (
    <div className="file-list">
      {files.map(file => (
        <div key={file.path} className="file-item">
          <div className="file-info">
            <span className="file-icon">{getExtIcon(file.ext)}</span>
            <div className="file-details">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{formatSize(file.size)}</div>
            </div>
          </div>
          <button
            className="btn-delete"
            onClick={() => onDelete(file.path)}
            title="Delete file"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

export default FileList
