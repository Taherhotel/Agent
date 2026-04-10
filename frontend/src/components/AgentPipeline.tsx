import { motion } from 'framer-motion'
import { Loader2, RotateCcw } from 'lucide-react'
import { useIRISStore, AGENT_NAMES } from '../store/irisStore'


export default function AgentPipeline({ compact = false }: { compact?: boolean }) {
  const agentStatuses = useIRISStore((s) => s.agentStatuses)
  const appPhase = useIRISStore((s) => s.appPhase)
  const runPipeline = useIRISStore((s) => s.runPipeline)
  const error = useIRISStore((s) => s.error)

  if (appPhase === 'idle') return null

  const hasErrors = Object.values(agentStatuses).some(info => info.status === 'error')

  return (
    <div className={compact ? '' : 'iris-card'} style={{ padding: compact ? 0 : '1.25rem' }}>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="font-mono" style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Agent Pipeline
          </h3>
          {hasErrors && (
            <button 
              className="iris-btn iris-btn-secondary font-mono"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', gap: '0.4rem' }}
              onClick={() => runPipeline()}
            >
              <RotateCcw size={12} /> Retry
            </button>
          )}
        </div>
      )}

      <div className="pipeline">
        {AGENT_NAMES.map((name, i) => {
          const info = agentStatuses[name]
          if (!info) return null

          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="pl-row"
              style={{
                background: info.status === 'error' ? 'rgba(255, 77, 106, 0.05)' : undefined,
                border: info.status === 'error' ? '1px solid rgba(255, 77, 106, 0.2)' : undefined,
                borderRadius: '4px',
                padding: '8px 12px',
              }}
            >
              <span className={`pl-dot ${info.status === 'running' ? 'd-run' : info.status === 'done' ? 'd-done' : info.status === 'error' ? 'd-error' : 'd-idle'}`} />
              <span className="font-mono" style={{ fontSize: '0.8125rem', minWidth: '140px', color: 'var(--text-primary)' }}>
                {name}
              </span>
              <span className="font-mono" style={{ 
                fontSize: '0.75rem', 
                color: info.status === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)', 
                flex: 1 
              }}>
                {info.message}
              </span>
              {info.status === 'running' && (
                <Loader2 size={14} color="var(--accent-teal)" style={{ animation: 'spin 1s linear infinite' }} />
              )}
              {info.status === 'error' && (
                <button 
                  className="iris-btn iris-btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', gap: '0.25rem' }}
                  onClick={() => runPipeline()}
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </motion.div>
          )
        })}
      </div>
      
      {error && !compact && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(255, 77, 106, 0.05)',
          border: '1px solid rgba(255, 77, 106, 0.2)',
          borderRadius: '4px',
          fontFamily: 'var(--mono)',
          fontSize: '0.75rem',
          color: 'var(--accent-red)',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}
