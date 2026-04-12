# IRIS — Running Locally

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- Git

---

## 1. Clone the repo

```bash
git clone <your-repo-url> iris
cd iris
```

---

## 2. Backend setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/Scripts/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file in the repo root (minimal working config):

```env
JWT_SECRET=changeme
OPENROUTER_API_KEY=<your-key>
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct:free
admin_email=admin@iris.local
admin_password=ChangeMe123!
```

> See `.env.example` for all available options.

---

## 3. Pre-cache market data (optional but recommended)

Avoids yfinance rate-limit issues during the demo:

```bash
python scripts/seed_cache.py
```

This downloads AAPL, SPY, and TLT OHLCV parquet files to `app/data/cache/`.

---

## 4. Start the backend

```bash
uvicorn app.main:app --reload --port 8000
```

Verify: `http://localhost:8000/health` should return `{"status": "ok", "version": "0.2.0"}`.

---

## 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown (usually `http://localhost:5173`). Hard-refresh (`Ctrl+Shift+R`) if styles look stale.

---

## 6. Log in

Use the seeded admin credentials:
- **Email**: `admin@iris.local`
- **Password**: `ChangeMe123!`

---

## 7. Run a sample strategy

Paste this into the Strategy Input box and click **RUN IRIS**:

```
Trade AAPL daily from 2019-01-01 to 2024-12-31.
Go long when the 20-day SMA crosses above the 50-day SMA and RSI(14) is below 60.
Exit when price closes below the 20-day SMA or RSI(14) exceeds 70.
Risk no more than 2% of capital per trade; cap position at 50% of equity.
Use 10 bps commission and 5 bps slippage.
```

The equity curve and tearsheet metrics should render within a few seconds.

---

## 8. Running tests

```bash
pytest tests/ -v
```

All 93 tests should pass.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Charts are empty | Hard-refresh (`Ctrl+Shift+R`). Check backend logs for yfinance errors. |
| Auth fails | Verify backend is on port 8000 and `VITE_API_BASE=http://localhost:8000` in `frontend/.env`. |
| Data fetch errors | Run `python scripts/seed_cache.py` to pre-download data. |
| Port already in use | Change `--port 8001` and update `VITE_API_BASE` in `frontend/.env`. |

---

## Docker (optional)

```bash
docker compose up --build
```

This starts both backend (port 8000) and frontend (port 5173) together.
