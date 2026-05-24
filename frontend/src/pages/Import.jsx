import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '../services/api'

function PasteJSONTab({ setResult, setError, loading, setLoading }) {
  const [text, setText] = useState('')

  async function handleImport() {
    setError('')
    setResult(null)
    let parsed
    try {
      parsed = JSON.parse(text.trim())
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array')
    } catch (e) {
      setError('Invalid JSON — paste the array copied from the browser console')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/trades/import/json/', { trades: parsed })
      setResult(data)
      setText('')
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <p style={{ marginBottom: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        Paste the JSON array you copied from the browser console.
      </p>
      <textarea
        rows={8}
        placeholder='[{"symbol":"EURUSD","open_time":"22.05.2026 10:00", ...}]'
        value={text}
        onChange={e => setText(e.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
      />
      <button className="btn-primary" onClick={handleImport} disabled={loading || !text.trim()}>
        {loading ? 'Importing…' : 'Import Trades'}
      </button>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-input)',
        color: active ? '#fff' : 'var(--text-muted)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        borderRadius: 8, padding: '8px 20px', fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

export default function Import() {
  const [tab, setTab] = useState('json')
  const [mt5Form, setMt5Form] = useState({ login: '', password: '', server: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleMT5Submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { data } = await api.post('/trades/import/mt5/', mt5Form)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to MT5')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await api.post('/trades/import/csv/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse CSV')
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1,
  })

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Import Trades</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <TabButton active={tab === 'json'} onClick={() => setTab('json')}>Paste JSON</TabButton>
        <TabButton active={tab === 'csv'} onClick={() => setTab('csv')}>Upload CSV</TabButton>
        <TabButton active={tab === 'mt5'} onClick={() => setTab('mt5')}>MT5 Auto-fetch</TabButton>
      </div>

      {tab === 'json' && (
        <PasteJSONTab setResult={setResult} setError={setError} loading={loading} setLoading={setLoading} />
      )}

      {tab === 'mt5' && (
        <div className="card">
          <p style={{ marginBottom: 20, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
            Enter your MT5 credentials. We use the <strong style={{ color: 'var(--text)' }}>investor (read-only) password</strong> — we cannot place trades.
          </p>
          <form onSubmit={handleMT5Submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Account Number</label>
              <input
                placeholder="e.g. 12345678" required
                value={mt5Form.login}
                onChange={e => setMt5Form({ ...mt5Form, login: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Investor Password</label>
              <input
                type="password" placeholder="Read-only investor password" required
                value={mt5Form.password}
                onChange={e => setMt5Form({ ...mt5Form, password: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Server</label>
              <input
                placeholder="e.g. ICMarkets-Demo02" required
                value={mt5Form.server}
                onChange={e => setMt5Form({ ...mt5Form, server: e.target.value })}
              />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Fetching trades…' : 'Fetch Trade History'}
            </button>
          </form>
        </div>
      )}

      {tab === 'csv' && (
        <div className="card">
          <p style={{ marginBottom: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Export your trade history from MT5 as CSV and upload it here.
          </p>
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10, padding: 48, textAlign: 'center', cursor: 'pointer',
              background: isDragActive ? 'rgba(108,99,255,0.05)' : 'transparent',
              transition: 'all 0.2s',
            }}
          >
            <input {...getInputProps()} />
            <p style={{ fontSize: 32, marginBottom: 12 }}>📂</p>
            <p style={{ fontWeight: 600 }}>{isDragActive ? 'Drop it here' : 'Drag & drop your CSV'}</p>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>or click to browse</p>
          </div>
          {loading && <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>Parsing…</p>}
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--green)' }}>
          <p style={{ color: 'var(--green)', fontWeight: 600 }}>Import complete</p>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {result.imported} trades imported · {result.skipped} already existed
          </p>
        </div>
      )}
    </div>
  )
}
