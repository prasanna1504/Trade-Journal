import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import api from '../services/api'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160 }}>
      <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--text)' }}>{value}</p>
      {sub && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/trades/stats/'),
      api.get('/trades/?ordering=-open_time'),
    ]).then(([s, t]) => {
      setStats(s.data)
      setTrades(t.data.slice(0, 20))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="muted">Loading…</p>

  const equityCurveData = stats?.equity_curve?.map((v, i) => ({ i: i + 1, pnl: v })) || []

  const symbolPnL = {}
  trades.forEach(t => {
    if (!symbolPnL[t.symbol]) symbolPnL[t.symbol] = 0
    symbolPnL[t.symbol] += parseFloat(t.profit || 0)
  })
  const symbolData = Object.entries(symbolPnL).map(([symbol, pnl]) => ({ symbol, pnl: parseFloat(pnl.toFixed(2)) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h2>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard
          label="Total P&L"
          value={`$${stats?.total_profit >= 0 ? '+' : ''}${stats?.total_profit}`}
          color={stats?.total_profit >= 0 ? 'var(--green)' : 'var(--red)'}
        />
        <StatCard label="Win Rate" value={`${stats?.win_rate}%`} sub={`${stats?.winning_trades}W / ${stats?.losing_trades}L`} />
        <StatCard label="Total Trades" value={stats?.total_trades} />
        <StatCard label="Profit Factor" value={stats?.profit_factor} />
        <StatCard
          label="Best Trade"
          value={`$${stats?.best_trade}`}
          color="var(--green)"
        />
        <StatCard
          label="Worst Trade"
          value={`$${stats?.worst_trade}`}
          color="var(--red)"
        />
      </div>

      <div className="card">
        <p style={{ fontWeight: 600, marginBottom: 16 }}>Equity Curve</p>
        {equityCurveData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={equityCurveData}>
              <XAxis dataKey="i" hide />
              <YAxis tickFormatter={v => `$${v}`} width={70} tick={{ fill: '#8888aa', fontSize: 12 }} />
              <Tooltip formatter={v => [`$${v}`, 'P&L']} contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }} />
              <Line type="monotone" dataKey="pnl" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted" style={{ textAlign: 'center', padding: 40 }}>No trades yet — import your trades to see the equity curve</p>
        )}
      </div>

      {symbolData.length > 0 && (
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: 16 }}>P&L by Symbol</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={symbolData}>
              <XAxis dataKey="symbol" tick={{ fill: '#8888aa', fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${v}`} width={70} tick={{ fill: '#8888aa', fontSize: 12 }} />
              <Tooltip formatter={v => [`$${v}`, 'P&L']} contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e' }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {symbolData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <p style={{ fontWeight: 600, marginBottom: 16 }}>Recent Trades</p>
        {trades.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No trades yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Symbol', 'Type', 'Volume', 'Open', 'Close', 'P&L'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.symbol}</td>
                  <td style={{ padding: '10px 12px', color: t.trade_type === 'BUY' ? 'var(--green)' : 'var(--red)' }}>{t.trade_type}</td>
                  <td style={{ padding: '10px 12px' }}>{t.volume}</td>
                  <td style={{ padding: '10px 12px' }}>{parseFloat(t.open_price).toFixed(5)}</td>
                  <td style={{ padding: '10px 12px' }}>{t.close_price ? parseFloat(t.close_price).toFixed(5) : '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: parseFloat(t.profit) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {t.profit != null ? `$${parseFloat(t.profit).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
