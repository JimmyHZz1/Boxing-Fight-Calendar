# Curated sports image library

Images in this directory are committed to the repository and served by the app itself. The manifest at `data/image-library.json` maps normalised competitor/team names to local paths.

## Adding an image

Every entry must include:

- `path`: repository-relative path under `assets/images/`
- `source_url`: original file or source page
- `licence` and `licence_url`: explicit reuse terms
- `creator` and `attribution`: credit line
- `verified_at`: date the licence and identity were checked

Do not add images merely because they are visible on an official or social website. Public visibility is not permission to redistribute. Prefer public-domain or appropriately licensed Wikimedia Commons files, and retain the original attribution and licence link.

## Collection order

1. F1 drivers and constructors
2. PDC Order of Merit players
3. Boxing world champions
4. UFC champions and ranked fighters
5. BKFC fighters on upcoming cards

The app should always retain initials/logo fallbacks for missing images. No broken image should block a page from rendering.
