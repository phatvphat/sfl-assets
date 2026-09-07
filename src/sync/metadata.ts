import fs from "node:fs";
import path from "node:path";
import { METADATA_MIN_PATH, METADATA_PATH, MISSING_PATH } from "../config.js";
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
