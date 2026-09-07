import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

export const SFL_ROOT = path.resolve(
  process.env.SFL_ROOT ?? path.join(REPO_ROOT, "..", "sunflower-land"),
);

export const PROTECTED_IMAGE_URL = (
  process.env.PROTECTED_IMAGE_URL ??
  "https://sunflower-land.com/testnet-assets"
).replace(/\/$/, "");

export const OUT_DIR = path.resolve(process.env.OUT_DIR ?? REPO_ROOT);

export const ASSETS_DIR = path.join(OUT_DIR, "assets");
export const COLLECTIBLES_DIR = path.join(ASSETS_DIR, "collectibles");
export const WEARABLES_DIR = path.join(ASSETS_DIR, "wearables");
export const CONSUMABLES_DIR = path.join(ASSETS_DIR, "consumables");
export const METADATA_PATH = path.join(OUT_DIR, "metadata.json");
export const METADATA_MIN_PATH = path.join(OUT_DIR, "metadata.min.json");
export const MISSING_PATH = path.join(ASSETS_DIR, ".missing.json");

export const CONCURRENCY = Number(process.env.SYNC_CONCURRENCY ?? 8);

export function parseArgs(argv: string[]): { force: boolean } {
  return { force: argv.includes("--force") };
}
