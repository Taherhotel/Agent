import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useIRISStore } from '../../store/irisStore'

const COLORS = {
  trader: '#00e5c3',
  expert: '#f0a500',
}

function computeDrawdown(equity: number[]) {
  const dd: number[] = []
  let peak = equity[0] || 0
  for (const v of equity) {
    peak = Math.max(peak, v)
    dd.push(peak === 0 ? 0 : (v - peak) / peak)
  }
  return dd
}

export default function DrawdownChart() {
  const ts = useIRISStore((s) => s.tearsheet)
  const data = useMemo(() => {
    if (!ts || ts.trader.equity_curve.length === 0) return []
    const traderDd = computeDrawdown(ts.trader.equity_curve)
    const expertDd = computeDrawdown(ts.expert.equity_curve)
    return ts.trader.dates.map((d, i) => ({
      date: d,
      trader: traderDd[i] * 100,
      expert: expertDd[i] * 100,
    }))
  }, [ts])

  if (!ts || data.length === 0) return null

  return (
    <div className="iris-card" style={{ padding: '1rem' }}>
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <h3 className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text2)', letterSpacing: '0.08em' }}>Drawdown (%)</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ left: 6, right: 6, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text2)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={60} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
          <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} tickLine={false} axisLine={false} domain={[dataMin => Math.min(dataMin, -60), 0]} tickFormatter={(v) => `${v.toFixed(0)}%`} />
          <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 8 }} formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name === 'trader' ? 'Trader' : 'Expert']} />
          <Area type="monotone" dataKey="trader" name="Trader" stroke={COLORS.trader} fill={COLORS.trader} fillOpacity={0.2} />
          <Area type="monotone" dataKey="expert" name="Expert" stroke={COLORS.expert} fill={COLORS.expert} fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
