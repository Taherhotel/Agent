import { useIRISStore } from '../store/irisStore'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  message: string
  context?: {
    strategy_info?: string
    performance_metrics?: any
    suggestions?: string[]
  }
}

class ChatService {
  /**
   * Attempt to send to the backend /api/chat endpoint (if it exists).
   * If the request fails or the endpoint returns a non-ok status, this
   * method THROWS so the caller (ChatBot.tsx) can fall back to the
   * richer generateContextualResponse() path.
   */
  async sendMessage(messages: ChatMessage[], strategyContext?: any): Promise<ChatResponse> {
    const groqKey = this.getGroqApiKey()

    // If we have a Groq key wired in VITE_GROQ_API_KEY, call Groq directly
    // from the front-end (browser) — this avoids needing a backend /chat route.
    if (groqKey) {
      return this._callGroqDirectly(messages, strategyContext, groqKey)
    }

    // Otherwise try the backend proxy endpoint
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        strategy_context: strategyContext,
      }),
    })

    if (!response.ok) {
      // Throw so ChatBot.tsx falls back to generateContextualResponse()
      throw new Error(`Chat API returned ${response.status}`)
    }

    return response.json()
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

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    return { message: data.choices[0].message.content.trim() }
  }

  private _buildSystemPrompt(context: any): string {
    const parts = [
      'You are IRIS AI, an expert quantitative trading assistant embedded in the IRIS backtesting platform.',
      'You help users understand their trading strategies, interpret performance metrics, and suggest improvements.',
      'Be concise, precise, and use financial terminology appropriately.',
    ]

    if (context?.prompt) {
      parts.push(`Current strategy: "${context.prompt}"`)
    }
    if (context?.asset) {
      parts.push(`Asset: ${context.asset}, Period: ${context.start_date} to ${context.end_date}`)
    }
    if (context?.capital) {
      parts.push(`Initial capital: $${context.capital.toLocaleString()}`)
    }
    if (context?.expert_type) {
      parts.push(`Expert agent: ${context.expert_type}`)
    }

    return parts.join('\n')
  }

  private getGroqApiKey(): string | null {
    return (import.meta.env.VITE_GROQ_API_KEY as string) || null
  }

  // ── Context helpers ──────────────────────────────────────────────────────

  getStrategyContext() {
    const store = useIRISStore.getState()
    const ts = store.tearsheet

    return {
      prompt: store.prompt,
      asset: store.asset,
      start_date: store.startDate,
      end_date: store.endDate,
      capital: store.capital,
      commission_bps: store.commissionBps,
      slippage_bps: store.slippageBps,
      max_position_pct: store.maxPositionPct,
      expert_type: store.expertType,
      app_phase: store.appPhase,
      // Include tearsheet metrics when available for richer responses
      trader_sharpe: ts?.trader_metrics?.sharpe,
      trader_cagr: ts?.trader_metrics?.cagr,
      trader_max_dd: ts?.trader_metrics?.max_drawdown,
      expert_type_result: ts?.expert_type,
      narrative: ts?.narrative,
    }
  }

  // ── Fallback when no LLM is reachable ───────────────────────────────────

  generateContextualResponse(userInput: string, context: any): string {
    const input = userInput.toLowerCase()

    // If we have real metrics from a completed run, use them
    if (context.trader_sharpe !== undefined && context.trader_cagr !== undefined) {
      if (input.includes('performance') || input.includes('result') || input.includes('how')) {
        const sharpe = Number(context.trader_sharpe).toFixed(2)
        const cagr = (Number(context.trader_cagr) * 100).toFixed(1)
        const dd = (Number(context.trader_max_dd) * 100).toFixed(1)
        return `Based on the completed backtest for **${context.asset}**:\n• Sharpe Ratio: ${sharpe}\n• CAGR: ${cagr}%\n• Max Drawdown: ${dd}%\n\n${context.narrative ? `IRIS says: "${context.narrative}"` : 'Would you like help interpreting these metrics?'}`
      }
    }

    if (input.includes('strategy') && context.prompt) {
      return `Your strategy for **${context.asset || 'the asset'}** runs from ${context.start_date || 'start'} to ${context.end_date || 'end'} with $${(context.capital || 0).toLocaleString()} initial capital.\n\nWould you like to optimize parameters or explain the results?`
    }

    if (input.includes('risk') || input.includes('drawdown')) {
      return 'Risk management is critical. Key metrics to watch: **Max Drawdown** (worst peak-to-trough loss), **Sharpe Ratio** (risk-adjusted return), and **Calmar Ratio** (CAGR ÷ Max Drawdown). A Sharpe > 1.0 is considered good, > 2.0 is excellent.'
    }

    if (input.includes('sharpe')) {
      return 'The **Sharpe Ratio** measures risk-adjusted returns: (return − risk-free rate) ÷ volatility. A value > 1.0 is good, > 2.0 is excellent. Higher means better return per unit of risk taken.'
    }

    if (input.includes('cagr')) {
      return 'The **CAGR** (Compound Annual Growth Rate) is the annual growth rate of your portfolio over the backtested period, accounting for compounding. It smooths out year-to-year volatility for a clean annualized view.'
    }

    if (input.includes('optimize') || input.includes('improve')) {
      return 'Strategy optimization tips:\n• Adjust indicator periods (e.g. MA window)\n• Tighten stop-loss levels\n• Vary commission and slippage assumptions\n• Try different expert agents (risk_analysis vs alpha_signal)\n• Test on different assets or time periods'
    }

    if (input.includes('automate') || input.includes('deploy')) {
      return 'The **Automate** button deploys your strategy to paper trading mode. It serializes the strategy config and simulates live execution with Alpaca paper trading — no real money is used.'
    }

    if (input.includes('help')) {
      return `I can help you with:\n• **Strategy analysis** — explain what your rules are doing\n• **Performance metrics** — Sharpe, CAGR, drawdown, win rate\n• **Risk assessment** — position sizing, stop-losses\n• **Optimization** — parameter tuning suggestions\n• **Expert agents** — what each expert type focuses on\n\nWhat would you like to explore?`
    }

    return `I'm IRIS AI, your quantitative trading assistant. ${context.app_phase === 'complete' ? 'Your backtest is complete — ask me about the results, metrics, or how to improve your strategy.' : 'Run a backtest and I can help analyze the results in detail. Try asking about risk, performance, or optimization.'}`
  }
}

export const chatService = new ChatService()
