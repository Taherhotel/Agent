import { Settings as SettingsIcon, Save, User, Mail, Shield, CheckCircle2 } from 'lucide-react'
import { useIRISStore, EXPERT_OPTIONS } from '../store/irisStore'
import type { ExpertType } from '../store/irisStore'
import { useState } from 'react'
import QuantWorkspace from '../components/QuantWorkspace'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Settings() {
  const {
    capital, commissionBps, slippageBps, maxPositionPct, mcPaths, expertType, asset,
    setCapital, setCommissionBps, setSlippageBps, setMaxPositionPct, setMcPaths, setExpertType, setAsset,
    backendAlive, currentUser, saveDefaults,
  } = useIRISStore()

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    saveDefaults()          // persists to localStorage
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const displayName = currentUser?.email
    ? currentUser.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'IRIS User'
  const displayEmail = currentUser?.email ?? '—'
  const displayRole  = currentUser?.role
    ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
    : '—'

  return (
    <QuantWorkspace>
      <div className="main-stack">
        <div className="card-header">
          <SettingsIcon size={18} color="var(--teal)" />
          <h1 className="font-mono">Settings</h1>
        </div>

        {/* System Status */}
        <div className="iris-card">
          <h3 className="section-title">System Status</h3>
          <div className="status-row">
            <span className={`dot ${backendAlive ? 'dot-green' : 'dot-red'}`} />
            <span className={`font-mono ${backendAlive ? 'pos' : 'neg'}`}>
              Backend {backendAlive ? 'Connected' : 'Disconnected'}
            </span>
            <span className="hint">({API_BASE})</span>
          </div>
          <div className="status-row" style={{ marginTop: '0.5rem' }}>
            <span className={`dot ${currentUser ? 'dot-green' : 'dot-red'}`} />
            <span className={`font-mono ${currentUser ? 'pos' : 'neg'}`}>
              Auth {currentUser ? 'Active' : 'Not Authenticated'}
            </span>
          </div>
        </div>

        {/* User Profile */}
        <div className="iris-card">
          <h3 className="section-title">User Profile</h3>
          <div className="user-profile">
            <div className="user-avatar-large">
              <User size={24} />
            </div>
            <div className="user-details">
              <div className="user-info-row">
                <User size={14} className="info-icon" />
                <div>
                  <div className="user-name-large">{displayName}</div>
                  <div className="user-role">{displayRole}</div>
                </div>
              </div>
              <div className="user-info-row">
                <Mail size={14} className="info-icon" />
                <span className="user-email-large">{displayEmail}</span>
              </div>
              <div className="user-info-row">
                <Shield size={14} className="info-icon" />
                <span className="user-plan">{displayRole} Access</span>
              </div>
            </div>
          </div>
          {!currentUser && (
            <p className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.75rem' }}>
              User info loads from <code>/auth/me</code> when the backend is connected.
            </p>
          )}
        </div>

        {/* Default Backtest Config */}
        <div className="iris-card">
          <h3 className="section-title">Default Backtest Configuration</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem', fontFamily: 'var(--mono)' }}>
            These defaults are saved locally and pre-filled on every new run.
          </p>
          <div className="config-grid">
            <ConfigField label="Default Asset">
              <input className="iris-input font-mono" type="text" value={asset}
                onChange={(e) => setAsset(e.target.value.toUpperCase())} placeholder="RELIANCE" />
            </ConfigField>
            <ConfigField label="Initial Capital ($)">
              <input className="iris-input font-mono" type="number" value={capital}
                onChange={(e) => setCapital(Number(e.target.value))} min={1000} step={1000} />
            </ConfigField>
            <ConfigField label="Commission (bps)">
              <input className="iris-input font-mono" type="number" value={commissionBps}
                onChange={(e) => setCommissionBps(Number(e.target.value))} min={0} max={100} />
            </ConfigField>
            <ConfigField label="Slippage (bps)">
              <input className="iris-input font-mono" type="number" value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))} min={0} max={100} />
            </ConfigField>
            <ConfigField label="Max Position (%)">
              <input className="iris-input font-mono" type="number" value={maxPositionPct}
                onChange={(e) => setMaxPositionPct(Number(e.target.value))} min={1} max={100} />
            </ConfigField>
            <ConfigField label="Monte Carlo Paths">
              <input className="iris-input font-mono" type="number" value={mcPaths}
                onChange={(e) => setMcPaths(Number(e.target.value))} min={100} max={50000} step={100} />
            </ConfigField>
            <ConfigField label="Default Expert Agent">
              <select className="iris-input font-mono" value={expertType}
                onChange={(e) => setExpertType(e.target.value as ExpertType)}>
                {EXPERT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </ConfigField>
          </div>
          <button
            className="iris-btn iris-btn-primary font-mono"
            onClick={handleSave}
            style={{ marginTop: '1.25rem', width: '100%' }}
          >
            {saved
              ? <><CheckCircle2 size={14} /> Saved to local storage ✓</>
              : <><Save size={14} /> Save Defaults</>
            }
          </button>
        </div>

        {/* About */}
        <div className="iris-card">
          <h3 className="section-title">About IRIS</h3>
          <p className="body-text">
            <strong className="accent">IRIS</strong> — Intelligent Reasoning &amp; Inferential Simulator.
            An AI-powered backtesting tool for NSE/BSE strategies using Angel One SmartAPI for live market data.
            Supports plain-English strategy input, multi-agent execution, Monte Carlo simulation, and LLM-powered analysis.
          </p>
          <p className="footnote">v0.2.0 · Data: Angel One SmartAPI · LLM: Groq / Anthropic / OpenRouter</p>
        </div>
      </div>
    </QuantWorkspace>
  )
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="config-field">
      <label className="config-label">{label}</label>
      {children}
    </div>
  )
}
