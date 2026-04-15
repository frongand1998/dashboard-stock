import type { Dict, GroupedDictionary } from "./types";

export function flattenDictionary(input: GroupedDictionary, prefix = ""): Dict {
  const out: Dict = {};

  for (const [key, value] of Object.entries(input)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      out[nextKey] = value;
      continue;
    }

    Object.assign(out, flattenDictionary(value, nextKey));
  }

  return out;
}
