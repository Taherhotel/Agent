"""
Derivatives & Pricing Expert Agent.
Algorithms: Black-Scholes-Merton (BSM) + CRR Binomial Tree.
Simulates a delta-hedged options strategy on the asset.
Delegates all pricing math to app.algorithms.pricing.black_scholes and .binomial_tree.
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
from app.algorithms.pricing.black_scholes import bsm_price, bsm_greeks
from app.algorithms.pricing.binomial_tree import binomial_price

log = get_logger(__name__)


class DerivativesPricingAgent(BaseExpertAgent):
    name = "Derivatives"

    def run(self, spec: StrategySpec) -> AgentResult:
        t0 = time.time()
        log.info(f"[{self.name}] Running BSM + Binomial Tree delta-hedged simulation")
        try:
            df = load_ohlcv(spec.asset, spec.start_date, spec.end_date)
            close = df["Close"].values
            dates = [str(d.date()) for d in df.index]
            n = len(close)
            returns = np.diff(close) / close[:-1]
            sigma_ann = float(np.std(returns, ddof=1)) * np.sqrt(252)
            r = 0.04  # risk-free rate

            capital = spec.initial_capital
            equity = [capital]
            trade_log = []

            # Monthly options cycle: buy ATM call, delta-hedge, roll at expiry
            expiry_days = 21  # ~1 month
            S0 = close[0]
            K = S0  # ATM strike at inception

            # ── Compute entry Greeks via BSM library ─────────────────────────
            T_init = expiry_days / 252
            entry_greeks = bsm_greeks(S0, K, T_init, r, sigma_ann, "call")

            for i in range(1, n):
                S = close[i]
                T_remaining = max((expiry_days - (i % expiry_days)) / 252, 1 / 252)

                # ── BSM pricing & delta via algorithm library ────────────────
                option_val  = bsm_price(S, K, T_remaining, r, sigma_ann, "call")
                greeks      = bsm_greeks(S, K, T_remaining, r, sigma_ann, "call")
                delta       = greeks["delta"]

                prev_S  = close[i - 1]
                prev_T  = max((expiry_days - ((i - 1) % expiry_days)) / 252, 1 / 252)
                prev_option_val = bsm_price(prev_S, K, prev_T, r, sigma_ann, "call")

                # Net delta-hedged P&L per $1 notional
                option_pnl  = (option_val - prev_option_val) - delta * (S - prev_S)
                scaled_pnl  = option_pnl / S0 * equity[-1]

                new_equity  = equity[-1] + scaled_pnl
                equity.append(round(max(new_equity, equity[-1] * 0.5), 2))  # -50% floor

                # Roll at expiry
                if i % expiry_days == 0:
                    K = S  # new ATM strike
                    trade_log.append({
                        "date": dates[i], "side": "ROLL",
                        "price": round(S, 2), "quantity": 1, "pnl_pct": None,
                    })

            # ── Binomial Tree: price an ATM American put at expiry horizon ───
            try:
                am_put_price = binomial_price(
                    S=close[-1], K=close[-1], T=expiry_days / 252,
                    r=r, sigma=sigma_ann,
                    option_type="put", exercise="american", n_steps=100,
                )
            except Exception:
                am_put_price = None

            return AgentResult(
                agent_name=self.name,
                equity_curve=equity,
                dates=dates,
                trade_log=trade_log,
                metrics={
                    "implied_vol_used":     round(sigma_ann, 4),
                    "option_type":          "ATM_call_delta_hedged",
                    # Full BSM Greeks at entry
                    "entry_delta":          entry_greeks["delta"],
                    "entry_gamma":          entry_greeks["gamma"],
                    "entry_theta":          entry_greeks["theta"],
                    "entry_vega":           entry_greeks["vega"],
                    "entry_rho":            entry_greeks["rho"],
                    # Binomial American put as cross-check
                    "am_put_binomial":      round(am_put_price, 4) if am_put_price else None,
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
