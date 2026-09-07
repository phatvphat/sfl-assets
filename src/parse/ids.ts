import { sflPath } from "../sources.js";
import { parseNameNumberMap, readText } from "./util.js";

export function parseKnownIds(): Record<string, number> {
  return parseNameNumberMap(readText(sflPath("knownIds")), "KNOWN_IDS");
}

export function parseItemIds(): Record<string, number> {
  return parseNameNumberMap(readText(sflPath("itemIds")), "ITEM_IDS");
}
