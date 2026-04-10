import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useIRISStore } from '../../store/irisStore'

const COLORS = {
  trader: '#00e5c3',
  expert: '#f0a500',
}

function rollingSharpe(equity: number[], window: number) {
  const rets: number[] = []
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1]
    if (prev > 0) rets.push((equity[i] - prev) / prev)
  }
  const res: (number | null)[] = Array(window).fill(null)
  for (let i = window; i <= rets.length; i++) {
    const slice = rets.slice(i - window, i)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length)
    res.push(std === 0 ? 0 : (mean / std) * Math.sqrt(252))
  }
  return res
}

export default function RollingSharpe({ window = 63 }: { window?: number }) {
  const ts = useIRISStore((s) => s.tearsheet)
  const data = useMemo(() => {
    if (!ts || ts.trader.equity_curve.length < window + 2) return []
    const traderRs = rollingSharpe(ts.trader.equity_curve, window)
    const expertRs = rollingSharpe(ts.expert.equity_curve, window)
    return ts.trader.dates.map((d, i) => ({ date: d, trader: traderRs[i] ?? null, expert: expertRs[i] ?? null }))
  }, [ts, window])

  if (!ts || data.length === 0) return null

  return (
    <div className="iris-card" style={{ padding: '1rem' }}>
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <h3 className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text2)', letterSpacing: '0.08em' }}>Rolling Sharpe ({window}d)</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: 6, right: 6, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text2)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={60} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
          <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} tickLine={false} axisLine={false} width={50} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 8 }} formatter={(v, name) => [Number(v).toFixed(2), name === 'trader' ? 'Trader' : 'Expert']} />
          <Line type="monotone" dataKey="trader" name="Trader" stroke={COLORS.trader} strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="expert" name="Expert" stroke={COLORS.expert} strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
