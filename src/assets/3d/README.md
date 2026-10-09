# Final GLB input directory

The current companion uses the supplied PNG pack by default. This directory documents the retained 3D fallback, activated only after a PNG load failure. See [the current PNG report](../../../docs/slingsip-png-integration.md).

Place the actual authored assets at:

- `character/slingsip-character.glb`
- `props/slingsip-bottle.glb`

No final assets were supplied during integration. This directory deliberately contains no substitute production GLBs. Angular copies this directory to `assets/3d/` for development and built local Electron loads.

When activated, the 3D fallback attempts the preferred files, then loads the clearly isolated existing placeholders under `public/assets/character/temporary-3d/`. Its canvas diagnostics identify actual source URLs, temporary status, discovered mappings and incompatibilities. If both 3D sources fail or WebGL2 is unavailable, the existing sprite fallback remains usable.

See `docs/slingsip-3d-integration.md` for named clip/morph/socket discovery, validation and the manual checklist. The final asset compatibility remains unverified until the real files are supplied.
