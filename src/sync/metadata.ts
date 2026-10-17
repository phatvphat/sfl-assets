import fs from "node:fs";
import path from "node:path";
import { METADATA_MIN_PATH, METADATA_PATH, MISSING_PATH } from "../config.js";
import { byIdAsc } from "../parse/util.js";
import { ensureDir, type MissingEntry } from "./download.js";

export type CollectibleOrWearableEntry = {
  collection: "collectibles" | "wearables";
  id: number;
  image: string | null;
  boost: string[] | null;
};

/** Consumables only expose the image path (id is in the filename). */
export type ConsumableEntry = {
  image: string | null;
};

export type MetadataEntry = CollectibleOrWearableEntry | ConsumableEntry;
export type Metadata = Record<string, MetadataEntry>;

type Collection = CollectibleOrWearableEntry["collection"];
type IdJob = readonly [string, number];

/** Bare name, or `Name (collection)` when the name exists in both maps. */
export function metadataKey(
  name: string,
  collection: Collection,
  collisions: Set<string>,
): string {
  return collisions.has(name) ? `${name} (${collection})` : name;
}

export function putEntry(
  metadata: Metadata,
  name: string,
  entry: CollectibleOrWearableEntry,
  collisions: Set<string>,
): void {
  metadata[metadataKey(name, entry.collection, collisions)] = entry;
}

/** collectibles → consumables → wearables, by id within each group. */
export function orderMetadata(
  metadata: Metadata,
  collectibleJobs: IdJob[],
  consumableJobs: IdJob[],
  wearableJobs: IdJob[],
  collisions: Set<string>,
): Metadata {
  const ordered: Metadata = {};

  const append = (jobs: IdJob[], collection: Collection) => {
    for (const [name] of [...jobs].sort(byIdAsc)) {
      const key = metadataKey(name, collection, collisions);
      ordered[key] = metadata[key];
    }
  };

  append(collectibleJobs, "collectibles");
  for (const [name] of [...consumableJobs].sort(byIdAsc)) {
    ordered[name] = metadata[name];
  }
  append(wearableJobs, "wearables");
  return ordered;
}

/**
 * Ensure every source item is present under the expected key with matching
 * collection + id (catches dropped collision partners).
 */
export function assertMetadataCoverage(
  metadata: Metadata,
  collectibleJobs: IdJob[],
  wearableJobs: IdJob[],
  collisions: Set<string>,
): void {
  const gaps: string[] = [];

  const check = (name: string, collection: Collection, id: number) => {
    const key = metadataKey(name, collection, collisions);
    const entry = metadata[key];
    if (
      !entry ||
      !("collection" in entry) ||
      entry.collection !== collection ||
      entry.id !== id
    ) {
      gaps.push(`${collection} "${name}" #${id} @ "${key}"`);
    }
  };

  for (const [name, id] of collectibleJobs) check(name, "collectibles", id);
  for (const [name, id] of wearableJobs) check(name, "wearables", id);

  if (gaps.length > 0) {
    throw new Error(
      `Metadata incomplete (${gaps.length} gap(s)):\n${gaps
        .map((g) => `  - ${g}`)
        .join("\n")}`,
    );
  }
}

export async function writeMetadata(metadata: Metadata): Promise<void> {
  await fs.promises.writeFile(
    METADATA_PATH,
    JSON.stringify(metadata, null, 2) + "\n",
    "utf8",
  );
  await fs.promises.writeFile(
    METADATA_MIN_PATH,
    JSON.stringify(metadata) + "\n",
    "utf8",
  );
}

export async function writeMissing(missing: MissingEntry[]): Promise<void> {
  await ensureDir(path.dirname(MISSING_PATH));
  await fs.promises.writeFile(
    MISSING_PATH,
    JSON.stringify(missing, null, 2) + "\n",
    "utf8",
  );
}
