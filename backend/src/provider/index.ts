import type { SentimentProvider } from "@echory/contract";
import { PlaceholderProvider } from "./placeholder.js";
import { LocalProvider } from "./local.js";
import { CloudProvider } from "./cloud.js";

export type ProviderName = "placeholder" | "local" | "cloud";

function isProviderName(value: string): value is ProviderName {
  return value === "placeholder" || value === "local" || value === "cloud";
}

/**
 * Resolves the active SentimentProvider from LLM_PROVIDER. Defaults to the
 * always-available placeholder rather than failing startup, since local/
 * cloud aren't implemented yet.
 */
export function getProvider(env: NodeJS.ProcessEnv = process.env): SentimentProvider {
  const requested = env.LLM_PROVIDER ?? "placeholder";
  const providerName: ProviderName = isProviderName(requested) ? requested : "placeholder";

  switch (providerName) {
    case "local":
      return new LocalProvider();
    case "cloud":
      return new CloudProvider();
    case "placeholder":
    default:
      return new PlaceholderProvider();
  }
}
