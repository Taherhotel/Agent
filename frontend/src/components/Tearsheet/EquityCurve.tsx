import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { useIRISStore } from '../../store/irisStore'

const COLORS = {
  trader: '#00e5c3',
  expert: '#f0a500',
  benchmark: '#6b7a99',
};

export default function EquityCurve() {
  const tearsheet = useIRISStore((s) => s.tearsheet)
  const [showTrader, setShowTrader] = useState(true)
  const [showExpert, setShowExpert] = useState(true)
  const [showBenchmark, setShowBenchmark] = useState(true)

  const data = useMemo(() => {
    if (!tearsheet) return []
    const dates = tearsheet.trader.dates
    return dates.map((date, i) => ({
      date,
      trader: tearsheet.trader.equity_curve[i] ?? null,
      expert: tearsheet.expert.equity_curve[i] ?? null,
      benchmark: tearsheet.benchmark_equity[i] ?? null,
    }))
  }, [tearsheet])

  if (!tearsheet || data.length === 0) return null

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`
    return `$${val.toFixed(0)}`
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  return (
    <div className="iris-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="font-mono" style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Equity Curve
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <ToggleBtn active={showTrader} color={COLORS.trader} onClick={() => setShowTrader(!showTrader)}>
            Trader
          </ToggleBtn>
          <ToggleBtn active={showExpert} color={COLORS.expert} onClick={() => setShowExpert(!showExpert)}>
            Expert
          </ToggleBtn>
          <ToggleBtn active={showBenchmark} color={COLORS.benchmark} onClick={() => setShowBenchmark(!showBenchmark)}>
            SPY
          </ToggleBtn>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'DM Mono' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'DM Mono' }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontFamily: 'DM Mono',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
            }}
            formatter={(value, name) => [formatCurrency(Number(value)), name as string]}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          />
          {showTrader && (
            <Line
              type="monotone"
              dataKey="trader"
              name="Your Strategy"
              stroke={COLORS.trader}
              strokeWidth={2}
              strokeOpacity={0.9}
              dot={false}
              connectNulls
              activeDot={{ r: 4, fill: COLORS.trader }}
            />
          )}
          {showExpert && (
            <Line
              type="monotone"
              dataKey="expert"
              name="Expert Agent"
              stroke={COLORS.expert}
              strokeWidth={2}
              strokeOpacity={0.85}
              dot={false}
              connectNulls
              activeDot={{ r: 4, fill: COLORS.expert }}
            />
          )}
          {showBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name="SPY Benchmark"
              stroke={COLORS.benchmark}
              strokeWidth={1.4}
              strokeOpacity={0.8}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              activeDot={{ r: 3, fill: COLORS.benchmark }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ToggleBtn({ active, color, onClick, children }:
  { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="font-mono"
      style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.25rem 0.625rem',
        borderRadius: '4px',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}15` : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        fontSize: '0.6875rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: active ? color : 'var(--border)',
      }} />
      {children}
    </button>
  )
}
