import type { SentimentAnalysisResult, SentimentProvider, TelemetryChunkRequest } from "@echory/contract";
import { SentimentClassificationSchema } from "@echory/contract";
import {
  SENTIMENT_CLASSIFICATION_JSON_SCHEMA,
  SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT,
  buildSentimentClassificationUserMessage,
} from "../prompts/sentimentClassification.js";

export interface InferenceProviderConfig {
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 or https://api.groq.com/openai/v1 */
  baseUrl: string;
  model: string;
  apiKey?: string;
  /**
   * Opt-in escape hatch (ticket 0007): routes to Ollama's native /api/chat
   * with think:false instead of the default OpenAI-compatible call. Only
   * relevant for a local reasoning model -- see ticket 0005's finding that
   * Ollama's OpenAI-compatible endpoint can't suppress "thinking" mode.
   * Not exercised by the current model choice (phi4-mini is non-reasoning).
   */
  disableThinking: boolean;
}

function configFromEnv(env: NodeJS.ProcessEnv): InferenceProviderConfig {
  return {
    baseUrl: env.INFERENCE_BASE_URL ?? "http://localhost:11434/v1",
    model: env.INFERENCE_MODEL ?? "phi4-mini",
    apiKey: env.INFERENCE_API_KEY || undefined,
    disableThinking: env.INFERENCE_DISABLE_THINKING === "true",
  };
}

/** Some models wrap output in ```json fences despite instructions -- strip and retry once. */
function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(stripped);
  }
}

interface CallResult {
  content: string;
  tokenCounts?: { prompt?: number; completion?: number };
}

interface OpenAiCompatChatResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface OllamaNativeChatResponse {
  message: { content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Real HTTP inference against an OpenAI-compatible chat-completions endpoint
 * by default (satisfies Pascal's explicit request to keep the endpoint
 * swappable via INFERENCE_BASE_URL/INFERENCE_MODEL/INFERENCE_API_KEY alone --
 * works against local Ollama or any real cloud provider, e.g. Groq, with zero
 * code changes), with an opt-in native-Ollama path for local reasoning
 * models. See docs/tickets/finished/0007-inference-provider.md for the full
 * design rationale and verification log.
 */
export class InferenceProvider implements SentimentProvider {
  readonly name = "inference";
  private readonly config: InferenceProviderConfig;

  constructor(config: InferenceProviderConfig = configFromEnv(process.env)) {
    this.config = config;
  }

  async analyze(chunk: TelemetryChunkRequest): Promise<SentimentAnalysisResult> {
    const userMessage = buildSentimentClassificationUserMessage(chunk);
    const { content, tokenCounts } = this.config.disableThinking
      ? await this.callOllamaNative(userMessage)
      : await this.callOpenAiCompatible(userMessage);

    let parsedJson: unknown;
    try {
      parsedJson = extractJson(content);
    } catch {
      throw new Error(
        `InferenceProvider: model "${this.config.model}" returned non-JSON output ` +
          `(even after stripping markdown fences): ${content.slice(0, 200)}`,
      );
    }

    const validated = SentimentClassificationSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new Error(
        `InferenceProvider: model "${this.config.model}" output failed schema validation: ` +
          validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    }

    return {
      classification: validated.data,
      observability: {
        model: this.config.model,
        prompt: userMessage,
        rawResponse: content,
        tokenCounts,
      },
    };
  }

  private async callOpenAiCompatible(userMessage: string): Promise<CallResult> {
    const { baseUrl, model, apiKey } = this.config;
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        // Required even for non-reasoning models -- ticket 0007 found phi4-mini
        // wraps JSON in markdown fences and granite4.1:3b drops risk_level
        // entirely under plain prompting alone. Different shape than Ollama
        // native's `format` field (this is the OpenAI-standard nesting).
        response_format: {
          type: "json_schema",
          json_schema: { name: "classification", schema: SENTIMENT_CLASSIFICATION_JSON_SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`InferenceProvider: ${baseUrl}/chat/completions responded ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as OpenAiCompatChatResponse;
    return {
      content: data.choices[0].message.content,
      tokenCounts: data.usage
        ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
        : undefined,
    };
  }

  private async callOllamaNative(userMessage: string): Promise<CallResult> {
    const { baseUrl, model } = this.config;
    // INFERENCE_BASE_URL stays in its usual .../v1 shape even for this path
    // (one env var to document, not two) -- derive the native base by
    // dropping the trailing /v1.
    const nativeBaseUrl = baseUrl.replace(/\/v1\/?$/, "");
    const res = await fetch(`${nativeBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
        think: false,
        options: { temperature: 0.2 },
        format: SENTIMENT_CLASSIFICATION_JSON_SCHEMA,
      }),
    });

    if (!res.ok) {
      throw new Error(`InferenceProvider: ${nativeBaseUrl}/api/chat responded ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as OllamaNativeChatResponse;
    return {
      content: data.message.content,
      tokenCounts: { prompt: data.prompt_eval_count, completion: data.eval_count },
    };
  }
}
