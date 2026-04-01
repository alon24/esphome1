import { useState, useEffect } from 'react'
import FileManager from './pages/FileManager'
import './App.css'

function App() {
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')

  useEffect(() => {
    // Check device connectivity
    fetch('/api/status')
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>ESP32 Display — File Manager</h1>
        <span className={`status-dot ${status}`}></span>
      </header>
      {status === 'ready' && <FileManager />}
      {status === 'error' && <div className="error">Unable to connect to device</div>}
      {status === 'connecting' && <div className="connecting">Connecting...</div>}
    </div>
  )
}

export default App
