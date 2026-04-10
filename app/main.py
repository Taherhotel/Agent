from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.strategy import router as strategy_router
from app.api.backtest import router as backtest_router
from app.api.tearsheet import router as tearsheet_router
from app.api.automator import router as automator_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.market import router as market_router
from app.db import init_db


app = FastAPI(
    title="IRIS — Intelligent Reasoning & Inferential Simulator",
    description="Agentic AI Backtesting Tool",
    version="0.2.0",
)


# ── CORS ───────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ─────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    """Initialize database tables on server startup."""
    init_db()


# ── API Routes ──────────────────────────────────────────────────────────
app.include_router(auth_router)                                   # /auth/login, /auth/me
app.include_router(strategy_router, prefix="/api", tags=["Strategy"])
app.include_router(backtest_router, prefix="/api", tags=["Backtest"])
app.include_router(tearsheet_router, prefix="/api", tags=["Tearsheet"])
app.include_router(automator_router, prefix="/api", tags=["Automator"])
app.include_router(chat_router,      prefix="/api", tags=["Chat"])
app.include_router(market_router,    prefix="/api", tags=["Market"])


# ── Health Check ────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "version": "0.2.0"
    }


# ── Local Development Run ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True
    )