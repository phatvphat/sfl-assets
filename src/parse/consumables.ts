import { sflPath } from "../sources.js";
import {
  extractConstObjectBody,
  parseObjectKey,
  readText,
  splitTopLevelEntries,
} from "./util.js";

/** Leaf consumable maps that declare real `"Name": { ... }` entries. */
const CONSUMABLE_CONSTS = [
  "FIRE_PIT_COOKABLES",
  "KITCHEN_COOKABLES",
  "BAKERY_COOKABLES",
  "DELI_COOKABLES",
  "JUICE_COOKABLES",
  "PIRATE_CAKE",
  "FISH",
  "FACTION_FOOD",
  "TRADE_FOOD",
] as const;

function keysFromConst(src: string, constName: string): string[] {
  const body = extractConstObjectBody(src, constName);
  const keys: string[] = [];
  for (const entry of splitTopLevelEntries(body)) {
    const key = parseObjectKey(entry);
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * Names in CONSUMABLES (cookables, fish, cakes, aged fish, etc.).
 */
export function parseConsumableNames(): Set<string> {
  const src = readText(sflPath("consumables"));
  const names = new Set<string>();
  const fishNames: string[] = [];

  for (const constName of CONSUMABLE_CONSTS) {
    for (const key of keysFromConst(src, constName)) {
      names.add(key);
      if (constName === "FISH") fishNames.push(key);
    }
  }

  // AGED_FISH / PRIME_AGED_FISH are derived at runtime from FISH
  for (const fish of fishNames) {
    names.add(`Aged ${fish}`);
    names.add(`Prime Aged ${fish}`);
  }

  return names;
}
