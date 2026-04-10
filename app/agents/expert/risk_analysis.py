"""
Risk Analysis Expert Agent.
Algorithms: Monte Carlo GBM paths + GARCH(1,1) / EGARCH volatility estimation.
Flow: fit GARCH on historical returns → vol-scale positions → MC median as equity curve.
Delegates all math to app.algorithms.risk.garch and app.algorithms.risk.monte_carlo.
"""
from __future__ import annotations
import time
import numpy as np
from app.agents.expert.base import BaseExpertAgent
from app.nlp.schema import StrategySpec, AgentResult
from app.data.loader import load_ohlcv
from app.utils.logger import get_logger

# ── Algorithm library imports ────────────────────────────────────────────────
from app.algorithms.risk.garch import GARCHModel, EGARCHModel
from app.algorithms.risk.monte_carlo import (
    simulate_gbm_paths,
    value_at_risk,
    cvar,
    annualised_return_distribution,
)

log = get_logger(__name__)


class RiskAnalysisAgent(BaseExpertAgent):
    name = "Risk Analysis"

    def run(self, spec: StrategySpec) -> AgentResult:
        t0 = time.time()
        log.info(f"[{self.name}] Running Monte Carlo + GARCH")
        try:
            df = load_ohlcv(spec.asset, spec.start_date, spec.end_date)
            close = df["Close"].values
            returns = np.diff(close) / close[:-1]
            returns = returns[np.isfinite(returns)]

            # ── GARCH(1,1) volatility forecast ──────────────────────────────
            garch = GARCHModel().fit(returns)
            sigma = garch.forecast_annualised_vol(horizon=1)
            mu = float(np.mean(returns)) * 252

            # ── EGARCH for leverage-adjusted vol as secondary metric ─────────
            egarch = EGARCHModel().fit(returns)
            egarch_vol = egarch.forecast_annualised_vol()

            # ── Monte Carlo GBM paths ────────────────────────────────────────
            n_days = len(close)
            n_paths = 200  # use 1000+ in production

            paths = simulate_gbm_paths(
                S0=float(close[0]),
                mu=mu,
                sigma=sigma,
                n_days=n_days,
                n_paths=n_paths,
            )

            median_path = np.median(paths, axis=0)
            equity_curve = [
                round(float(spec.initial_capital * (v / median_path[0])), 2)
                for v in median_path[:n_days]
            ]
            dates = [str(d.date()) for d in df.index[:n_days]]

            # Sample paths for UI visualisation (up to 50 paths)
            stride = max(1, n_paths // 50)
            sampled_paths = paths[::stride, :n_days].tolist()

            # ── Risk measures via algorithm library ──────────────────────────
            var_95 = value_at_risk(paths, confidence=0.95)
            cvar_95 = cvar(paths, confidence=0.95)
            years = n_days / 252
            ret_dist = annualised_return_distribution(paths, years=max(years, 0.01))

            return AgentResult(
                agent_name=self.name,
                equity_curve=equity_curve,
                dates=dates,
                trade_log=[],
                paths=sampled_paths,
                metrics={
                    "garch_vol":        round(sigma, 4),
                    "egarch_vol":       round(egarch_vol, 4),
                    "mu_annual":        round(mu, 4),
                    "var_95":           round(var_95, 2),
                    "cvar_95":          round(cvar_95, 2),
                    "return_dist_p5":   round(ret_dist["p5"], 4),
                    "return_dist_p50":  round(ret_dist["p50"], 4),
                    "return_dist_p95":  round(ret_dist["p95"], 4),
                    "return_dist_mean": round(ret_dist["mean"], 4),
                },
                elapsed_seconds=round(time.time() - t0, 2),
            )
        except Exception as e:
            log.error(f"[{self.name}] Error: {e}", exc_info=True)
            return AgentResult(
                agent_name=self.name,
                error=str(e),
                elapsed_seconds=round(time.time() - t0, 2),
            )
