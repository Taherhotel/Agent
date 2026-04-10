import { useState } from 'react'
import { Play, ChevronDown, Sparkles } from 'lucide-react'
import { useIRISStore, EXPERT_OPTIONS } from '../store/irisStore'
import type { ExpertType } from '../store/irisStore'
import { parseStrategy } from '../api/client'

const PLACEHOLDER_STRATEGIES = [
  'Buy when the 50-day MA crosses above the 200-day MA, sell when RSI exceeds 70...',
  'Buy RELIANCE when MACD histogram turns positive, sell when it turns negative...',
  'Go long when Bollinger Band width contracts below 2%, exit on 3% trailing stop...',
]

export default function StrategyInputPanel({ compact = false }: { compact?: boolean } = {}) {
  const {
    prompt, asset, startDate, endDate, capital,
    commissionBps, slippageBps, maxPositionPct, expertType,
    appPhase,
    setPrompt, setAsset, setStartDate, setEndDate, setCapital,
    setCommissionBps, setSlippageBps, setMaxPositionPct, setExpertType,
    runPipeline,
  } = useIRISStore()

  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const isRunning = appPhase === 'running'
  const placeholder = PLACEHOLDER_STRATEGIES[Math.floor(Date.now() / 60000) % PLACEHOLDER_STRATEGIES.length]

  const handleAutofill = async () => {
    if (!prompt.trim()) return
    setParsing(true)
    setParseError(null)
    try {
      const spec = await parseStrategy({
        prompt,
        asset,
        start_date: startDate,
        end_date: endDate,
        initial_capital: capital,
        commission_bps: commissionBps,
        slippage_bps: slippageBps,
        max_position_pct: maxPositionPct / 100,
        monte_carlo_paths: 1000,
      })
      if (spec.asset) setAsset(spec.asset.toUpperCase())
      if (spec.start_date) setStartDate(spec.start_date)
      if (spec.end_date) setEndDate(spec.end_date)
      if (spec.initial_capital) setCapital(spec.initial_capital)
      if (spec.commission_pct !== undefined) setCommissionBps(Math.round(spec.commission_pct * 10000))
      if (spec.slippage_pct !== undefined) setSlippageBps(Math.round(spec.slippage_pct * 10000))
      if (spec.max_position_pct !== undefined) setMaxPositionPct(Math.round(spec.max_position_pct * 100))
      if (spec.strategy_type) setExpertType(spec.strategy_type as ExpertType)
    } catch (e: any) {
      console.warn('Autofill parse failed', e)
      const msg = (e && e.response && e.response.data && e.response.data.detail) || e?.message || 'Auto-fill failed'
      setParseError(msg)
    } finally {
      setParsing(false)
    }
  }

  const panelClass = compact ? 'strategy-panel compact' : 'strategy-panel'

  return (
    <div className={panelClass}>
      <div className="panel-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="font-mono">Strategy Input</h2>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }} className="font-mono">
            Describe your trading strategy in plain English
          </span>
        </div>
      </div>

      {/* Strategy textarea */}
      {parseError && (
        <div className="iris-card" style={{ borderColor: 'rgba(255,77,106,0.3)', background:'rgba(255,77,106,0.05)', padding:'0.5rem', fontSize:'0.78rem', color:'var(--red)', marginBottom:'0.35rem' }}>
          {parseError}
        </div>
      )}
      <textarea
        className="iris-input strategy-textarea font-mono"
        placeholder={placeholder}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={compact ? 4 : 5}
        disabled={isRunning}
      />

      {/* Auto-fill button — single instance below textarea */}
      <button
        className="iris-btn iris-btn-secondary font-mono"
        style={{ padding: '0.5rem 0.75rem', gap: '0.4rem', width: '100%' }}
        onClick={handleAutofill}
        disabled={isRunning || parsing || !prompt.trim()}
        title="Parse prompt to pre-fill fields"
      >
        <Sparkles size={14} /> {parsing ? 'Parsing…' : 'Auto-fill from Prompt'}
      </button>

      {/* Config grid */}
      <div className="config-grid">
        {/* Asset */}
        <div className="config-field">
          <label className="config-label">Asset / Symbol</label>
          <input
            className="iris-input font-mono"
            type="text"
            value={asset}
            onChange={(e) => setAsset(e.target.value.toUpperCase())}
            placeholder="RELIANCE"
            disabled={isRunning}
          />
        </div>

        {/* Date range */}
        <div className="config-field">
          <label className="config-label">From</label>
          <input
            className="iris-input font-mono"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isRunning}
          />
        </div>
        <div className="config-field">
          <label className="config-label">To</label>
          <input
            className="iris-input font-mono"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isRunning}
          />
        </div>

        {/* Capital */}
        <div className="config-field">
          <label className="config-label">Capital ($)</label>
          <input
            className="iris-input font-mono"
            type="number"
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            min={1000}
            step={1000}
            disabled={isRunning}
          />
        </div>

        {/* Commission */}
        <div className="config-field">
          <label className="config-label">Commission (bps)</label>
          <input
            className="iris-input font-mono"
            type="number"
            value={commissionBps}
            onChange={(e) => setCommissionBps(Number(e.target.value))}
            min={0}
            max={100}
            step={1}
            disabled={isRunning}
          />
        </div>

        {/* Slippage */}
        <div className="config-field">
          <label className="config-label">Slippage (bps)</label>
          <input
            className="iris-input font-mono"
            type="number"
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            min={0}
            max={100}
            step={1}
            disabled={isRunning}
          />
        </div>

        {/* Max position */}
        <div className="config-field">
          <label className="config-label">Max Position (%)</label>
          <input
            className="iris-input font-mono"
            type="number"
            value={maxPositionPct}
            onChange={(e) => setMaxPositionPct(Number(e.target.value))}
            min={1}
            max={100}
            step={1}
            disabled={isRunning}
          />
        </div>

        {/* Expert type */}
        <div className="config-field config-field-wide">
          <label className="config-label">Expert Agent</label>
          <div className="select-wrapper">
            <select
              className="iris-input font-mono"
              value={expertType}
              onChange={(e) => setExpertType(e.target.value as ExpertType)}
              disabled={isRunning}
            >
              {EXPERT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-icon" />
          </div>
        </div>
      </div>

      {/* Run button */}
      <button
        className="iris-btn iris-btn-primary run-btn font-mono"
        onClick={runPipeline}
        disabled={isRunning || !prompt.trim()}
      >
        {isRunning ? (
          <>
            <span className="spinner" /> Running…
          </>
        ) : (
          <>
            <Play size={16} fill="currentColor" /> RUN IRIS
          </>
        )}
      </button>

      <style>{`
        .strategy-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: radial-gradient(circle at 20% 20%, rgba(0,229,195,0.05), transparent 45%),
                      radial-gradient(circle at 80% 0%, rgba(240,165,0,0.05), transparent 40%),
                      var(--panel);
          border: 1px solid var(--border2);
          border-radius: 10px;
          padding: 14px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .strategy-panel.compact {
          box-shadow: none;
          background: var(--panel);
          padding: 12px;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .panel-header h2 {
          font-size: 1rem;
          color: var(--text-primary);
          letter-spacing: 0.02em;
        }
        .strategy-textarea {
          resize: vertical;
          min-height: 100px;
          font-size: 0.875rem;
          line-height: 1.6;
          background: var(--raised);
          border: 1px solid var(--border2);
          color: var(--text);
          border-radius: 8px;
        }
        .config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.75rem;
        }
        .config-field-wide { grid-column: span 2; }
        .config-label {
          display: block;
          font-size: 0.6875rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.375rem;
          font-family: var(--font-mono);
        }
        .select-wrapper { position: relative; }
        .select-wrapper select { appearance: none; padding-right: 2rem; }
        .select-icon {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
          pointer-events: none;
        }
        .run-btn {
          width: 100%;
          padding: 0.875rem;
          font-size: 0.9375rem;
          margin-top: 0.5rem;
          background: linear-gradient(90deg, #00e5c3, #00bfa5);
          color: var(--bg);
          border: none;
          box-shadow: 0 10px 24px rgba(0, 229, 195, 0.25);
        }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .config-grid { grid-template-columns: 1fr 1fr; }
          .config-field-wide { grid-column: span 2; }
        }
      `}</style>
    </div>
  )
}
