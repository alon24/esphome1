import { useState, useRef } from 'react'
import '../styles/UploadArea.css'

interface UploadAreaProps {
  onUpload: (file: File) => void
}

function UploadArea({ onUpload }: UploadAreaProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => {
    setDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (isValidFile(file)) {
        setUploading(true)
        await onUpload(file)
        setUploading(false)
      }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || [])
    for (const file of files) {
      if (isValidFile(file)) {
        setUploading(true)
        await onUpload(file)
        setUploading(false)
      }
    }
    e.currentTarget.value = ''
  }

  const isValidFile = (file: File) => {
    const validExts = ['png', 'jpg', 'jpeg', 'gif']
    const ext = file.name.split('.').pop()?.toLowerCase()
    return ext && validExts.includes(ext)
  }

  return (
    <div className="upload-area">
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <>
            <div className="upload-spinner"></div>
            <p>Uploading...</p>
          </>
        ) : (
          <>
            <div className="upload-icon">📤</div>
            <p className="upload-text">Drop images here or click to browse</p>
            <p className="upload-hint">PNG, JPG, JPEG, GIF supported</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.gif"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default UploadArea
