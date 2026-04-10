"""
Portfolio Construction Expert Agent.
Algorithms: Mean-Variance Optimisation (SLSQP) + Black-Litterman.
Flow: fetch correlated assets → covariance matrix → BL posterior → max-Sharpe weights → simulate.
Delegates all math to app.algorithms.portfolio.mean_variance and .black_litterman.
"""
from __future__ import annotations
import time
import numpy as np
import pandas as pd
from app.agents.expert.base import BaseExpertAgent
from app.nlp.schema import StrategySpec, AgentResult
from app.data.loader import load_ohlcv
from app.utils.logger import get_logger

# ── Algorithm library imports ────────────────────────────────────────────────
from app.algorithms.portfolio.mean_variance import max_sharpe_weights
from app.algorithms.portfolio.black_litterman import black_litterman_weights

log = get_logger(__name__)

# Diversified basket of assets to build portfolio
BASKET = ["SPY", "QQQ", "GLD", "TLT", "IEF"]


class PortfolioAgent(BaseExpertAgent):
    name = "Portfolio Const."

    def run(self, spec: StrategySpec) -> AgentResult:
        t0 = time.time()
        log.info(f"[{self.name}] Running Mean-Variance + Black-Litterman Optimisation")
        try:
            dfs = {}
            for ticker in BASKET:
                try:
                    df = load_ohlcv(ticker, spec.start_date, spec.end_date)
                    dfs[ticker] = df["Close"]
                except Exception:
                    pass

            if len(dfs) < 2:
                raise ValueError("Could not load enough assets for portfolio")

            prices = pd.DataFrame(dfs).dropna()
            returns = prices.pct_change().dropna().values
            tickers = list(dfs.keys())
            n = returns.shape[1]

            # Annualised inputs for the algorithm library
            mean_returns_ann = np.mean(returns, axis=0) * 252
            cov_matrix_ann = np.cov(returns.T) * 252

            # ── MVO max-Sharpe weights (SLSQP optimiser) ────────────────────
            mvo_weights = max_sharpe_weights(
                mean_returns=mean_returns_ann,
                cov_matrix=cov_matrix_ann,
                rf=0.04,
            )

            # ── Black-Litterman weights ──────────────────────────────────────
            # Use equal market-cap weights as prior (no external views)
            mkt_weights = np.ones(n) / n
            try:
                bl_weights = black_litterman_weights(
                    cov_matrix=cov_matrix_ann,
                    weights_mkt=mkt_weights,
                    rf=0.04,
                )
            except Exception:
                bl_weights = mvo_weights  # fallback to MVO if BL fails

            # Use MVO weights for the equity simulation
            weights = mvo_weights

            # ── Simulate daily rebalanced portfolio ──────────────────────────
            capital = spec.initial_capital
            equity = [capital]
            dates = [str(d.date()) for d in prices.index[1:]]

            port_returns = returns @ weights
            for r in port_returns:
                capital = equity[-1] * (1 + r)
                equity.append(round(capital, 2))
            equity = equity[1:]  # align with dates

            # ── Build metrics dict ───────────────────────────────────────────
            metrics = {
                f"mvo_w_{t}": round(float(w), 4)
                for t, w in zip(tickers, mvo_weights)
            }
            metrics.update({
                f"bl_w_{t}": round(float(w), 4)
                for t, w in zip(tickers, bl_weights)
            })

            return AgentResult(
                agent_name=self.name,
                equity_curve=equity,
                dates=dates,
                trade_log=[],
                metrics=metrics,
                elapsed_seconds=round(time.time() - t0, 2),
            )
        except Exception as e:
            log.error(f"[{self.name}] Error: {e}", exc_info=True)
            return AgentResult(
                agent_name=self.name,
                error=str(e),
                elapsed_seconds=round(time.time() - t0, 2),
            )
