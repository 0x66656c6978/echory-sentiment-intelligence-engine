import { beforeEach, describe, expect, it, vi } from "vitest";

const startObservationMock = vi.fn();
const propagateAttributesMock = vi.fn(async (_attrs: unknown, callback: () => unknown) => callback());
const generationUpdateMock = vi.fn().mockReturnThis();
const generationEndMock = vi.fn();

vi.mock("@langfuse/tracing", () => ({
  startObservation: (...args: unknown[]) => {
    startObservationMock(...args);
    return { update: generationUpdateMock, end: generationEndMock };
  },
  propagateAttributes: (...args: [unknown, () => unknown]) => propagateAttributesMock(...args),
}));

const nodeSdkStartMock = vi.fn();
const nodeSdkShutdownMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({ start: nodeSdkStartMock, shutdown: nodeSdkShutdownMock })),
}));

vi.mock("@langfuse/otel", () => ({
  LangfuseSpanProcessor: vi.fn().mockImplementation(() => ({})),
}));

const START_TIME = new Date("2026-09-04T12:00:00.000Z");
const END_TIME = new Date("2026-09-04T12:00:00.400Z");

const ENTRY = {
  chunk_id: "chunk_1",
  session_id: "session_1",
  provider: "inference",
  model: "qwen/qwen3.8-27b",
  prompt: "Speaker: counterpart\nTranscript: ...",
  rawResponse: '{"sentiment":"positive"}',
  tokenCounts: { prompt: 512, completion: 40 },
  startTime: START_TIME,
  endTime: END_TIME,
};

const ENABLED_ENV = { LANGFUSE_PUBLIC_KEY: "pk-x", LANGFUSE_SECRET_KEY: "sk-y" };

describe("computeLangfuseEnabled", () => {
  it("is false with no keys, false with only one of the two, true with both", async () => {
    const { computeLangfuseEnabled } = await import("./langfuse.js");
    expect(computeLangfuseEnabled({})).toBe(false);
    expect(computeLangfuseEnabled({ LANGFUSE_PUBLIC_KEY: "pk-x" })).toBe(false);
    expect(computeLangfuseEnabled({ LANGFUSE_SECRET_KEY: "sk-y" })).toBe(false);
    expect(computeLangfuseEnabled(ENABLED_ENV)).toBe(true);
  });
});

describe("langfuse tracing (off by default)", () => {
  // sdk is a genuine module-level singleton by design (initLangfuse is only
  // ever called once, at real startup) -- vi.resetModules() + a fresh
  // dynamic import per test is what gives each test its own singleton
  // instead of leaking "already started" state between them.
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("logToLangfuse is a true no-op before initLangfuse is ever called (the real startup ordering)", async () => {
    const { logToLangfuse } = await import("./langfuse.js");
    await logToLangfuse(ENTRY);
    expect(propagateAttributesMock).not.toHaveBeenCalled();
    expect(startObservationMock).not.toHaveBeenCalled();
  });

  it("initLangfuse with no keys leaves tracing disabled and never starts the OpenTelemetry SDK", async () => {
    const { initLangfuse } = await import("./langfuse.js");
    initLangfuse({});
    expect(nodeSdkStartMock).not.toHaveBeenCalled();
  });

  it("initLangfuse with both keys enables tracing and starts the OpenTelemetry SDK exactly once, even if called twice", async () => {
    const { initLangfuse } = await import("./langfuse.js");
    initLangfuse(ENABLED_ENV);
    initLangfuse(ENABLED_ENV);
    expect(nodeSdkStartMock).toHaveBeenCalledTimes(1);
  });

  it("logToLangfuse records a generation with session_id propagated, a verb-first static name, the real call timing, and the system prompt kept out of input", async () => {
    const { initLangfuse, logToLangfuse } = await import("./langfuse.js");
    initLangfuse(ENABLED_ENV);

    await logToLangfuse(ENTRY);

    expect(propagateAttributesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session_1", traceName: "classify-sentiment" }),
      expect.any(Function),
    );
    // Verb-first, static name (Langfuse's own best-practices guidance) --
    // never sentiment-classification (noun-first) or chunk/session-specific.
    expect(startObservationMock).toHaveBeenCalledWith(
      "classify-sentiment",
      expect.objectContaining({ model: "qwen/qwen3.8-27b", input: ENTRY.prompt }),
      { asType: "generation", startTime: START_TIME },
    );
    // The system prompt (identical on every call) belongs in metadata, not
    // repeated as input noise on every single trace.
    const [, generationAttrs] = startObservationMock.mock.calls[0];
    expect(generationAttrs.metadata.system_prompt).toEqual(expect.stringContaining("Sentiment Intelligence Engine"));
    expect(generationAttrs.input).not.toContain("Sentiment Intelligence Engine");

    expect(generationUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ output: ENTRY.rawResponse, usageDetails: { input: 512, output: 40 } }),
    );
    // The observation must be timed to the real LLM call, not to whenever
    // this function happens to run after the fact (it's always called
    // post-hoc, once the classification result is already in hand).
    expect(generationEndMock).toHaveBeenCalledWith(END_TIME);
  });

  it("shutdownLangfuse is a no-op when disabled", async () => {
    const { shutdownLangfuse } = await import("./langfuse.js");
    await expect(shutdownLangfuse()).resolves.toBeUndefined();
    expect(nodeSdkShutdownMock).not.toHaveBeenCalled();
  });

  it("shutdownLangfuse flushes the SDK when enabled", async () => {
    const { initLangfuse, shutdownLangfuse } = await import("./langfuse.js");
    initLangfuse(ENABLED_ENV);
    await shutdownLangfuse();
    expect(nodeSdkShutdownMock).toHaveBeenCalledTimes(1);
  });
});
