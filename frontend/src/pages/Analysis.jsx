import { useState } from 'react'
import api from '../services/api'

const AGENT_COLORS = {
  pattern:  '#6c63ff',
  emotion:  '#26a69a',
  mistakes: '#ef5350',
  risk:     '#ff9800',
  strategy: '#00bcd4',
  coach:    '#ab47bc',
}

function AgentCard({ agent, loading }) {
  const color = AGENT_COLORS[agent.id] || '#6c63ff'

  const formatResult = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color }}>
            {line.replace(/\*\*/g, '')}
          </p>
        )
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <p key={i} style={{ paddingLeft: 16, marginBottom: 6, color: 'var(--text)', lineHeight: 1.6 }}>
            <span style={{ color, marginRight: 6 }}>›</span>
            {line.slice(2)}
          </p>
        )
      }
      if (line.startsWith('**') || line.includes('**')) {
        return (
          <p key={i} style={{ marginBottom: 6, fontWeight: 600, lineHeight: 1.6 }}>
            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
          </p>
        )
      }
      if (line.trim() === '') return <div key={i} style={{ height: 8 }} />
      return (
        <p key={i} style={{ marginBottom: 6, color: 'var(--text)', lineHeight: 1.6 }}>
          {line}
        </p>
      )
    })
  }

  return (
    <div className="card" style={{
      borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{agent.icon}</span>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{agent.name}</p>
          <p className="muted" style={{ fontSize: 12 }}>
            {agent.id === 'pattern' && 'Finding hidden losing patterns'}
            {agent.id === 'emotion' && 'Correlating emotions with outcomes'}
            {agent.id === 'mistakes' && 'Quantifying recurring mistakes'}
            {agent.id === 'risk' && 'Analysing position sizing & R:R'}
            {agent.id === 'coach' && 'Overall assessment & action plan'}
          </p>
        </div>
        {loading && (
          <div style={{
            marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%',
            border: `2px solid ${color}`, borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>

      {loading && !agent.result && !agent.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[80, 60, 90, 50].map((w, i) => (
            <div key={i} style={{
              height: 12, width: `${w}%`, borderRadius: 6,
              background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {agent.error && (
        <p style={{ color: 'var(--red)', fontSize: 13 }}>⚠ {agent.error}</p>
      )}

      {agent.result && (
        <div style={{ fontSize: 14 }}>
          {formatResult(agent.result)}
        </div>
      )}
    </div>
  )
}

export default function Analysis() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ran, setRan] = useState(false)

  async function runAnalysis() {
    setLoading(true)
    setError('')
    setRan(true)

    const placeholders = [
      { id: 'pattern',  name: 'Pattern Detective',  icon: '🔍' },
      { id: 'emotion',  name: 'Emotion Coach',       icon: '🧠' },
      { id: 'mistakes', name: 'Mistake Auditor',     icon: '⚠️' },
      { id: 'risk',     name: 'Risk Analyst',        icon: '📊' },
      { id: 'strategy', name: 'Strategy Analyst',    icon: '🎯' },
      { id: 'coach',    name: 'Head Coach',          icon: '🏆' },
    ]
    setAgents(placeholders)

    try {
      const { data } = await api.post('/analysis/run/')
      setAgents(data.agents)
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>AI Analysis</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            5 AI agents analyse your trades and journal to find what's holding you back
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={runAnalysis}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
        >
          {loading ? (
            <>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
              }} />
              Agents running…
            </>
          ) : (
            <>{ran ? '↻ Re-run Analysis' : '▶ Run Analysis'}</>
          )}
        </button>
      </div>

      {!ran && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>🤖</p>
          <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>5 agents ready to analyse your trading</p>
          <p className="muted" style={{ fontSize: 13, maxWidth: 400, margin: '0 auto 24px' }}>
            Pattern Detective · Emotion Coach · Mistake Auditor · Risk Analyst · Head Coach
          </p>
          <button className="btn-primary" onClick={runAnalysis} style={{ padding: '12px 32px' }}>
            Run Analysis
          </button>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ color: 'var(--red)' }}>⚠ {error}</p>
        </div>
      )}

      {agents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 20 }}>
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} loading={loading} />
          ))}
        </div>
      )}
    </div>
  )
}
