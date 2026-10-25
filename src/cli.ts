import fs from "node:fs";
import path from "node:path";
import {
  ASSETS_DIR,
  COLLECTIBLES_DIR,
  CONCURRENCY,
  CONSUMABLES_DIR,
  METADATA_MIN_PATH,
  METADATA_PATH,
  MISSING_PATH,
  SFL_ROOT,
  WEARABLES_DIR,
  parseArgs,
} from "./config.js";
import { parseAllBuffs } from "./parse/buffs.js";
import { parseConsumableNames } from "./parse/consumables.js";
import { parseItemIds, parseKnownIds } from "./parse/ids.js";
import {
  parseCollectibleImages,
  resolveWearableImage,
} from "./parse/images.js";
import {
  deleteIdAssets,
  ensureDir,
  existingIdBasenames,
  mapPool,
  pruneUnusedAssets,
  syncImage,
  type MissingEntry,
} from "./sync/download.js";
import {
  assertMetadataCoverage,
  orderMetadata,
  putEntry,
  writeMetadata,
  writeMissing,
  type Metadata,
} from "./sync/metadata.js";

/** Record kept asset basename(s) for post-sync orphan pruning. */
async function rememberAsset(
  keep: Set<string>,
  destDir: string,
  id: number,
  image: string | null,
): Promise<void> {
  if (image) {
    keep.add(path.basename(image));
    return;
  }
  // Sync failed / no ref — keep whatever is already on disk for this id.
  for (const name of await existingIdBasenames(destDir, id)) {
    keep.add(name);
  }
}

function unresolvedImageReason(
  images: Record<string, unknown>,
  name: string,
): string {
  return name in images
    ? "Could not resolve image expression"
    : "Missing from ITEM_DETAILS";
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(SFL_ROOT)) {
    throw new Error(
      `SFL_ROOT does not exist: ${SFL_ROOT}\nSet SFL_ROOT in .env to your sunflower-land checkout.`,
    );
  }

  console.log(`SFL_ROOT: ${SFL_ROOT}`);
  console.log(`Force: ${force}`);

  const knownIds = parseKnownIds();
  const itemIds = parseItemIds();
  const consumableNames = parseConsumableNames();
  const images = parseCollectibleImages();
  const buffs = parseAllBuffs();

  const consumableJobs = Object.entries(knownIds).filter(([name]) =>
    consumableNames.has(name),
  );
  const collectibleJobs = Object.entries(knownIds).filter(
    ([name]) => !consumableNames.has(name),
  );
  const wearableJobs = Object.entries(itemIds);
  const collisions = new Set(
    collectibleJobs
      .map(([name]) => name)
      .filter((name) => name in itemIds),
  );

  console.log(
    `Parsed ${collectibleJobs.length} collectibles, ${wearableJobs.length} wearables, ${consumableJobs.length} consumables`,
  );
  if (collisions.size > 0) {
    console.log(
      `Name collisions (${collisions.size}): ${[...collisions].sort().join(", ")}`,
    );
  }

  await Promise.all([
    ensureDir(COLLECTIBLES_DIR),
    ensureDir(WEARABLES_DIR),
    ensureDir(CONSUMABLES_DIR),
  ]);

  const metadata: Metadata = {};
  const missing: MissingEntry[] = [];
  const keepCollectibles = new Set<string>();
  const keepWearables = new Set<string>();
  const keepConsumables = new Set<string>();

  await mapPool(consumableJobs, CONCURRENCY, async ([name, id]) => {
    const image = await syncImage({
      name,
      id,
      collection: "consumables",
      ref: images[name] ?? null,
      destDir: CONSUMABLES_DIR,
      force,
      missing,
      noRefReason: unresolvedImageReason(images, name),
    });
    if (image) await deleteIdAssets(COLLECTIBLES_DIR, id);
    await rememberAsset(keepConsumables, CONSUMABLES_DIR, id, image);
    metadata[name] = { image };
  });

  await mapPool(collectibleJobs, CONCURRENCY, async ([name, id]) => {
    const image = await syncImage({
      name,
      id,
      collection: "collectibles",
      ref: images[name] ?? null,
      destDir: COLLECTIBLES_DIR,
      force,
      missing,
      noRefReason: unresolvedImageReason(images, name),
    });
    await rememberAsset(keepCollectibles, COLLECTIBLES_DIR, id, image);
    putEntry(
      metadata,
      name,
      {
        collection: "collectibles",
        id,
        image,
        boost: buffs.collectibles[name] ?? null,
      },
      collisions,
    );
  });

  await mapPool(wearableJobs, CONCURRENCY, async ([name, id]) => {
    const image = await syncImage({
      name,
      id,
      collection: "wearables",
      ref: resolveWearableImage(id),
      destDir: WEARABLES_DIR,
      force,
      missing,
      noRefReason: `No local wearable file for id ${id}`,
    });
    await rememberAsset(keepWearables, WEARABLES_DIR, id, image);
    putEntry(
      metadata,
      name,
      {
        collection: "wearables",
        id,
        image,
        boost: buffs.wearables[name] ?? null,
      },
      collisions,
    );
  });

  assertMetadataCoverage(
    metadata,
    collectibleJobs,
    wearableJobs,
    collisions,
  );

  const ordered = orderMetadata(
    metadata,
    collectibleJobs,
    consumableJobs,
    wearableJobs,
    collisions,
  );

  const [prunedCollectibles, prunedWearables, prunedConsumables] =
    await Promise.all([
      pruneUnusedAssets(COLLECTIBLES_DIR, keepCollectibles),
      pruneUnusedAssets(WEARABLES_DIR, keepWearables),
      pruneUnusedAssets(CONSUMABLES_DIR, keepConsumables),
    ]);
  const pruned =
    prunedCollectibles + prunedWearables + prunedConsumables;

  await writeMetadata(ordered);
  await writeMissing(missing);

  const withImage = Object.values(ordered).filter((e) => e.image).length;
  const withBoost = Object.values(ordered).filter(
    (e) => "boost" in e && e.boost,
  ).length;

  console.log(`Wrote ${METADATA_PATH}`);
  console.log(`Wrote ${METADATA_MIN_PATH}`);
  console.log(`Assets dir: ${ASSETS_DIR}`);
  if (pruned > 0) {
    console.log(`Pruned ${pruned} unused asset file(s)`);
  }
  console.log(
    `Done: ${withImage}/${Object.keys(ordered).length} images (${consumableJobs.length} consumables), ${withBoost} with boosts, ${missing.length} missing → ${MISSING_PATH}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
