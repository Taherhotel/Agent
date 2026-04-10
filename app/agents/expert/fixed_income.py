"""
Fixed Income & Rates Expert Agent.
Algorithms: Duration/Convexity + Vasicek short-rate model.
Simulates a bond portfolio valued along a simulated rate path.
Delegates all math to app.algorithms.fixed_income.short_rate_models and .duration_convexity.
"""
from __future__ import annotations
import time
import numpy as np
from app.agents.expert.base import BaseExpertAgent
from app.nlp.schema import StrategySpec, AgentResult
from app.data.loader import load_ohlcv
from app.utils.logger import get_logger

# ── Algorithm library imports ────────────────────────────────────────────────
from app.algorithms.fixed_income.short_rate_models import VasicekModel
from app.algorithms.fixed_income.duration_convexity import (
    make_bond_cashflows,
    price_from_yield,
    modified_duration,
    dv01,
    convexity,
)

log = get_logger(__name__)


class FixedIncomeAgent(BaseExpertAgent):
    name = "Fixed Income"

    def run(self, spec: StrategySpec) -> AgentResult:
        t0 = time.time()
        log.info(f"[{self.name}] Running Vasicek + Duration/Convexity Bond Analytics")
        try:
            df = load_ohlcv("TLT", spec.start_date, spec.end_date)  # Bond ETF proxy
            close = df["Close"].values
            dates = [str(d.date()) for d in df.index]
            n = len(close)

            # Vasicek parameters (calibrated to typical values)
            r0      = 0.04   # initial short rate
            kappa   = 0.30   # mean-reversion speed
            theta   = 0.04   # long-run mean rate
            sigma_r = 0.01   # rate volatility

            # ── Vasicek rate simulation via algorithm library ─────────────────
            vasicek = VasicekModel(kappa=kappa, theta=theta, sigma=sigma_r, r0=r0)
            # Simulate 1 path (n_paths=1) across n steps
            rate_paths = vasicek.simulate(T=n / 252, n_steps=n - 1, n_paths=1, seed=42)
            rates = rate_paths[0]  # shape: (n,)

            # ── Build bond cash flows via algorithm library ───────────────────
            cashflows, times = make_bond_cashflows(
                par=1000.0, coupon_rate=0.04, maturity_years=10, freq=2
            )

            # ── Bond portfolio equity curve (Vasicek rates → bond prices) ────
            def bond_price_at_rate(ytm: float) -> float:
                return price_from_yield(cashflows, times, ytm)

            capital = spec.initial_capital
            equity = [capital]

            for i in range(1, n):
                bp_t   = bond_price_at_rate(rates[i])
                bp_tm1 = bond_price_at_rate(rates[i - 1])
                ret_bond = (bp_t - bp_tm1) / max(bp_tm1, 1e-6)

                # Blend with TLT ETF return for realism
                tlt_ret = (close[i] - close[i - 1]) / max(close[i - 1], 1e-6)
                blended = 0.6 * ret_bond + 0.4 * tlt_ret
                equity.append(round(equity[-1] * (1 + blended), 2))

            # ── Risk analytics via algorithm library ─────────────────────────
            final_ytm   = float(rates[-1])
            mod_dur     = modified_duration(cashflows, times, final_ytm)
            dv01_val    = dv01(cashflows, times, final_ytm)
            conv        = convexity(cashflows, times, final_ytm)

            # Vasicek yield curve at 5 maturities
            maturities  = np.array([1.0, 2.0, 5.0, 10.0, 30.0])
            yield_curve = vasicek.yield_curve(r0, maturities).tolist()

            return AgentResult(
                agent_name=self.name,
                equity_curve=equity,
                dates=dates,
                trade_log=[],
                metrics={
                    "modified_duration": round(mod_dur, 4),
                    "dv01":              round(dv01_val, 6),
                    "convexity":         round(conv, 4),
                    "final_rate":        round(final_ytm, 4),
                    "vasicek_kappa":     kappa,
                    "vasicek_theta":     theta,
                    "yield_curve_1y":    round(yield_curve[0], 4),
                    "yield_curve_5y":    round(yield_curve[2], 4),
                    "yield_curve_10y":   round(yield_curve[3], 4),
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
