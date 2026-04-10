# IRIS — Project Structure

> **Single source of truth** for the codebase layout. See `README.md` for the project overview and `RUN_LOCAL.md` to run locally.

---

## Directory Tree

```
iris/
│
├── README.md                          # Project overview
├── STRUCTURE.md                       # This file
├── RUN_LOCAL.md                       # How to run the stack locally
├── HOW_IRIS_WORKS.md                  # System architecture & agent design
├── .env / .env.example                # Environment variable config
├── .gitignore
├── docker-compose.yml                 # Full-stack local orchestration
├── requirements.txt                   # Python dependencies
├── pyproject.toml                     # Project metadata and tool config
│
├── app/                               ══ BACKEND (FastAPI) ══════════════════
│   ├── main.py                        Entry point. Registers all routers.
│   │                                  Adds CORS, auth, and startup events.
│   ├── config.py                      Pydantic Settings class. Reads from .env.
│   ├── db.py                          SQLite engine, Session factory, init_db()
│   ├── models.py                      SQLModel table models: User, TearsheetRecord, PriceCache
│   │
│   ├── api/                           ── HTTP ROUTES ──────────────────────────
│   │   ├── __init__.py
│   │   ├── auth.py                    POST /auth/login → JWT token
│   │   │                              GET  /auth/me    → current user
│   │   ├── strategy.py                POST /api/run    → full pipeline (auth required)
│   │   │                              POST /api/parse  → parse-only debug endpoint
│   │   ├── backtest.py                POST /api/backtest → alias for /run (auth required)
│   │   ├── tearsheet.py               GET  /api/tearsheet/{run_id} → full tearsheet
│   │   │                              GET  /api/tearsheets          → run summaries list
│   │   └── automator.py               POST /api/automate/{run_id}   → deploy from run
│   │                                  POST /api/automate/strategy   → deploy from spec
│   │
│   ├── agents/                        ══ AGENT LAYER ════════════════════════
│   │   ├── __init__.py
│   │   ├── manager.py                 ★ MANAGER / ORCHESTRATOR AGENT
│   │   │                              • Parses NL prompt via LLM
│   │   │                              • Builds StrategySpec (Pydantic model)
│   │   │                              • Selects and fires Trader + Expert in parallel
│   │   │                              • Hands off to Verifier → Comparator
│   │   │                              • Calls LLM to narrate tearsheet in English
│   │   │                              • Triggers Automator if trader approves
│   │   │
│   │   ├── trader_strategy.py         TRADER STRATEGY AGENT
│   │   │                              • Translates StrategySpec into vectorised signals
│   │   │                              • Calls engine.runner.BacktestRunner
│   │   │                              • Returns AgentResult (equity curve, trade log)
│   │   │
│   │   ├── verifier.py                VERIFIER AGENT
│   │   │                              • Checks data shape, trade count, NaN-free curves
│   │   │                              • Returns VerifierResult(ok, issues[])
│   │   │
│   │   ├── comparator.py              COMPARATOR AGENT
│   │   │                              • Aligns curves, adds SPY benchmark
│   │   │                              • Computes Sharpe, Sortino, max drawdown, CAGR
│   │   │                              • Returns raw Tearsheet
│   │   │
│   │   ├── automator.py               AUTOMATOR AGENT
│   │   │                              • Serialises strategy → broker-ready config
│   │   │                              • Registers with Alpaca paper trading
│   │   │                              • Flags SUCCESS / ERROR back to Manager
│   │   │
│   │   └── expert/                    ── EXPERT BENCHMARK AGENTS ──────────────
│   │       ├── base.py                Abstract base: run(spec) → AgentResult
│   │       │
│   │       ├── risk_analysis.py       RISK ANALYSIS AGENT
│   │       │                          Algorithms (from app.algorithms.risk):
│   │       │                          • GARCHModel  — vol forecast
│   │       │                          • EGARCHModel — leverage-adjusted vol
│   │       │                          • simulate_gbm_paths — MC equity paths
│   │       │                          • value_at_risk / cvar / annualised_return_distribution
│   │       │                          Metrics: garch_vol, egarch_vol, var_95, cvar_95,
│   │       │                                   return_dist_p5/p50/p95/mean
│   │       │
│   │       ├── derivatives_pricing.py DERIVATIVES & PRICING AGENT
│   │       │                          Algorithms (from app.algorithms.pricing):
│   │       │                          • bsm_price / bsm_greeks — European call/put
│   │       │                          • binomial_price — American put (CRR tree)
│   │       │                          Metrics: implied_vol_used, entry_delta, entry_gamma,
│   │       │                                   entry_theta, entry_vega, entry_rho, am_put_binomial
│   │       │
│   │       ├── portfolio_construction.py PORTFOLIO CONSTRUCTION AGENT
│   │       │                          Algorithms (from app.algorithms.portfolio):
│   │       │                          • max_sharpe_weights — SLSQP MVO optimisation
│   │       │                          • black_litterman_weights — BL posterior weights
│   │       │                          Metrics: mvo_w_{ticker}, bl_w_{ticker} per asset
│   │       │
│   │       ├── alpha_signal.py        ALPHA GENERATION & SIGNAL AGENT
│   │       │                          Algorithms (from app.algorithms.alpha):
│   │       │                          • KalmanHedgeFilter — dynamic hedge ratio
│   │       │                          • cointegration_test — Engle-Granger ADF test
│   │       │                          • spread_zscore — rolling z-score
│   │       │                          Metrics: kalman_final_hedge, ols_hedge_ratio,
│   │       │                                   cointegration_pvalue, cointegrated, spread_std
│   │       │
│   │       ├── fixed_income.py        FIXED INCOME & RATES AGENT
│   │       │                          Algorithms (from app.algorithms.fixed_income):
│   │       │                          • VasicekModel — short rate path simulation
│   │       │                          • make_bond_cashflows / price_from_yield — bond pricing
│   │       │                          • modified_duration / dv01 / convexity — risk analytics
│   │       │                          Metrics: modified_duration, dv01, convexity, final_rate,
│   │       │                                   yield_curve_1y/5y/10y
│   │       │
│   │       └── microstructure.py      MARKET MICROSTRUCTURE AGENT
│   │                                  Algorithms (from app.algorithms.microstructure):
│   │                                  • RegimeHMM — 2-state bull/bear regime detection
│   │                                  • vwap — volume-weighted average price series
│   │                                  • execution_schedule — VWAP order slicing
│   │                                  Metrics: bull_regime_pct, regime_switches,
│   │                                           bull/bear mean_return_ann, volatility_ann
│   │
│   ├── engine/                        ══ BACKTEST ENGINE ════════════════════
│   │   ├── runner.py                  BacktestRunner — bar-by-bar simulation loop
│   │   ├── friction.py                Commission (bps), slippage, market impact
│   │   ├── portfolio.py               Cash, positions, P&L tracking
│   │   └── event.py                   Bar, Order, Fill, Position data classes
│   │
│   ├── algorithms/                    ══ QUANTITATIVE ALGORITHM LIBRARY ═════
│   │   │                              Pure math — no agent logic.
│   │   │                              All modules are imported by live agents.
│   │   │
│   │   ├── risk/
│   │   │   ├── monte_carlo.py         simulate_gbm_paths, value_at_risk, cvar,
│   │   │   │                          annualised_return_distribution
│   │   │   └── garch.py               GARCHModel, EGARCHModel
│   │   │
│   │   ├── pricing/
│   │   │   ├── black_scholes.py       bsm_price, bsm_greeks, implied_volatility
│   │   │   └── binomial_tree.py       binomial_price (European + American), binomial_delta
│   │   │
│   │   ├── portfolio/
│   │   │   ├── mean_variance.py       max_sharpe_weights, min_variance_weights, efficient_frontier
│   │   │   └── black_litterman.py     black_litterman_returns, black_litterman_weights
│   │   │
│   │   ├── alpha/
│   │   │   ├── kalman_filter.py       KalmanHedgeFilter (fit, spread, zscore)
│   │   │   └── pairs_trading.py       cointegration_test, spread_zscore, PairsTradingSignal
│   │   │
│   │   ├── fixed_income/
│   │   │   ├── duration_convexity.py  price_from_yield, modified_duration, dv01,
│   │   │   │                          convexity, make_bond_cashflows
│   │   │   └── short_rate_models.py   VasicekModel, CIRModel (simulate, zero_coupon_price,
│   │   │                              yield_curve)
│   │   │
│   │   └── microstructure/
│   │       ├── hmm.py                 RegimeHMM (fit, predict, regime_stats)
│   │       └── vwap_twap.py           vwap, twap, execution_schedule, arrival_cost
│   │
│   ├── signals/                       ══ TECHNICAL INDICATOR LIBRARY ════════
│   │   ├── moving_averages.py         sma, ema, crossover_signal
│   │   ├── oscillators.py             rsi, macd, stochastic, cci
│   │   ├── volatility.py              atr, bollinger_bands, keltner_channel
│   │   └── volume.py                  obv, vwap, accumulation_distribution
│   │
│   ├── data/                          ══ DATA LAYER ═════════════════════════
│   │   ├── loader.py                  load_ohlcv(ticker, start, end) → pd.DataFrame
│   │   │                              Routes to provider, caches result to disk.
│   │   ├── providers/
│   │   │   ├── yahoo.py               yfinance — default historical provider
│   │   │   ├── alpaca.py              Alpaca Markets — live/paper trading data
│   │   │   └── csv.py                 Local CSV OHLCV files
│   │   └── cache/                     Parquet cache files (auto-generated)
│   │                                  Naming: {TICKER}_{start}_{end}.parquet
│   │
│   ├── nlp/                           ══ NLP / PARSING LAYER ════════════════
│   │   ├── parser.py                  StrategyParser.parse(prompt) → StrategySpec
│   │   ├── schema.py                  Pydantic models: StrategySpec, AgentResult,
│   │   │                              RunRequest, Tearsheet, VerifierResult
│   │   └── prompts/
│   │       ├── parse_strategy.txt     System prompt: NL → StrategySpec JSON
│   │       └── explain_tearsheet.txt  System prompt: results → plain English
│   │
│   ├── tearsheet/                     ══ PERFORMANCE REPORTING ══════════════
│   │   ├── metrics.py                 sharpe, sortino, max_drawdown, cagr, win_rate
│   │   ├── builder.py                 build_tearsheet() → Tearsheet object
│   │   └── serialiser.py              tearsheet_to_json, summary_dict (used by scripts/)
│   │
│   └── utils/
│       ├── logger.py                  Structured logging + run_id generation
│       ├── dates.py                   Trading calendar helpers
│       └── validators.py              Ticker + date range sanity checks
│
├── frontend/                          ══ FRONTEND (React + Vite + TypeScript) ══
│   ├── package.json / vite.config.ts
│   ├── index.html
│   └── src/                           (see frontend/README.md for full component tree)
│       ├── main.tsx / App.tsx
│       ├── api/                       Typed API client
│       ├── components/                Input, pipeline, tearsheet, modal components
│       └── pages/                     StrategyLab, History
│
├── tests/                             ══ TEST SUITE (93 tests, all passing) ═══
│   ├── conftest.py                    Fixtures: mock OHLCV, mock LLM, StrategySpec presets
│   ├── agents/                        test_manager, test_verifier, test_comparator
│   ├── algorithms/                    test_monte_carlo, test_garch, test_black_scholes,
│   │                                  test_pairs_trading, test_kalman_filter, test_metrics
│   ├── engine/                        test_runner, test_friction
│   └── nlp/                           test_parser
│
└── scripts/
    ├── seed_cache.py                  Pre-download AAPL/SPY/TLT OHLCV for dev
    ├── run_example.py                 CLI end-to-end run, prints tearsheet to stdout
    └── benchmark.py                   Algorithm performance benchmarks
```

---

## Data Flow

```
User NL Prompt
      │
      ▼
ManagerAgent           [LLM: parse strategy + detect expert type]
      │
      ├── StrategySpec (Pydantic)
      └── Expert selection
            │
            ▼
asyncio.gather(
  TraderStrategyAgent.run(spec),   [executes trader's exact strategy]
  ExpertAgent.run(spec)            [domain algorithm benchmark]
)
      │
      ▼
VerifierAgent.verify(trader, expert, spec)
      │
      ▼
ComparatorAgent.compare(trader, expert) → Tearsheet
      │
      ▼
ManagerAgent._narrate(tearsheet)   [LLM: plain-English summary]
      │
      ▼
Tearsheet (+ narrative) → API → Frontend
      │
      ▼  (if trader approves)
AutomatorAgent.deploy(spec)        [live/paper trading registration]
```

---

## Key Engineering Decisions

| Decision | Rationale |
|---|---|
| `asyncio.gather()` for dual simulation | Trader + Expert run in parallel — ~50% wall-time reduction |
| Agents and algorithms separated | Algorithms are pure math, unit-testable without LLM or data mocks |
| LLM prompts as `.txt` files | Prompt engineers can iterate without touching Python |
| Pydantic throughout | Runtime validation at every boundary; auto-generates OpenAPI docs |
| Event-driven backtest engine | Matches live trading architecture — low-friction path to deployment |
| Disk-cached OHLCV (parquet) | Dev loop is fast; avoids provider rate limits |
| SQLite + SQLModel | Zero-config persistence for tearsheets and users; swap to Postgres in prod via `DB_URL` |
| JWT auth (bypass mode in dev) | `get_current_user()` returns admin stub in dev; swap to real verification for prod |

---

## Environment Variables

```env
# LLM (at least one required)
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct:free

# Data (optional — yfinance is the default free provider)
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...

# Auth
JWT_SECRET=dev-change-me        # CHANGE IN PRODUCTION
admin_email=admin@iris.local
admin_password=ChangeMe123!

# Backtest defaults (all optional)
BACKTEST_DEFAULT_CAPITAL=100000
BACKTEST_COMMISSION_PCT=0.001
BACKTEST_SLIPPAGE_PCT=0.0005
BACKTEST_DEFAULT_ASSET=SPY

# Server
PORT=8000
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:5173"]
DB_URL=sqlite:///./iris.db
```
