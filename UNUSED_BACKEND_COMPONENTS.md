# IRIS — Backend Component Status

> **Status as of April 2026.**
> This document tracks which backend components are fully wired into the live pipeline and which are future extension points.

---

## ✅ Fully Wired — Algorithm Library

All 11 quantitative algorithm modules in `app/algorithms/` are now **imported and called by the live expert agents**. There are no longer any orphaned algorithm implementations.

| Module | Used By |
|---|---|
| `algorithms/risk/garch.py` (`GARCHModel`, `EGARCHModel`) | `RiskAnalysisAgent` |
| `algorithms/risk/monte_carlo.py` (`simulate_gbm_paths`, `value_at_risk`, `cvar`, `annualised_return_distribution`) | `RiskAnalysisAgent` |
| `algorithms/pricing/black_scholes.py` (`bsm_price`, `bsm_greeks`) | `DerivativesPricingAgent` |
| `algorithms/pricing/binomial_tree.py` (`binomial_price`) | `DerivativesPricingAgent` |
| `algorithms/portfolio/mean_variance.py` (`max_sharpe_weights`) | `PortfolioAgent` |
| `algorithms/portfolio/black_litterman.py` (`black_litterman_weights`) | `PortfolioAgent` |
| `algorithms/alpha/kalman_filter.py` (`KalmanHedgeFilter`) | `AlphaSignalAgent` |
| `algorithms/alpha/pairs_trading.py` (`cointegration_test`, `spread_zscore`) | `AlphaSignalAgent` |
| `algorithms/fixed_income/duration_convexity.py` (`modified_duration`, `dv01`, `convexity`, `price_from_yield`, `make_bond_cashflows`) | `FixedIncomeAgent` |
| `algorithms/fixed_income/short_rate_models.py` (`VasicekModel`) | `FixedIncomeAgent` |
| `algorithms/microstructure/hmm.py` (`RegimeHMM`) | `MicrostructureAgent` |
| `algorithms/microstructure/vwap_twap.py` (`vwap`, `execution_schedule`) | `MicrostructureAgent` |

---

## ✅ Fully Wired — Agents

All agents in the pipeline are implemented and actively used:

| Agent | Status |
|---|---|
| `ManagerAgent` | ✅ Wired — orchestrates `/api/run` and `/api/backtest` |
| `TraderStrategyAgent` | ✅ Wired — invoked by `ManagerAgent.run()` |
| `RiskAnalysisAgent` | ✅ Wired — selected via `EXPERT_MAP` |
| `AlphaSignalAgent` | ✅ Wired |
| `PortfolioAgent` | ✅ Wired |
| `DerivativesPricingAgent` | ✅ Wired |
| `FixedIncomeAgent` | ✅ Wired |
| `MicrostructureAgent` | ✅ Wired |
| `VerifierAgent` | ✅ Wired |
| `ComparatorAgent` | ✅ Wired |
| `AutomatorAgent` | ✅ Wired — exposed via `/api/automate/{run_id}` |

---

## ⚠️ Endpoints Not Yet Bound to the Frontend

These REST endpoints exist and work but are not called by the current React UI:

| Endpoint | File | Notes |
|---|---|---|
| `POST /api/backtest` | `api/backtest.py` | Semantically identical to `/api/run` — future cleanup candidate |
| `POST /api/parse` | `api/strategy.py` | Debug endpoint: returns `StrategySpec` without running |
| `GET /api/tearsheets` | `api/tearsheet.py` | Returns all run summaries (no History page in UI yet) |
| `POST /api/automate/strategy` | `api/automator.py` | Deploy from raw `StrategySpec` — bypasses `/run` |

---

## ⚠️ Tearsheet Utilities — Partially Used

| Module | Status |
|---|---|
| `tearsheet/builder.py` | Not imported at runtime — `ComparatorAgent` builds tearsheets directly |
| `tearsheet/serialiser.py` | Used by `scripts/run_example.py` only — not by HTTP endpoints |

**Suggested improvement**: Have `ComparatorAgent` delegate to `build_tearsheet()` and use `summary_dict()` in the `/api/tearsheets` list endpoint for a canonical response format.

---

## ⚠️ Data Layer — Not Surfaced in UI

The data layer is fully implemented but invisible to the frontend user:

- Users cannot select which data provider is in use (Yahoo vs Alpaca vs CSV)
- There is no UI to inspect or refresh cached symbols
- Alpaca live trading is only reachable via `/api/automate` — no broker status panel exists

**Suggested improvement**: Add a small "Data Source" indicator in the UI showing the active provider and last cache time.

---

## ⚠️ Agent Metrics — Not Fully Surfaced in UI

Each `AgentResult` contains a rich `metrics` dict (now fully populated by the algorithm library), but the frontend only displays the top-level Sharpe/CAGR/drawdown from the Comparator. Agent-specific metrics are in the tearsheet payload but not yet rendered:

| Agent | Available metrics (not yet shown in UI) |
|---|---|
| Risk | `egarch_vol`, `var_95`, `cvar_95`, `return_dist_p5/p50/p95` |
| Derivatives | `entry_delta`, `entry_gamma`, `entry_theta`, `entry_vega`, `entry_rho`, `am_put_binomial` |
| Portfolio | `mvo_w_{ticker}`, `bl_w_{ticker}` per asset |
| Alpha | `cointegration_pvalue`, `cointegrated`, `spread_std` |
| Fixed Income | `dv01`, `convexity`, `yield_curve_1y/5y/10y` |
| Microstructure | `bull/bear_mean_return_ann`, `bull/bear_volatility_ann` |

**Suggested improvement**: Add collapsible "Expert Detail" panels in the tearsheet UI to show these values.
