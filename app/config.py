from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "gpt-3.5-turbo"

    # Groq (used by chat proxy and narrative LLM)
    groq_api_key: str = ""

    # Angel One SmartAPI credentials
    angelone_api_key: str = ""
    angelone_client_id: str = ""
    angelone_password: str = ""
    angelone_totp_secret: str = ""         # base32 secret from authenticator app

    # Data Providers (legacy Alpaca support kept for compatibility)
    alpaca_api_key: Optional[str] = None
    alpaca_secret_key: Optional[str] = None

    # Backtest Defaults
    backtest_default_capital: float = 100000.0
    backtest_commission_pct: float = 0.001
    backtest_slippage_pct: float = 0.0005
    backtest_default_asset: str = "RELIANCE"   # default to Indian market

    # Server configuration
    port: int = 8000
    log_level: str = "INFO"
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]

    # Database
    db_url: str = "sqlite:///./iris.db"

    # Auth
    jwt_secret: str = "dev-change-me"
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 60 * 24

    # Default admin seed
    admin_email: str = "admin@iris.local"
    admin_password: str = "ChangeMe123!"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
