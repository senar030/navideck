# Navideck — project instructions

## Start from the current GitHub state

The local checkout can lag behind `origin/main`. Run `git fetch` and check
`git log --oneline HEAD..origin/main` before changing code. Never force-push
`main` or replace newer remote work with a stale tree.

## Always publish to GitHub

After every completed change, commit the relevant files and push `main`. The
`Build image` workflow then publishes `ghcr.io/senar030/navideck:latest`; the
user redeploys that image in Portainer. Mention in the final answer that a
redeploy is possible once the workflow has finished.

## Always ship a desktop release

Every completed user-facing change also gets a desktop release:

1. Bump the version in `desktop/package.json` (minor for features, patch for fixes).
2. Update `desktop/RELEASE_NOTES.md` (German, what changed + installation notes).
3. Commit and push `main`.
4. Create and push the tag `desktop-v<version>`.
5. Wait for the `Desktop release` workflow. It builds
   - `Navideck-Setup-<version>.exe` (Windows, NSIS)
   - `Navideck-<version>-x86_64.AppImage` (Linux, x64, for Bazzite)
   and publishes both as a GitHub release.
6. Download the assets into the local `release/` folder:
   `node scripts/fetch-desktop-release.mjs <version>`.
7. Report the release URL and local file paths.

Do not commit `release/` — it only holds downloaded build artifacts.

## Desktop packaging

The Electron wrapper lives in `desktop/` (`main.cjs`, `package.json` with the
electron-builder config). The web app is built first (`npm run build`), then
packaged. Linux is an AppImage so it runs on Bazzite without system installation.
