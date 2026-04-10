# IRIS — How It Works

> A plain-English explanation of IRIS's architecture, agent design, and execution flow.

---

## What is IRIS?

**IRIS (Intelligent Reasoning & Inferential Simulator)** is an agentic AI backtesting tool. A trader types a strategy in plain English — *"buy when the 50-day MA crosses above the 200-day MA, sell when RSI exceeds 70"* — and IRIS automatically:

1. Parses the strategy using an LLM
2. Runs a realistic historical simulation (with commission, slippage, and position limits)
3. Benchmarks it against a domain-matched expert algorithm
4. Returns a tearsheet: equity curve, Sharpe ratio, max drawdown, win rate
5. Narrates the results in plain English
6. Optionally automates the approved strategy via a live broker (Alpaca)

---

## Agent Architecture

```
Trader / User
      │
      ▼
┌─────────────────────────────────────────┐
│         Manager / Orchestrator Agent    │
│  • Parses NL prompt via LLM             │
│  • Builds StrategySpec                  │
│  • Selects Expert Agent                 │
│  • Coordinates pipeline                 │
│  • Narrates result in English           │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
 Trader Strategy      Expert Agent
 Agent                (domain-matched)
 [trader's rules]     [benchmark algo]
        │                 │
        └────────┬────────┘
                 ▼
         Verifier Agent
         [validates both outputs]
                 │
                 ▼
         Comparator Agent
         [builds Tearsheet]
                 │
                 ▼
         Manager narrates
                 │
                 ▼
       Automator Agent (optional)
       [live/paper deployment]
```

---

## Agent Descriptions

### 1. Manager Agent (`agents/manager.py`)
The orchestrator. It:
- Sends the NL prompt to an LLM and extracts a structured `StrategySpec` (asset, dates, entry/exit rules, capital, risk limits)
- Detects the strategy type (risk, derivatives, portfolio, alpha, fixed income, microstructure) and selects the matching Expert Agent
- Fires the Trader and Expert agents **in parallel** via `asyncio.gather()`
- Passes results to the Verifier, then the Comparator
- Calls the LLM again to produce a plain-English tearsheet narrative
- If the trader approves automation, triggers the Automator Agent

---

### 2. Trader Strategy Agent (`agents/trader_strategy.py`)
Executes **exactly what the trader asked for**:
- Translates `StrategySpec` entry/exit conditions into vectorised pandas signal series
- Runs the backtest via `engine.runner.BacktestRunner`
- Returns `AgentResult` (equity curve, trade log, performance metrics)

---

### 3. Expert Agents (`agents/expert/`)
Each expert runs a **domain-algorithm benchmark** on the same asset and date range, for comparison against the trader's strategy. All algorithms are imported from `app/algorithms/` — no inline math.

| Expert Agent | Strategy Type | Algorithms Used |
|---|---|---|
| `RiskAnalysisAgent` | Risk / Monte Carlo | GARCH(1,1), EGARCH, GBM simulation, VaR, CVaR |
| `DerivativesPricingAgent` | Options / Derivatives | BSM pricing + Greeks, CRR Binomial Tree (American) |
| `PortfolioAgent` | Portfolio Construction | MVO (SLSQP max-Sharpe), Black-Litterman |
| `AlphaSignalAgent` | Alpha / Statistical Arb | Kalman Filter hedge ratio, Engle-Granger cointegration, Pairs Trading |
| `FixedIncomeAgent` | Fixed Income / Rates | Vasicek rate model, Duration, DV01, Convexity, bond pricing |
| `MicrostructureAgent` | Market Microstructure | 2-state HMM (bull/bear regimes), VWAP, Execution Scheduling |

---

### 4. Verifier Agent (`agents/verifier.py`)
Quality-gates both outputs before comparison:
- Checks data shape, trade count > 0, no NaN in equity curves, date range alignment
- If a check fails, flags which agent needs to rerun and why
- If both pass, forwards results to the Comparator

---

### 5. Comparator Agent (`agents/comparator.py`)
Builds the tearsheet:
- Aligns all equity curves on a common date index
- Adds SPY as a passive benchmark
- Computes Sharpe, Sortino, max drawdown, CAGR, win rate for each series
- Returns a `Tearsheet` object with all three series + metrics

---

### 6. Automator Agent (`agents/automator.py`)
If the trader approves:
- Serialises the chosen `StrategySpec` to a broker-ready config
- Registers the strategy with Alpaca (paper or live)
- Flags SUCCESS or ERROR back to the Manager

---

## Quantitative Algorithm Library (`app/algorithms/`)

All expert agents delegate their core math to dedicated, unit-tested algorithm modules:

```
algorithms/
├── risk/
│   ├── garch.py          GARCH(1,1), EGARCH volatility models
│   └── monte_carlo.py    GBM paths, VaR, CVaR, return distribution
├── pricing/
│   ├── black_scholes.py  BSM price, Greeks (Δ, Γ, θ, ν, ρ), implied vol
│   └── binomial_tree.py  CRR tree — European and American options
├── portfolio/
│   ├── mean_variance.py  Efficient frontier, max-Sharpe (SLSQP), min-variance
│   └── black_litterman.py BL posterior returns and weights
├── alpha/
│   ├── kalman_filter.py  KalmanHedgeFilter — dynamic hedge ratio + z-score
│   └── pairs_trading.py  Cointegration test (ADF), spread z-score, PairsTradingSignal
├── fixed_income/
│   ├── duration_convexity.py  Modified duration, DV01, convexity, bond cash flows
│   └── short_rate_models.py   VasicekModel, CIRModel — path simulation + yield curve
└── microstructure/
    ├── hmm.py            RegimeHMM — 2-state Gaussian HMM (hmmlearn or fallback)
    └── vwap_twap.py      VWAP, TWAP, execution_schedule, arrival_cost
```

---

## Backtest Engine (`app/engine/`)

An event-driven simulation that matches how live trading systems work:

```
For each bar:
  ├── Evaluate entry signal conditions
  ├── Evaluate exit signal conditions
  ├── Size order (position % limit, max capital)
  ├── Apply friction (commission bps + slippage)
  ├── Update Portfolio (cash, positions, P&L)
  └── Log trade event
```

This architecture makes backtested strategies **directly portable** to live deployment via the Automator Agent.

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| API Framework | FastAPI + Uvicorn |
| Data Validation | Pydantic v2 + SQLModel |
| Database | SQLite (dev) / PostgreSQL (prod) via `DB_URL` |
| Auth | JWT (python-jose) |
| LLM | OpenRouter (configurable model) |
| Data | yfinance (default), Alpaca, local CSV |
| Math | NumPy, SciPy, pandas, statsmodels |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Charts | Recharts |
| State | Zustand |
| HTTP | Axios |
| Animations | Framer Motion |
