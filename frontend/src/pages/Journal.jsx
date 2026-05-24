import { useEffect, useState, useRef } from 'react'
import api from '../services/api'

const EMOTIONS = ['disciplined', 'fomo', 'revenge', 'patient', 'greedy', 'fearful', 'confident']
const MISTAKES = ['none', 'early_exit', 'late_exit', 'oversized', 'no_plan', 'moved_sl', 'chased']

function VoiceButton({ onTranscript }) {
  const [state, setState] = useState('idle') // idle | recording | transcribing
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  async function toggle() {
    if (state === 'recording') {
      mediaRef.current?.stop()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = e => chunksRef.current.push(e.data)

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setState('transcribing')
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'voice.webm')
        try {
          const res = await fetch('/api/analysis/transcribe/', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('access')}` },
            body: formData,
          })
          const data = await res.json()
          if (data.text) onTranscript(data.text)
          else alert('Could not transcribe. Try again.')
        } catch {
          alert('Transcription failed.')
        } finally {
          setState('idle')
        }
      }

      recorder.start()
      mediaRef.current = recorder
      setState('recording')
    } catch (e) {
      alert('Could not access microphone: ' + e.message)
    }
  }

  const label = state === 'recording' ? '⏹ Stop' : state === 'transcribing' ? '⏳ Transcribing…' : '🎤 Voice'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'transcribing'}
      className={state === 'recording' ? 'btn-primary' : 'btn-secondary'}
      style={{ padding: '8px 14px', fontSize: 13 }}
    >
      {label}
    </button>
  )
}

export default function Journal() {
  const [trades, setTrades] = useState([])
  const [selected, setSelected] = useState(null)
  const [entry, setEntry] = useState({ notes: '', emotion: '', mistake: '', rating: '' })
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [autoJournalling, setAutoJournalling] = useState(false)
  const [autoResult, setAutoResult] = useState(null)

  async function loadTrades() {
    const r = await api.get('/trades/')
    setTrades(r.data)
  }

  useEffect(() => { loadTrades() }, [])

  async function runAutoJournal() {
    setAutoJournalling(true)
    setAutoResult(null)
    try {
      const { data } = await api.post('/analysis/auto-journal/')
      setAutoResult(data)
      await loadTrades()
    } catch (err) {
      setAutoResult({ error: err.response?.data?.error || 'Failed' })
    } finally {
      setAutoJournalling(false)
    }
  }

  function selectTrade(trade) {
    setSelected(trade)
    const j = trade.journal_entry
    setEntry({
      notes: j?.notes || '',
      emotion: j?.emotion || '',
      mistake: j?.mistake || '',
      rating: j?.rating || '',
    })
    setSavedId(j?.id || null)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...entry, trade: selected.id, rating: entry.rating || null }
      if (savedId) {
        await api.patch(`/journal/${savedId}/`, payload)
      } else {
        const { data } = await api.post('/journal/', payload)
        setSavedId(data.id)
      }
      setTrades(prev => prev.map(t =>
        t.id === selected.id
          ? { ...t, journal_entry: { ...payload, id: savedId } }
          : t
      ))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 64px)' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Journal</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {autoResult && !autoResult.error && (
            <span style={{ fontSize: 13, color: 'var(--green)' }}>
              ✓ {autoResult.created} created, {autoResult.updated} updated
            </span>
          )}
          {autoResult?.error && (
            <span style={{ fontSize: 13, color: 'var(--red)' }}>⚠ {autoResult.error}</span>
          )}
          <button
            className="btn-primary"
            onClick={runAutoJournal}
            disabled={autoJournalling}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {autoJournalling ? '⏳ AI Journalling…' : '🤖 Auto-Journal All'}
          </button>
        </div>
      </div>

    <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
      <div style={{ width: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trades.length === 0 && <p className="muted">No trades yet — import first</p>}
        {trades.map(t => (
          <div
            key={t.id}
            onClick={() => selectTrade(t)}
            className="card"
            style={{
              cursor: 'pointer', padding: '12px 16px',
              borderColor: selected?.id === t.id ? 'var(--accent)' : 'var(--border)',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{t.symbol}</span>
              <span style={{ fontSize: 12, color: t.trade_type === 'BUY' ? 'var(--green)' : 'var(--red)' }}>{t.trade_type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>{t.volume} lots</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: parseFloat(t.profit) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {t.profit != null ? `$${parseFloat(t.profit).toFixed(2)}` : '—'}
              </span>
            </div>
            {t.journal_entry && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)' }}>✓ Journaled</div>}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p className="muted">Select a trade to journal</p>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  {selected.trade_type} {selected.symbol}
                </h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {selected.volume} lots · Open {parseFloat(selected.open_price).toFixed(5)}
                  {selected.close_price ? ` → ${parseFloat(selected.close_price).toFixed(5)}` : ''}
                </p>
              </div>
              <span style={{
                fontSize: 20, fontWeight: 700,
                color: parseFloat(selected.profit) >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {selected.profit != null ? `$${parseFloat(selected.profit).toFixed(2)}` : '—'}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Notes</label>
                <VoiceButton onTranscript={t => setEntry(e => ({ ...e, notes: e.notes + (e.notes ? ' ' : '') + t }))} />
              </div>
              <textarea
                rows={5}
                placeholder="What happened? What was your reasoning? How did you feel?"
                value={entry.notes}
                onChange={e => setEntry(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Emotion</label>
                <select value={entry.emotion} onChange={e => setEntry(prev => ({ ...prev, emotion: e.target.value }))}>
                  <option value="">Select…</option>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em.charAt(0).toUpperCase() + em.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Mistake</label>
                <select value={entry.mistake} onChange={e => setEntry(prev => ({ ...prev, mistake: e.target.value }))}>
                  <option value="">Select…</option>
                  {MISTAKES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Rating (1-5)</label>
                <input
                  type="number" min={1} max={5}
                  value={entry.rating}
                  onChange={e => setEntry(prev => ({ ...prev, rating: e.target.value }))}
                  placeholder="—"
                />
              </div>
            </div>

            <button className="btn-primary" onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
