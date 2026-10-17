# sfl-assets

> **Unofficial.** Not affiliated with, sponsored by, or endorsed by Sunflower Land. See [Disclaimer](#disclaimer).

Static image host / mirror for [Sunflower Land](https://github.com/sunflower-land/sunflower-land) **collectibles**, **wearables**, and **consumables** (cooked food, fish, cakes, etc.).

Syncs clean in-game icons (no ERC-1155 grass backgrounds) from a local sunflower-land checkout, with remote fallback for Sunnyside / crop sprites.

## Layout

```
assets/
  collectibles/{id}.{webp|png|gif}   # inventory SFTs (excluding consumables)
  wearables/{id}.{webp|png}          # bumpkin items
  consumables/{id}.{webp|png|gif}    # cookables, fish, cakes, etc.
metadata.json                        # pretty-printed index
metadata.min.json                    # same data, minified
assets/.missing.json                 # items that failed to resolve
```

## Metadata shape

Look up by **item name**:

```json
{
  "Sunflower": {
    "collection": "collectibles",
    "id": 201,
    "image": "collectibles/201.png",
    "boost": null
  },
  "Banana Onesie": {
    "collection": "wearables",
    "id": 251,
    "image": "wearables/251.webp",
    "boost": ["x0.8 Banana Growth Time"]
  },
  "Mashed Potato": {
    "image": "consumables/519.png"
  }
}
```

- **collectibles / wearables:** `collection`, `id`, `image`, `boost` (`null` or `string[]`)
- **consumables:** only `image` (numeric id is in the filename under `assets/consumables/`)

When the same display name exists as both a collectible and a wearable (e.g. `Parsnip`), metadata keeps **both** under qualified keys only:

- `"Parsnip (collectibles)"` / `"Parsnip (wearables)"`
- no bare `"Parsnip"` key (object keys must be unique)

After sync, coverage is asserted: every source item must appear under the expected key with matching `collection` + `id`.

Serve images as `{baseUrl}/{image}`.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io)
- Local clone of sunflower-land

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:

| Variable | Meaning | Default |
|----------|---------|---------|
| `SFL_ROOT` | Path to sunflower-land repo | `../sunflower-land` |
| `PROTECTED_IMAGE_URL` | Remote base URL for Sunnyside / crop sprites | `https://sunflower-land.com/testnet-assets` |
| `OUT_DIR` | Output root for `assets/` + metadata | `.` |
| `SYNC_CONCURRENCY` | Parallel copy/fetch workers | `8` |

Never commit `.env` (it is gitignored).

## Sync

```bash
pnpm sync
pnpm sync -- --force   # overwrite existing images
pnpm typecheck
```

Sources are **text-parsed** from sunflower-land (no Vite / no importing game modules):

| Source | Role |
|--------|------|
| `KNOWN_IDS` | Collectible + consumable IDs |
| `ITEM_IDS` | Wearable IDs |
| Consumable leaf maps | Classify inventory items as consumables |
| `ITEM_DETAILS` / `SUNNYSIDE` / crop lifecycle | Image paths |
| Buff label files + `dictionary.json` | Boost strings |

## Project structure

```
src/
  cli.ts              # entry: pnpm sync
  config.ts           # env + output paths
  sources.ts          # relative paths inside SFL_ROOT
  parse/              # static TS/JSON parsers (no game runtime)
  sync/               # copy/fetch + write metadata
```

## Contributing

- Prefer small, focused PRs (parser fix, new collection, docs).
- After changing parsers, run `pnpm sync` and spot-check `metadata.json` + a few image files.
- Do not import sunflower-land TypeScript modules at runtime — buffs/UI pull browser-only deps. Keep **text parsing** in `src/parse/`.
- Do not commit secrets, local `.env`, or unrelated game source.

## Notes

- Bud / Pet NFT art uses separate hosts and is not synced here.
- Some wearables have no icon in-repo; they appear in `.missing.json` with `image: null`.
- Re-run `pnpm sync` after updating your sunflower-land checkout.

## Disclaimer

**sfl-assets is an independent, unofficial community project.**

- Not sponsored, endorsed, or affiliated with Sunflower Land or its organization.
- Contributors are not members or representatives of that organization unless they state otherwise.
- “Sunflower Land” and related names, logos, and artwork belong to their respective owners; use here does not imply ownership or partnership.
- Provided **as is**, without warranty. Authors are not liable for damages from using this project.
- Metadata may be incomplete or outdated after game updates — verify against official sources when it matters.
- Nothing here is financial, legal, or investment advice.

If you have questions or feedback, please open an issue.

## License

MIT — see [LICENSE](LICENSE). Applies to **this repository’s source code only**, not Sunflower Land assets or trademarks.
