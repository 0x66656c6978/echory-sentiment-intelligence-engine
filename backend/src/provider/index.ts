import type { SentimentProvider } from "@echory/contract";
import { PlaceholderProvider } from "./placeholder.js";
import { InferenceProvider } from "./inference.js";

export type ProviderName = "placeholder" | "inference";

function isProviderName(value: string): value is ProviderName {
  return value === "placeholder" || value === "inference";
}

/**
 * Resolves the active SentimentProvider from LLM_PROVIDER. Defaults to the
 * always-available placeholder rather than failing startup, since inference
 * isn't implemented yet (see docs/tickets/open/0007-inference-provider.md).
 */
export function getProvider(env: NodeJS.ProcessEnv = process.env): SentimentProvider {
  const requested = env.LLM_PROVIDER ?? "placeholder";
  const providerName: ProviderName = isProviderName(requested) ? requested : "placeholder";

  switch (providerName) {
    case "inference":
      return new InferenceProvider();
    case "placeholder":
    default:
      return new PlaceholderProvider();
  }
}
