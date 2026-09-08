"""
POST /api/chat — Groq LLM proxy for the IRIS ChatBot.

Accepts a list of messages + optional strategy context.
Proxies to Groq using the GROQ_API_KEY from server env.
Falls back to a static helpful response if Groq is not configured.
"""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
from app.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    strategy_context: Optional[dict] = None


class ChatResponse(BaseModel):
    message: str


def _build_system_prompt(ctx: Optional[dict]) -> str:
    parts = [
        "You are IRIS AI, an expert quantitative trading assistant embedded in the IRIS backtesting platform.",
        "You help users understand their trading strategies, interpret performance metrics, and suggest improvements.",
        "Be concise, precise, and use financial terminology appropriately.",
        "Keep responses under 300 words.",
    ]
    if ctx:
        if ctx.get("prompt"):
            parts.append(f'Current strategy: "{ctx["prompt"]}"')
        if ctx.get("asset"):
            parts.append(f'Asset: {ctx["asset"]}, Period: {ctx.get("start_date")} to {ctx.get("end_date")}')
        if ctx.get("capital"):
            parts.append(f'Initial capital: ${ctx["capital"]:,}')
        if ctx.get("expert_type"):
            parts.append(f'Expert agent: {ctx["expert_type"]}')
        if ctx.get("trader_sharpe") is not None:
            parts.append(
                f'Backtest results — Sharpe: {ctx["trader_sharpe"]:.2f}, '
                f'CAGR: {ctx.get("trader_cagr", 0)*100:.1f}%, '
                f'Max DD: {ctx.get("trader_max_dd", 0)*100:.1f}%'
            )
        if ctx.get("narrative"):
            parts.append(f'IRIS narrative: {ctx["narrative"]}')
    return "\n".join(parts)


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Proxy chat messages to Groq LLM."""

    groq_key = os.getenv("GROQ_API_KEY", "")

    if not groq_key:
        # Graceful no-LLM fallback
        return ChatResponse(message=_static_fallback(req.messages, req.strategy_context))

    system = _build_system_prompt(req.strategy_context)

    model_name = os.getenv("GROQ_MODEL", "mixtral-8x7b-32768")
    
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system},
            *[{"role": m.role, "content": m.content} for m in req.messages[-10:]],
        ],
        "max_tokens": 400,
        "temperature": 0.5,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                _GROQ_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            return ChatResponse(message=text)

    except httpx.HTTPStatusError as e:
        log.warning(f"[Chat] Groq HTTP error {e.response.status_code}: {e.response.text}")
        return ChatResponse(message=_static_fallback(req.messages, req.strategy_context))
    except Exception as e:
        log.warning(f"[Chat] Groq call failed: {e}")
        return ChatResponse(message=_static_fallback(req.messages, req.strategy_context))


def _static_fallback(messages: List[ChatMessage], ctx: Optional[dict]) -> str:
    """Rule-based response when Groq is unavailable."""
    last = messages[-1].content.lower() if messages else ""

    if ctx and ctx.get("trader_sharpe") is not None:
        if any(w in last for w in ["performance", "result", "how", "metric"]):
            sharpe = ctx.get("trader_sharpe", 0)
            cagr   = ctx.get("trader_cagr", 0) * 100
            dd     = ctx.get("trader_max_dd", 0) * 100
            asset  = ctx.get("asset", "the asset")
            return (
                f"Backtest results for **{asset}**:\n"
                f"• Sharpe Ratio: {sharpe:.2f}\n"
                f"• CAGR: {cagr:.1f}%\n"
                f"• Max Drawdown: {dd:.1f}%\n\n"
                f"{ctx.get('narrative', 'Would you like help interpreting these metrics?')}"
            )

    if any(w in last for w in ["sharpe", "sortino"]):
        return "**Sharpe Ratio** = (return − risk-free rate) ÷ volatility. Values >1.0 are good, >2.0 are excellent."
    if "drawdown" in last or "risk" in last:
        return "**Max Drawdown** is the worst peak-to-trough loss. Lower is better. Pair it with Sharpe for full risk picture."
    if "cagr" in last:
        return "**CAGR** is the annualized compound growth rate of the portfolio over the backtest period."
    if "help" in last:
        return "I can help with strategy analysis, performance metrics (Sharpe, CAGR, drawdown), risk assessment, and optimization tips."

    return (
        "I'm IRIS AI. Run a backtest and ask me about results, risk, or how to improve your strategy. "
        "Set GROQ_API_KEY in your .env for full AI-powered responses."
    )
