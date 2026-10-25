import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ImageRef } from "../parse/images.js";

export type Collection = "collectibles" | "wearables" | "consumables";

export type MissingEntry = {
  name: string;
  collection: Collection;
  id: number;
  reason: string;
};

function extFromSource(src: string): string {
  const clean = src.split("?")[0];
  const ext = path.extname(clean).toLowerCase();
  if (
    ext === ".webp" ||
    ext === ".png" ||
    ext === ".gif" ||
    ext === ".jpg" ||
    ext === ".jpeg"
  ) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".webp";
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * Delete `dir/{id}.*`.
 * When `keepBasename` is set, that file is left alone (drop other extensions).
 */
export async function deleteIdAssets(
  dir: string,
  id: number,
  keepBasename?: string,
): Promise<void> {
  if (!fs.existsSync(dir)) return;
  const prefix = `${id}.`;
  for (const name of await fs.promises.readdir(dir)) {
    if (!name.startsWith(prefix)) continue;
    if (keepBasename && name === keepBasename) continue;
    await fs.promises.unlink(path.join(dir, name)).catch(() => undefined);
  }
}

/**
 * Remove files in `dir` whose basename is not in `keep`.
 * Skips directories and dotfiles (e.g. `.missing.json` if ever placed here).
 * Returns the number of deleted files.
 */
export async function pruneUnusedAssets(
  dir: string,
  keep: Set<string>,
): Promise<number> {
  if (!fs.existsSync(dir)) return 0;
  let deleted = 0;
  for (const name of await fs.promises.readdir(dir)) {
    if (name.startsWith(".")) continue;
    if (keep.has(name)) continue;
    const full = path.join(dir, name);
    const stat = await fs.promises.lstat(full).catch(() => null);
    if (!stat?.isFile()) continue;
    await fs.promises.unlink(full).catch(() => undefined);
    deleted++;
  }
  return deleted;
}

/** Basenames currently on disk for `dir/{id}.*` (preserve on sync failure). */
export async function existingIdBasenames(
  dir: string,
  id: number,
): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  const prefix = `${id}.`;
  return (await fs.promises.readdir(dir)).filter((name) =>
    name.startsWith(prefix),
  );
}

async function fetchToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  if (!res.body) throw new Error(`Empty body for ${url}`);
  await ensureDir(path.dirname(dest));
  const nodeStream = Readable.fromWeb(
    res.body as import("stream/web").ReadableStream,
  );
  await pipeline(nodeStream, fs.createWriteStream(dest));
}

export async function materializeImage(
  ref: ImageRef,
  destDir: string,
  id: number,
  force: boolean,
): Promise<{ relative: string } | { error: string }> {
  const ext = extFromSource(ref.kind === "file" ? ref.path : ref.url);
  const dest = path.join(destDir, `${id}${ext}`);
  const relative = path
    .relative(path.join(destDir, ".."), dest)
    .replace(/\\/g, "/");

  if (!force && fs.existsSync(dest)) {
    return { relative };
  }

  try {
    if (ref.kind === "file") {
      if (!fs.existsSync(ref.path)) {
        return { error: `Local file missing: ${ref.path}` };
      }
      await ensureDir(destDir);
      await fs.promises.copyFile(ref.path, dest);
    } else {
      await fetchToFile(ref.url, dest);
    }
    // After a successful write, drop other extensions for this id.
    await deleteIdAssets(destDir, id, path.basename(dest));
    return { relative };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Resolve + copy/fetch; records failures into `missing`. */
export async function syncImage(opts: {
  name: string;
  id: number;
  collection: Collection;
  ref: ImageRef | null;
  destDir: string;
  force: boolean;
  missing: MissingEntry[];
  noRefReason: string;
}): Promise<string | null> {
  const { name, id, collection, ref, destDir, force, missing, noRefReason } =
    opts;

  if (!ref) {
    missing.push({ name, collection, id, reason: noRefReason });
    return null;
  }

  const result = await materializeImage(ref, destDir, id, force);
  if ("error" in result) {
    missing.push({ name, collection, id, reason: result.error });
    return null;
  }
  return result.relative;
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const n = Math.min(Math.max(concurrency, 1), Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
