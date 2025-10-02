export interface AIClientConfig {
  provider?: 'openai';
  apiKey?: string; // falls back to process.env.OPENAI_API_KEY
  baseUrl?: string; // defaults to OpenAI v1
  model?: string; // e.g., 'gpt-4o-mini'
  temperature?: number;
  maxTokens?: number;
  // Extra headers for proxies/gateways
  headers?: Record<string, string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIClient {
  private readonly cfg: Required<Pick<AIClientConfig, 'provider' | 'baseUrl' | 'model'>> & AIClientConfig;

  constructor(cfg: AIClientConfig = {}) {
    this.cfg = {
      provider: cfg.provider ?? 'openai',
      baseUrl: cfg.baseUrl ?? 'https://api.openai.com/v1',
      // Prefer a large-context model by default
      model: cfg.model ?? 'gpt-4o',
      ...cfg,
    };
  }

  private get apiKey(): string | undefined {
    return this.cfg.apiKey ?? process.env.OPENAI_API_KEY;
  }

  async chat(messages: ChatMessage[], opts: Partial<AIClientConfig> = {}): Promise<string> {
    if (this.cfg.provider !== 'openai') throw new Error('Only OpenAI provider is supported currently');
    const apiKey = opts.apiKey ?? this.apiKey;
    if (!apiKey) throw new Error('Missing OpenAI API key');

    const body = {
      model: opts.model ?? this.cfg.model,
      temperature: opts.temperature ?? this.cfg.temperature ?? 0.6,
      // Allow larger responses by default; provider will cap per model
      max_tokens: opts.maxTokens ?? this.cfg.maxTokens ?? 4000,
      messages,
    } as any;

    const res = await fetch(`${opts.baseUrl ?? this.cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(this.cfg.headers ?? {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(()=>'');
      throw new Error(`LLM request failed: ${res.status} ${res.statusText} ${text}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Invalid LLM response');
    return content;
  }
}
