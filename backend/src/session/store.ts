import type { TelemetryChunkResponse } from "@echory/contract";

interface StoredChunk extends TelemetryChunkResponse {
  timestamp_ms: number;
}

/**
 * In-memory session store keyed by session_id. Each session's chunk list is
 * isolated in its own array — sessions never share or mutate each other's
 * state, which matters once multiple concurrent calls are being processed.
 */
class SessionStore {
  private readonly sessions = new Map<string, StoredChunk[]>();

  append(sessionId: string, chunk: TelemetryChunkResponse, timestampMs: number): void {
    const existing = this.sessions.get(sessionId);
    const entry: StoredChunk = { ...chunk, timestamp_ms: timestampMs };
    if (existing) {
      existing.push(entry);
    } else {
      this.sessions.set(sessionId, [entry]);
    }
  }

  get(sessionId: string): StoredChunk[] | undefined {
    return this.sessions.get(sessionId);
  }
}

export const sessionStore = new SessionStore();
