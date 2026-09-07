import { sflPath } from "../sources.js";
import {
  extractConstObjectBody,
  parseObjectKey,
  readText,
  splitTopLevelEntries,
} from "./util.js";

export type BuffMap = Record<string, string[] | null>;

function loadDictionary(): Record<string, string> {
  const raw = readText(sflPath("dictionary"));
  return JSON.parse(raw) as Record<string, string>;
}

/**
 * Collect translate("key") calls from a buff entry body.
 * Prefer base keys; drop keys ending in `.skill`.
 */
function extractTranslateKeys(entryBody: string): string[] {
  const keys: string[] = [];
  const re = /translate\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(entryBody))) {
    const key = m[1];
    if (key.endsWith(".skill")) continue;
    keys.push(key);
  }
  return [...new Set(keys)];
}

function parseBuffFile(
  fileKey: "collectibleBuffs" | "bumpkinBuffs",
  constName: string,
  dictionary: Record<string, string>,
): BuffMap {
  const src = readText(sflPath(fileKey));
  const body = extractConstObjectBody(src, constName);
  const out: BuffMap = {};

  for (const entry of splitTopLevelEntries(body)) {
    const name = parseObjectKey(entry);
    if (!name) continue;
    const keys = extractTranslateKeys(entry);
    const texts: string[] = [];
    for (const k of keys) {
      const text = dictionary[k];
      if (text && !texts.includes(text)) texts.push(text);
    }
    out[name] = texts.length > 0 ? texts : null;
  }

  return out;
}

export function parseAllBuffs(): {
  collectibles: BuffMap;
  wearables: BuffMap;
} {
  const dictionary = loadDictionary();
  return {
    collectibles: parseBuffFile(
      "collectibleBuffs",
      "COLLECTIBLE_BUFF_LABELS",
      dictionary,
    ),
    wearables: parseBuffFile(
      "bumpkinBuffs",
      "BUMPKIN_ITEM_BUFF_LABELS",
      dictionary,
    ),
  };
}
