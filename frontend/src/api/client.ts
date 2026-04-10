import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

/* ── Axios Client ─────────────────────────────────────────────────────────── */
const client = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 180_000,
})

// Attach auth token if present in localStorage
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('iris_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

/* ── TypeScript Interfaces matching backend Pydantic schemas ─────── */

export interface RunRequest {
  prompt: string
  asset: string
  start_date: string
  end_date: string
  initial_capital: number
  commission_bps: number
  slippage_bps: number
  max_position_pct: number
  monte_carlo_paths: number
  expert_type?: string
  groq_api_key?: string
}

export interface TearsheetMetrics {
  sharpe: number
  sortino: number
  max_drawdown: number
  win_rate: number
  cagr: number
  calmar: number
  total_return: number
  volatility: number
  trade_count: number
}

export interface TradeLogEntry {
  date: string
  side: string
  price: number
  quantity: number
  pnl_pct: number | null
}

export interface AgentResult {
  agent_name: string
  equity_curve: number[]
  dates: string[]
  trade_log: TradeLogEntry[]
  metrics: Record<string, number>
  paths?: number[][]
  error: string | null
  elapsed_seconds: number
}

export interface StrategySpec {
  raw_prompt: string
  asset: string
  start_date: string
  end_date: string
  initial_capital: number
  parsed_rules_text: string
  confidence: number
  strategy_type: string
  commission_pct?: number
  slippage_pct?: number
  max_position_pct?: number
  risk_per_trade_pct?: number
}

export interface Tearsheet {
  run_id: string
  strategy_spec: StrategySpec
  trader: AgentResult
  expert: AgentResult
  trader_metrics: TearsheetMetrics
  expert_metrics: TearsheetMetrics
  benchmark_equity: number[]
  benchmark_metrics: TearsheetMetrics
  narrative: string
  expert_type: string
}

export interface HistorySummary {
  run_id: string
  asset: string
  start_date: string
  end_date: string
  sharpe: number | null
  cagr: number | null
  max_drawdown: number | null
}

export interface AutomateResult {
  status: string
  run_id: string
  message?: string
  error?: string
}

export interface CurrentUser {
  email: string
  role: string
}

export interface QuoteData {
  symbol: string
  exchange: string
  token: string
  ltp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/* ── API Functions ───────────────────────────────────────────────────── */

/** Full pipeline: parse → trader + expert → verify → compare → narrate */
export async function runStrategy(req: RunRequest): Promise<Tearsheet> {
  const { data } = await client.post<Tearsheet>('/run', req)
  return data
}

/** Parse-only for debugging */
export async function parseStrategy(req: RunRequest): Promise<StrategySpec> {
  const { data } = await client.post<StrategySpec>('/parse', req)
  return data
}

/** Get a single tearsheet by run ID */
export async function getTearsheet(runId: string): Promise<Tearsheet> {
  const { data } = await client.get<Tearsheet>(`/tearsheet/${runId}`)
  return data
}

/** List all past run summaries */
export async function listTearsheets(): Promise<HistorySummary[]> {
  const { data } = await client.get<HistorySummary[]>('/tearsheets')
  return data
}

/** Deploy (automate) a strategy from an existing run */
export async function automateStrategy(
  runId: string,
  useExpert: boolean = false
): Promise<AutomateResult> {
  const { data } = await client.post<AutomateResult>(
    `/automate/${runId}`,
    null,
    { params: { use_expert: useExpert } }
  )
  return data
}

/** Get the currently authenticated user from the backend */
export async function getMe(): Promise<CurrentUser> {
  const { data } = await client.get<CurrentUser>('/auth/me', { baseURL: API_BASE })
  return data
}

/** Real-time quote for an NSE/BSE symbol */
export async function getQuote(symbol: string, exchange = 'NSE'): Promise<QuoteData> {
  const { data } = await client.get<QuoteData>(`/quote/${symbol}`, { params: { exchange } })
  return data
}

/** Health check */
export async function healthCheck(): Promise<{ status: string; version: string }> {
  const { data } = await axios.get(`${API_BASE}/health`, { timeout: 5000 })
  return data
}
