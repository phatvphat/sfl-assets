import path from "node:path";
import { SFL_ROOT } from "./config.js";

/** Relative paths inside the sunflower-land repo. */
export const RELATIVE_SOURCES = {
  knownIds: "src/features/game/types/index.ts",
  itemIds: "src/features/game/types/bumpkin.ts",
  imagesTs: "src/features/game/types/images.ts",
  sunnysideTs: "src/assets/sunnyside.ts",
  plantTs: "src/features/island/plots/lib/plant.ts",
  collectibleBuffs: "src/features/game/types/collectibleItemBuffs.ts",
  bumpkinBuffs: "src/features/game/types/bumpkinItemBuffs.ts",
  dictionary: "src/lib/i18n/dictionaries/dictionary.json",
  consumables: "src/features/game/types/consumables.ts",
  wearablesDir: "src/assets/wearables",
} as const;

export type SourceKey = keyof typeof RELATIVE_SOURCES;

export function sflPath(key: SourceKey): string {
  return path.join(SFL_ROOT, RELATIVE_SOURCES[key]);
}

export function sflAssetPath(assetImport: string): string {
  // Vite alias "assets/..." → src/assets/...
  const rel = assetImport.replace(/^assets\//, "src/assets/");
  return path.join(SFL_ROOT, rel);
}
