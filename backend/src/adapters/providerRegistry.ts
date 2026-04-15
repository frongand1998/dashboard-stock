import { MockProvider } from "./mockProvider.js";
import { FreeTierProvider } from "./freeTierProvider.js";
import type { DataProvider } from "../types.js";

export function createProvider(): DataProvider {
  const provider = process.env.DATA_PROVIDER ?? "mock";

  switch (provider) {
    case "free-tier":
      return new FreeTierProvider();
    case "mock":
      return new MockProvider();
    default:
      return new MockProvider();
  }
}
