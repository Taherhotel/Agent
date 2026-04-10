import { useIRISStore } from '../store/irisStore'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  message: string
}

class ChatService {
  /**
   * Send messages to the backend /api/chat endpoint.
   * Backend proxies to Groq and falls back to static responses.
   * If the backend call fails AND we have a VITE_GROQ_API_KEY,
   * we call Groq directly from the browser as a last resort.
   */
  async sendMessage(messages: ChatMessage[], strategyContext?: any): Promise<ChatResponse> {
    // ── Primary: backend /api/chat proxy ─────────────────────────────────────
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          strategy_context: strategyContext,
        }),
      })

      if (response.ok) {
        return response.json()
      }
      console.warn(`[Chat] Backend returned ${response.status}, trying fallback`)
    } catch (err) {
      console.warn('[Chat] Backend call failed:', err)
    }

    // ── Fallback: direct Groq call from browser ──────────────────────────────
    const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
    if (groqKey) {
      try {
        return await this._callGroqDirectly(messages, strategyContext, groqKey)
      } catch (err) {
        console.warn('[Chat] Groq direct call failed:', err)
      }
    }

    // ── Last resort: THROW so caller uses local contextual response ───────────
    throw new Error('All chat providers unavailable')
  }

  private async _callGroqDirectly(
    messages: ChatMessage[],
    context: any,
    apiKey: string
  ): Promise<ChatResponse> {
    const systemPrompt = this._buildSystemPrompt(context)

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10),
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    })

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`)
    const data = await response.json()
    return { message: data.choices[0].message.content.trim() }
  }

  private _buildSystemPrompt(context: any): string {
    const parts = [
      'You are IRIS AI, an expert quantitative trading assistant embedded in the IRIS backtesting platform.',
      'You help users understand their trading strategies, interpret performance metrics, and suggest improvements.',
      'Be concise, precise, and use financial terminology appropriately.',
      'Keep responses under 300 words.',
    ]

    if (context?.prompt)       parts.push(`Current strategy: "${context.prompt}"`)
    if (context?.asset)        parts.push(`Asset: ${context.asset}, Period: ${context.start_date} to ${context.end_date}`)
    if (context?.capital)      parts.push(`Initial capital: $${context.capital.toLocaleString()}`)
    if (context?.expert_type)  parts.push(`Expert agent: ${context.expert_type}`)
    if (context?.trader_sharpe !== undefined) {
      parts.push(
        `Backtest results — Sharpe: ${Number(context.trader_sharpe).toFixed(2)}, ` +
        `CAGR: ${(Number(context.trader_cagr) * 100).toFixed(1)}%, ` +
        `Max DD: ${(Number(context.trader_max_dd) * 100).toFixed(1)}%`
      )
    }
    if (context?.narrative) parts.push(`IRIS narrative: ${context.narrative}`)

    return parts.join('\n')
  }

  // ── Context helpers ──────────────────────────────────────────────────────

  getStrategyContext() {
    const store = useIRISStore.getState()
    const ts = store.tearsheet

    return {
      prompt:        store.prompt,
      asset:         store.asset,
      start_date:    store.startDate,
      end_date:      store.endDate,
      capital:       store.capital,
      commission_bps: store.commissionBps,
      slippage_bps:  store.slippageBps,
      max_position_pct: store.maxPositionPct,
      expert_type:   store.expertType,
      app_phase:     store.appPhase,
      trader_sharpe: ts?.trader_metrics?.sharpe,
      trader_cagr:   ts?.trader_metrics?.cagr,
      trader_max_dd: ts?.trader_metrics?.max_drawdown,
      expert_type_result: ts?.expert_type,
      narrative:     ts?.narrative,
    }
  }

  // ── Fallback when no LLM is reachable ───────────────────────────────────

  generateContextualResponse(userInput: string, context: any): string {
    const input = userInput.toLowerCase()

    if (context.trader_sharpe !== undefined && context.trader_cagr !== undefined) {
      if (input.includes('performance') || input.includes('result') || input.includes('how')) {
        const sharpe = Number(context.trader_sharpe).toFixed(2)
        const cagr   = (Number(context.trader_cagr) * 100).toFixed(1)
        const dd     = (Number(context.trader_max_dd) * 100).toFixed(1)
        return (
          `Backtest results for **${context.asset}**:\n` +
          `• Sharpe Ratio: ${sharpe}\n• CAGR: ${cagr}%\n• Max Drawdown: ${dd}%\n\n` +
          `${context.narrative ? `IRIS says: "${context.narrative}"` : 'Would you like help interpreting these metrics?'}`
        )
      }
    }

    if (input.includes('strategy') && context.prompt) {
      return `Your strategy for **${context.asset || 'the asset'}** runs from ${context.start_date || 'start'} to ${context.end_date || 'end'} with $${(context.capital || 0).toLocaleString()} initial capital.\n\nWould you like to optimize parameters or explain the results?`
    }
    if (input.includes('risk') || input.includes('drawdown')) {
      return 'Risk management is critical. Key metrics: **Max Drawdown** (worst peak-to-trough), **Sharpe Ratio** (risk-adjusted return), **Calmar** (CAGR ÷ Max DD). Sharpe >1.0 is good, >2.0 is excellent.'
    }
    if (input.includes('sharpe')) {
      return 'The **Sharpe Ratio** = (return − risk-free rate) ÷ volatility. >1.0 is good, >2.0 is excellent.'
    }
    if (input.includes('cagr')) {
      return '**CAGR** is the annualized compound growth rate of your portfolio over the backtested period.'
    }
    if (input.includes('optimize') || input.includes('improve')) {
      return 'Optimization tips:\n• Adjust indicator periods\n• Tighten stop-loss levels\n• Try different expert agents\n• Test on different assets or time periods'
    }
    if (input.includes('automate') || input.includes('deploy')) {
      return 'The **Automate** button deploys your strategy to paper trading mode via Angel One SmartAPI.'
    }
    if (input.includes('angel') || input.includes('smartapi') || input.includes('nse')) {
      return 'IRIS uses **Angel One SmartAPI** as the primary data provider for NSE/BSE stocks. Set your credentials in the `.env` file to enable real-time quotes and historical candle data.'
    }
    if (input.includes('help')) {
      return `I can help with:\n• **Strategy analysis** — what your rules are doing\n• **Performance metrics** — Sharpe, CAGR, drawdown, win rate\n• **Risk assessment** — position sizing, stop-losses\n• **Optimization** — parameter tuning suggestions\n• **Angel One SmartAPI** — symbol/token system, authentication\n\nWhat would you like to explore?`
    }

    return `I'm IRIS AI. ${context.app_phase === 'complete' ? 'Your backtest is complete — ask me about the results, metrics, or how to improve your strategy.' : 'Run a backtest and I can help analyze the results. Try asking about risk, performance, or optimization.'}`
  }
}

export const chatService = new ChatService()
