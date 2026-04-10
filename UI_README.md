# IRIS — UI Design Reference

> This document describes the design system and component layout for the IRIS frontend.
> For the full component tree and file structure, see `frontend/README.md`.

---

## Design Language

**Aesthetic**: Dark, terminal-inspired financial interface. Bloomberg meets modern AI.
**Theme**: Deep navy/charcoal backgrounds, electric teal accents, monospace data readouts.
**Principle**: Data-dense but never cluttered. Every element earns its place.

---

## Color System

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#080C14` | Page background |
| `--bg-surface` | `#0F1621` | Cards, panels |
| `--bg-elevated` | `#1A2235` | Inputs, hover states |
| `--accent-teal` | `#00D4AA` | Primary CTA, active states, highlights |
| `--accent-amber` | `#F5A623` | Warnings, drawdown indicators |
| `--accent-red` | `#FF4D6A` | Losses, errors, negative P&L |
| `--accent-green` | `#22D47E` | Gains, positive metrics |
| `--text-primary` | `#E8EDF5` | Headings, primary content |
| `--text-secondary` | `#6B7A99` | Labels, secondary text |
| `--border` | `#1E2D45` | Card borders, dividers |

---

## Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| Display / Logo | `DM Mono` | 28px | 500 |
| Section Headings | `DM Mono` | 16px | 500 |
| Body / Labels | `IBM Plex Sans` | 14px | 400 |
| Data Readouts | `DM Mono` | 13–22px | 400–500 |

---

## Frontend Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Charts | Recharts |
| State | Zustand |
| API | Axios |
| Animations | Framer Motion |
| Icons | Lucide React |
| Fonts | DM Mono, IBM Plex Sans (Google Fonts) |

---

## Application Layout

```
┌────────────────────────────────────────────────────────────────┐
│  NAVBAR                                                        │
│  [ IRIS ]    Strategy Lab    History    Settings      [● Live] │
└────────────────────────────────────────────────────────────────┘
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  STRATEGY INPUT PANEL                                    │  │
│  │  > Describe your trading strategy in plain English...    │  │
│  │  [Asset: AAPL ▼]  [From: 2020-01-01]  [To: 2024-12-31]  │  │
│  │  [Capital: $100,000]   [Commission: 0.1%]                │  │
│  │                                        [ RUN IRIS ▶ ]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AGENT PIPELINE STATUS                                   │  │
│  │  [●] Manager        parsing strategy...      ✓ done      │  │
│  │  [●] Trader Agent   running simulation...    ◌ running   │  │
│  │  [○] Expert Agent   (Risk Analysis)          ── waiting  │  │
│  │  [○] Verifier       ──                       ── waiting  │  │
│  │  [○] Comparator     ──                       ── waiting  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │  EQUITY CURVE            │  │  PERFORMANCE METRICS       │  │
│  │  $180k ──╮               │  │  Sharpe Ratio   1.84       │  │
│  │  $140k    ╰──╮           │  │  Max Drawdown  -12.3%      │  │
│  │  $100k ──────────────    │  │  Win Rate       61.4%      │  │
│  │  [Trader] [Expert] [SPY] │  │  CAGR           18.2%      │  │
│  └──────────────────────────┘  └────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TRADER vs EXPERT COMPARISON                             │  │
│  │           Your Strategy   Expert (Risk)   Benchmark      │  │
│  │  Return   +18.2%          +22.7%          +11.4%         │  │
│  │  Sharpe   1.84            2.21            0.92           │  │
│  │  Drawdown -12.3%          -8.1%           -18.7%         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  IRIS SAYS                                               │  │
│  │  "Your MA crossover returned 18.2% annually (Sharpe      │  │
│  │   1.84). The Risk Analysis expert outperformed by 4.5pp  │  │
│  │   using GARCH-adjusted sizing. Automate either?"         │  │
│  │          [ AUTOMATE MY STRATEGY ]  [ AUTOMATE EXPERT ]   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Screen Breakdown

### 1. Strategy Input Panel
- Dark textarea with blinking cursor, placeholder strategy examples
- Searchable asset ticker dropdown
- Date range pickers (from / to)
- Capital input + commission/slippage sliders
- **RUN IRIS** CTA button — teal, animated on click

### 2. Agent Pipeline Status
- Vertical list of agents with real-time status indicators
- Three states: `waiting` (hollow) → `running` (pulsing teal) → `done` (green ✓)
- Live text stream per agent showing current action

### 3. Equity Curve Chart
- Three overlapping series: **Trader** (teal), **Expert** (amber), **Benchmark SPY** (gray)
- Hover tooltip showing date + all three values + daily return
- Drawdown region shaded in translucent red
- Toggle buttons to show/hide each series

### 4. Performance Metrics Cards
- 5 KPI cards: Sharpe, Max Drawdown, Win Rate, CAGR, Sortino
- Colour-coded (green = good, red = bad)
- Delta badge vs Expert (e.g. `+0.37 vs Expert`)

### 5. Trader vs Expert Comparison Table
- Side-by-side: Your Strategy | Expert | SPY Benchmark
- Rows: Total Return, Sharpe, Sortino, Max Drawdown, Win Rate, Trade Count
- Winning column highlighted with teal left border

### 6. IRIS Says Panel
- Streamed LLM narrative in monospace font
- Two CTA buttons: **Automate My Strategy** / **Automate Expert**
- Click → confirmation modal → Automator Agent fires

---

## Responsive Layout

| Breakpoint | Layout |
|---|---|
| Desktop (≥1280px) | Two-column tearsheet: chart left, metrics right |
| Tablet (768–1279px) | Single column, full-width chart |
| Mobile (<768px) | Stacked, metrics collapse to 2×2 grid |

---

## Interaction States

| State | Behaviour |
|---|---|
| Idle | Input panel prominent, no tearsheet visible |
| Running | Pipeline animates, tearsheet skeleton loads |
| Complete | Tearsheet renders with staggered fade-in |
| Error | Inline error in affected agent row + retry button |
| Automating | Progress bar in AutomateModal, success flag from broker |
