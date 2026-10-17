import fs from "node:fs";
import path from "node:path";
import { PROTECTED_IMAGE_URL } from "../config.js";
import { sflAssetPath, sflPath } from "../sources.js";
import { parseSunnyside } from "./sunnyside.js";
import {
  extractConstObjectBody,
  matchEntryKey,
  readText,
  splitTopLevelEntries,
} from "./util.js";

export type ImageRef =
  | { kind: "file"; path: string }
  | { kind: "url"; url: string };

export type CollectibleImageMap = Record<string, ImageRef | null>;

function parseAssetImports(src: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re =
    /^import\s+(\w+)\s+from\s+["'](assets\/[^"']+)["']\s*;?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    map[m[1]] = sflAssetPath(m[2]);
  }
  return map;
}

function parseCropSlugs(plantSrc: string): Record<string, string> {
  const body = extractConstObjectBody(plantSrc, "IMAGES");
  const out: Record<string, string> = {};
  for (const entry of splitTopLevelEntries(body)) {
    const matched = matchEntryKey(entry);
    if (!matched) continue;
    const str = matched.rhs.replace(/,$/, "").trim().match(/^["']([^"']+)["']$/);
    if (str) out[matched.key] = str[1];
  }
  return out;
}

function resolveImageExpr(
  expr: string,
  imports: Record<string, string>,
  sunnyside: Record<string, string>,
  cropSlugs: Record<string, string>,
): ImageRef | null {
  const e = expr.trim().replace(/,$/, "").trim();

  // `.Parsnip.crop` or `["Crystal Leaf"].seed`
  const crop = e.match(
    /^CROP_LIFECYCLE\[["']Basic Biome["']\](?:\.(\w+)|\[["']([^"']+)["']\])\.(crop|seed)$/,
  );
  if (crop) {
    const cropName = crop[1] ?? crop[2];
    const part = crop[3] as "crop" | "seed";
    const slug = cropName ? cropSlugs[cropName] : undefined;
    if (!slug) return null;
    return {
      kind: "url",
      url: `${PROTECTED_IMAGE_URL}/crops/${slug}/${part}.png`,
    };
  }

  const sun = e.match(/^SUNNYSIDE\.((?:[\w$]+\.)+[\w$]+)$/);
  if (sun) {
    const url = sunnyside[sun[1]];
    return url ? { kind: "url", url } : null;
  }

  if (/^[A-Za-z_$][\w$]*$/.test(e)) {
    const p = imports[e];
    return p ? { kind: "file", path: p } : null;
  }

  return null;
}

/** Map inventory item names → clean image refs (local file or CDN). */
export function parseCollectibleImages(): CollectibleImageMap {
  const imagesSrc = readText(sflPath("imagesTs"));
  const imports = parseAssetImports(imagesSrc);
  const sunnyside = parseSunnyside();
  const cropSlugs = parseCropSlugs(readText(sflPath("plantTs")));
  const body = extractConstObjectBody(imagesSrc, "ITEM_DETAILS");
  const out: CollectibleImageMap = {};

  for (const entry of splitTopLevelEntries(body)) {
    const matched = matchEntryKey(entry);
    if (!matched) continue;

    const imageMatch = entry.match(/^\s*image:\s*([^,\n]+)/m);
    out[matched.key] = imageMatch
      ? resolveImageExpr(imageMatch[1], imports, sunnyside, cropSlugs)
      : null;
  }

  return out;
}

export function resolveWearableImage(id: number): ImageRef | null {
  const dir = sflPath("wearablesDir");
  for (const ext of [".webp", ".png", ".gif"] as const) {
    const p = path.join(dir, `${id}${ext}`);
    if (fs.existsSync(p)) return { kind: "file", path: p };
  }
  return null;
}
