import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelemetryChunkRequest } from "@echory/contract";
import { InferenceProvider } from "./inference.js";

const VALID_CHUNK: TelemetryChunkRequest = {
  chunk_id: "chunk_001",
  session_id: "session_001",
  timestamp_ms: Date.now(),
  speaker: "counterpart",
  text: "No, no, everything's perfect on our end.",
  acoustic_metadata: {
    pitch_volatility: 0.7,
    speech_rate_wpm: 175,
    pause_duration_ms: 200,
    volume_intensity: 0.6,
  },
};

const VALID_CLASSIFICATION = {
  sentiment: "sarcastic",
  confidence: 0.85,
  volatility_flag: true,
  hidden_intent: "forced positivity masking frustration",
  mitigation_suggestion: "Name the tension directly and invite a straight answer",
  risk_level: "medium",
};

function openAiResponse(content: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  return { choices: [{ message: { content } }], ...(usage ? { usage } : {}) };
}

function fakeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InferenceProvider — default OpenAI-compatible path", () => {
  it("parses a clean JSON response into the contract shape, with observability populated", async () => {
    const fetchMock = fakeFetch(
      openAiResponse(JSON.stringify(VALID_CLASSIFICATION), { prompt_tokens: 512, completion_tokens: 40 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new InferenceProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "phi4-mini",
      disableThinking: false,
    });
    const result = await provider.analyze(VALID_CHUNK);

    expect(result.classification).toEqual(VALID_CLASSIFICATION);
    expect(result.observability).toMatchObject({
      model: "phi4-mini",
      tokenCounts: { prompt: 512, completion: 40 },
    });

    // Requirement from ticket 0007: response_format/json_schema must always be
    // sent, even for non-reasoning models -- confirmed necessary to stop
    // phi4-mini wrapping JSON in markdown fences / granite4.1:3b dropping risk_level.
    const [, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(requestInit.body);
    expect(requestBody.response_format).toMatchObject({ type: "json_schema" });
  });

  it("strips markdown code fences before parsing (model ignored the no-fences instruction)", async () => {
    vi.stubGlobal("fetch", fakeFetch(openAiResponse("```json\n" + JSON.stringify(VALID_CLASSIFICATION) + "\n```")));

    const provider = new InferenceProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "phi4-mini",
      disableThinking: false,
    });
    const result = await provider.analyze(VALID_CHUNK);
    expect(result.classification).toEqual(VALID_CLASSIFICATION);
  });

  it("throws a clear error (not an unhandled crash) on non-JSON model output", async () => {
    vi.stubGlobal("fetch", fakeFetch(openAiResponse("Sure, here is my analysis: it seems sarcastic.")));

    const provider = new InferenceProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "phi4-mini",
      disableThinking: false,
    });
    await expect(provider.analyze(VALID_CHUNK)).rejects.toThrow(/non-JSON output/);
  });

  it("throws a clear error when required fields are missing (schema validation failure)", async () => {
    const { risk_level, ...missingRiskLevel } = VALID_CLASSIFICATION;
    vi.stubGlobal("fetch", fakeFetch(openAiResponse(JSON.stringify(missingRiskLevel))));

    const provider = new InferenceProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "phi4-mini",
      disableThinking: false,
    });
    await expect(provider.analyze(VALID_CHUNK)).rejects.toThrow(/failed schema validation/);
  });

  it("throws a clear error on a non-2xx HTTP response", async () => {
    vi.stubGlobal("fetch", fakeFetch({ error: "internal error" }, false, 503));

    const provider = new InferenceProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "phi4-mini",
      disableThinking: false,
    });
    await expect(provider.analyze(VALID_CHUNK)).rejects.toThrow(/responded 503/);
  });

  it("only sends an Authorization header when an API key is configured (Ollama needs none, cloud providers do)", async () => {
    const fetchMock = fakeFetch(openAiResponse(JSON.stringify(VALID_CLASSIFICATION)));
    vi.stubGlobal("fetch", fetchMock);

    await new InferenceProvider({ baseUrl: "http://localhost:11434/v1", model: "phi4-mini", disableThinking: false }).analyze(
      VALID_CHUNK,
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();

    await new InferenceProvider({
      baseUrl: "https://api.groq.com/openai/v1",
      model: "qwen/qwen3.8-27b",
      apiKey: "test-key",
      disableThinking: false,
    }).analyze(VALID_CHUNK);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer test-key");
  });

  it("calls the configured base URL, so pointing at a different provider needs zero code changes", async () => {
    const fetchMock = fakeFetch(openAiResponse(JSON.stringify(VALID_CLASSIFICATION)));
    vi.stubGlobal("fetch", fetchMock);

    await new InferenceProvider({
      baseUrl: "https://api.groq.com/openai/v1",
      model: "qwen/qwen3.8-27b",
      apiKey: "test-key",
      disableThinking: false,
    }).analyze(VALID_CHUNK);

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });
});

describe("InferenceProvider — INFERENCE_DISABLE_THINKING opt-in path", () => {
  it("routes to Ollama's native /api/chat with think:false, derived from the same base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          message: { content: JSON.stringify(VALID_CLASSIFICATION) },
          prompt_eval_count: 300,
          eval_count: 25,
        }),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new InferenceProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3:8b",
      disableThinking: true,
    });
    const result = await provider.analyze(VALID_CHUNK);

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/api/chat");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.think).toBe(false);
    expect(result.classification).toEqual(VALID_CLASSIFICATION);
    expect(result.observability).toMatchObject({ tokenCounts: { prompt: 300, completion: 25 } });
  });
});
