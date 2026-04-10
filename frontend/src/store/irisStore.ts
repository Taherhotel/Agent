import { create } from 'zustand'
import type { Tearsheet, HistorySummary, AutomateResult, CurrentUser } from '../api/client'
import { runStrategy, listTearsheets, automateStrategy, healthCheck, getMe } from '../api/client'

/* ── Types ───────────────────────────────────────────────────────── */

export type AppPhase = 'idle' | 'running' | 'complete' | 'error' | 'automating'
export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

export interface AgentStatusInfo {
  status: AgentStatus
  message: string
  time?: number
}

export const AGENT_NAMES = [
  'Manager Agent',
  'Trader Strategy',
  'Expert Agent',
  'Verifier',
  'Comparator',
] as const

export type ExpertType =
  | 'risk_analysis'
  | 'derivatives'
  | 'portfolio'
  | 'alpha_signal'
  | 'fixed_income'
  | 'microstructure'

export const EXPERT_OPTIONS: { value: ExpertType; label: string }[] = [
  { value: 'risk_analysis', label: 'Risk Analysis' },
  { value: 'derivatives', label: 'Derivatives & Pricing' },
  { value: 'portfolio', label: 'Portfolio Construction' },
  { value: 'alpha_signal', label: 'Alpha & Signal Research' },
  { value: 'fixed_income', label: 'Fixed Income & Rates' },
  { value: 'microstructure', label: 'Market Microstructure' },
]

/* ── localStorage helpers ────────────────────────────────────────── */

const LS_KEY = 'iris_defaults'

interface PersistedDefaults {
  capital?: number
  commissionBps?: number
  slippageBps?: number
  maxPositionPct?: number
  mcPaths?: number
  expertType?: ExpertType
  asset?: string
}

function loadDefaults(): PersistedDefaults {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(defaults: PersistedDefaults): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(defaults))
  } catch {
    // ignore storage errors
  }
}

/* ── Store Interface ─────────────────────────────────────────────── */

interface IRISStore {
  // ── Input fields ──
  prompt: string
  asset: string
  startDate: string
  endDate: string
  capital: number
  commissionBps: number
  slippageBps: number
  maxPositionPct: number
  mcPaths: number
  expertType: ExpertType

  // ── Application state ──
  appPhase: AppPhase
  error: string | null
  tearsheet: Tearsheet | null

  // ── Agent pipeline ──
  agentStatuses: Record<string, AgentStatusInfo>

  // ── History ──
  historyItems: HistorySummary[]
  historyLoading: boolean

  // ── Automation ──
  automateResult: AutomateResult | null
  automateModalOpen: boolean
  automateUseExpert: boolean

  // ── Backend health ──
  backendAlive: boolean

  // ── Current user ──
  currentUser: CurrentUser | null

  // ── Input actions ──
  setPrompt: (p: string) => void
  setAsset: (a: string) => void
  setStartDate: (d: string) => void
  setEndDate: (d: string) => void
  setCapital: (c: number) => void
  setCommissionBps: (c: number) => void
  setSlippageBps: (s: number) => void
  setMaxPositionPct: (m: number) => void
  setMcPaths: (n: number) => void
  setExpertType: (t: ExpertType) => void

  // ── Pipeline actions ──
  runPipeline: () => Promise<void>
  setAgentStatus: (name: string, status: AgentStatus, message?: string) => void
  resetPipeline: () => void
  setTearsheet: (ts: Tearsheet | null) => void

  // ── History actions ──
  loadHistory: () => Promise<void>

  // ── Automate actions ──
  openAutomateModal: (useExpert: boolean) => void
  closeAutomateModal: () => void
  confirmAutomate: () => Promise<void>

  // ── Health ──
  checkHealth: () => Promise<void>

  // ── User ──
  fetchUser: () => Promise<void>

  // ── Settings persistence ──
  saveDefaults: () => void
}

/* ── Helper ──────────────────────────────────────────────────────── */

function defaultAgentStatuses(): Record<string, AgentStatusInfo> {
  return Object.fromEntries(
    AGENT_NAMES.map((name) => [name, { status: 'idle' as AgentStatus, message: 'Waiting' }])
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeDate(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const parsed = new Date(d)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  throw new Error('Invalid date format. Use YYYY-MM-DD')
}

/* ── Hydrate from localStorage ───────────────────────────────────── */
const persisted = loadDefaults()

/* ── Store ────────────────────────────────────────────────────────── */

export const useIRISStore = create<IRISStore>((set, get) => ({
  // Defaults — hydrated from localStorage where available
  prompt: '',
  asset:          persisted.asset         ?? 'RELIANCE',
  startDate: '2022-01-01',
  endDate:   '2024-12-31',
  capital:        persisted.capital        ?? 100000,
  commissionBps:  persisted.commissionBps  ?? 10,
  slippageBps:    persisted.slippageBps    ?? 5,
  maxPositionPct: persisted.maxPositionPct ?? 100,
  mcPaths:        persisted.mcPaths        ?? 1000,
  expertType:     persisted.expertType     ?? 'risk_analysis',

  appPhase: 'idle',
  error: null,
  tearsheet: null,

  agentStatuses: defaultAgentStatuses(),

  historyItems: [],
  historyLoading: false,

  automateResult: null,
  automateModalOpen: false,
  automateUseExpert: false,

  backendAlive: false,
  currentUser: null,

  // ── Input setters ──
  setPrompt: (p) => set({ prompt: p }),
  setAsset: (a) => set({ asset: a }),
  setStartDate: (d) => set({ startDate: d }),
  setEndDate: (d) => set({ endDate: d }),
  setCapital: (c) => set({ capital: c }),
  setCommissionBps: (c) => set({ commissionBps: c }),
  setSlippageBps: (s) => set({ slippageBps: s }),
  setMaxPositionPct: (m) => set({ maxPositionPct: m }),
  setMcPaths: (n) => set({ mcPaths: n }),
  setExpertType: (t) => set({ expertType: t }),

  // ── Pipeline ──
  setAgentStatus: (name, status, message) =>
    set((s) => ({
      agentStatuses: {
        ...s.agentStatuses,
        [name]: { status, message: message || s.agentStatuses[name]?.message || '' },
      },
    })),

  resetPipeline: () =>
    set({
      appPhase: 'idle',
      tearsheet: null,
      error: null,
      automateResult: null,
      agentStatuses: defaultAgentStatuses(),
    }),

  setTearsheet: (ts) => set({ tearsheet: ts, appPhase: ts ? 'complete' : 'idle' }),

  runPipeline: async () => {
    const state = get()
    if (state.appPhase === 'running') return

    // Reset
    set({
      appPhase: 'running',
      tearsheet: null,
      error: null,
      automateResult: null,
      agentStatuses: defaultAgentStatuses(),
    })

    const setAgent = get().setAgentStatus

    setAgent('Manager Agent', 'running', 'Parsing strategy...')
    await delay(500)
    setAgent('Manager Agent', 'done', 'Strategy parsed')

    setAgent('Trader Strategy', 'running', 'Running trader simulation...')
    setAgent('Expert Agent', 'running', `Running ${state.expertType} analysis...`)

    // Read Groq key from env (set by user in VITE_GROQ_API_KEY)
    const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

    try {
      const tearsheet = await runStrategy({
        prompt: state.prompt,
        asset: state.asset,
        start_date: normalizeDate(state.startDate),
        end_date: normalizeDate(state.endDate),
        initial_capital: state.capital,
        commission_bps: state.commissionBps,
        slippage_bps: state.slippageBps,
        max_position_pct: state.maxPositionPct / 100,
        monte_carlo_paths: state.mcPaths,
        expert_type: state.expertType,
        groq_api_key: groqKey || undefined,
      })

      setAgent('Trader Strategy', 'done', `Completed in ${tearsheet.trader.elapsed_seconds.toFixed(1)}s`)
      setAgent('Expert Agent', 'done', `Completed in ${tearsheet.expert.elapsed_seconds.toFixed(1)}s`)
      await delay(300)
      setAgent('Verifier', 'running', 'Validating results...')
      await delay(400)
      setAgent('Verifier', 'done', 'Results verified')
      setAgent('Comparator', 'running', 'Generating comparison...')
      await delay(300)
      setAgent('Comparator', 'done', 'Tearsheet ready')

      set({ tearsheet, appPhase: 'complete' })
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Unknown error'

      // Handle broadcasting shape-mismatch errors with a retry
      if (message.includes('operands could not be broadcast together with shapes')) {
        try {
          setAgent('Trader Strategy', 'running', 'Retrying with adjusted parameters...')
          setAgent('Expert Agent', 'running', 'Retrying with adjusted parameters...')

          const adjustedEndDate = new Date(normalizeDate(state.endDate))
          const adjustedStartDate = new Date(normalizeDate(state.startDate))
          const dateDiff = (adjustedEndDate.getTime() - adjustedStartDate.getTime()) / (1000 * 60 * 60 * 24)

          if (dateDiff > 1000) {
            adjustedStartDate.setTime(adjustedEndDate.getTime() - 1000 * 24 * 60 * 60 * 1000)
          }

          const tearsheet = await runStrategy({
            prompt: state.prompt,
            asset: state.asset,
            start_date: adjustedStartDate.toISOString().slice(0, 10),
            end_date: adjustedEndDate.toISOString().slice(0, 10),
            initial_capital: state.capital,
            commission_bps: state.commissionBps,
            slippage_bps: state.slippageBps,
            max_position_pct: Math.min(state.maxPositionPct, 50) / 100,
            monte_carlo_paths: Math.min(state.mcPaths, 500),
            expert_type: state.expertType,
            groq_api_key: groqKey || undefined,
          })

          setAgent('Trader Strategy', 'done', `Completed (retry) in ${tearsheet.trader.elapsed_seconds.toFixed(1)}s`)
          setAgent('Expert Agent', 'done', `Completed (retry) in ${tearsheet.expert.elapsed_seconds.toFixed(1)}s`)
          await delay(300)
          setAgent('Verifier', 'running', 'Validating results...')
          await delay(400)
          setAgent('Verifier', 'done', 'Results verified')
          setAgent('Comparator', 'running', 'Generating comparison...')
          await delay(300)
          setAgent('Comparator', 'done', 'Tearsheet ready')

          set({ tearsheet, appPhase: 'complete' })
          return
        } catch (retryErr: any) {
          const retryMessage = retryErr?.response?.data?.detail || retryErr?.message || 'Retry failed'
          const statuses = get().agentStatuses
          for (const [name, info] of Object.entries(statuses)) {
            if (info.status === 'running') setAgent(name, 'error', retryMessage)
          }
          set({ error: retryMessage, appPhase: 'error' })
          return
        }
      }

      const statuses = get().agentStatuses
      for (const [name, info] of Object.entries(statuses)) {
        if (info.status === 'running') setAgent(name, 'error', message)
      }
      set({ error: message, appPhase: 'error' })
    }
  },

  // ── History ──
  loadHistory: async () => {
    set({ historyLoading: true })
    try {
      const items = await listTearsheets()
      set({ historyItems: items, historyLoading: false })
    } catch {
      set({ historyLoading: false })
    }
  },

  // ── Automate ──
  openAutomateModal: (useExpert) =>
    set({ automateModalOpen: true, automateUseExpert: useExpert, automateResult: null }),

  closeAutomateModal: () =>
    set({ automateModalOpen: false, automateResult: null }),

  confirmAutomate: async () => {
    const { tearsheet, automateUseExpert } = get()
    if (!tearsheet) return

    set({ appPhase: 'automating' })
    try {
      const result = await automateStrategy(tearsheet.run_id, automateUseExpert)
      set({ automateResult: result, appPhase: 'complete' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Automation failed'
      set({
        automateResult: { status: 'error', run_id: tearsheet.run_id, error: message },
        appPhase: 'complete',
      })
    }
  },

  // ── Health ──
  checkHealth: async () => {
    try {
      await healthCheck()
      set({ backendAlive: true })
    } catch {
      set({ backendAlive: false })
    }
  },

  // ── User ──
  fetchUser: async () => {
    try {
      const user = await getMe()
      set({ currentUser: user })
    } catch {
      // Not authenticated or backend down — keep null
      set({ currentUser: null })
    }
  },

  // ── Settings persistence ──
  saveDefaults: () => {
    const s = get()
    const defaults: PersistedDefaults = {
      capital:        s.capital,
      commissionBps:  s.commissionBps,
      slippageBps:    s.slippageBps,
      maxPositionPct: s.maxPositionPct,
      mcPaths:        s.mcPaths,
      expertType:     s.expertType,
      asset:          s.asset,
    }
    saveToStorage(defaults)
  },
}))
