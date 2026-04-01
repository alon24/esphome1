import { useState, useEffect } from 'react'
import FileList from '../components/FileList'
import UploadArea from '../components/UploadArea'
import '../styles/FileManager.css'

interface File {
  name: string
  size: number
  path: string
  ext: string
}

function FileManager() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/files')
      if (!res.ok) throw new Error('Failed to fetch files')
      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleDelete = async (path: string) => {
    if (!confirm(`Delete ${path}?`)) return
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Delete failed')
      setFiles(files.filter(f => f.path !== path))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleUpload = async (file: globalThis.File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error('Upload failed')
      await fetchFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div className="file-manager">
      <div className="fm-container">
        <div className="fm-left">
          <UploadArea onUpload={handleUpload} />
        </div>
        <div className="fm-right">
          <div className="fm-toolbar">
            <h2>SD Card Files</h2>
            <button onClick={fetchFiles} disabled={loading} className="btn-refresh">
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
          <FileList
            files={files}
            loading={loading}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  )
}

export default FileManager
