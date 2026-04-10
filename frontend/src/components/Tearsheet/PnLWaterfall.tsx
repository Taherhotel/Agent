import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { useIRISStore } from '../../store/irisStore'

const COLOR_GAIN = '#00e5c3'
const COLOR_LOSS = '#ff4466'

export default function PnLWaterfall() {
  const ts = useIRISStore((s) => s.tearsheet)

  const data = useMemo(() => {
    if (!ts) return []
    const trades = ts.trader.trade_log.filter(t => t.side === 'SELL' && t.pnl_pct !== null)
    if (trades.length === 0) return []
    return trades.map((t, i) => ({
      name: `T${i + 1}`,
      pnl_pct: Number(t.pnl_pct),
    }))
  }, [ts])

  if (!ts || data.length === 0) return null

  return (
    <div className="iris-card" style={{ padding: '1rem' }}>
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <h3 className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text2)', letterSpacing: '0.08em' }}>P&L Waterfall (per closed trade)</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 6, right: 6, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
          <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 8 }} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'P&L %']} />
          <Bar dataKey="pnl_pct" radius={[4,4,0,0]}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.pnl_pct >= 0 ? COLOR_GAIN : COLOR_LOSS} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
