import { PROTECTED_IMAGE_URL } from "../config.js";
import { sflPath } from "../sources.js";
import {
  extractBalancedObjectBody,
  extractConstObjectBody,
  matchEntryKey,
  readText,
  splitTopLevelEntries,
} from "./util.js";

/**
 * Flatten SUNNYSIDE into dotted keys → absolute CDN URLs.
 * e.g. `icons.stopwatch` → `https://…/icons/stopwatch.png`
 */
export function parseSunnyside(): Record<string, string> {
  const body = extractConstObjectBody(readText(sflPath("sunnysideTs")), "SUNNYSIDE");
  const out: Record<string, string> = {};

  function walk(chunk: string, prefix: string) {
    for (const entry of splitTopLevelEntries(chunk)) {
      const matched = matchEntryKey(entry);
      if (!matched) continue;
      const pathKey = prefix ? `${prefix}.${matched.key}` : matched.key;
      const rhs = matched.rhs;

      if (rhs.startsWith("{")) {
        const nested = extractBalancedObjectBody(rhs);
        if (nested !== null) walk(nested, pathKey);
        continue;
      }

      const urlMatch = rhs.match(/`\$\{CONFIG\.PROTECTED_IMAGE_URL\}([^`]+)`/);
      if (urlMatch) {
        out[pathKey] = `${PROTECTED_IMAGE_URL}${urlMatch[1]}`;
      }
    }
  }

  walk(body, "");
  return out;
}
