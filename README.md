# Navideck

A browser-based Navidrome client built for a desktop mouse and a Steam Deck touchscreen. Large hit targets, a persistent player bar, and a full-screen now-playing view.

> **Note:** Navideck is a **vibe coding** project — it was built in dialogue with AI coding assistants rather than written line by line by hand.

## Run

```bash
npm install
npm run dev
```

Then open the printed URL. `npm run dev` listens on the LAN (`host: true`), so a Steam Deck on the same network can use `http://<pc-ip>:5173`.

Production build:

```bash
npm run build
npm run preview
```

## Connect

On the login screen enter:

- Navidrome URL, for example `http://192.168.1.10:4533`
- Username
- Password

Credentials stay in this browser’s local storage until you disconnect.

## Install as an app (PWA)

Navideck ships a web app manifest, maskable icons and a service worker, so it can
be installed like a native app and started without a network connection.

**Installation and offline mode both require HTTPS.** Service workers are only
available in a secure context, and `http://<lan-ip>:4173` is not one — no browser
will offer to install the app from there. `http://localhost` is the only
exception (development). Ways to get HTTPS in front of the container:

- **Tailscale** (simplest when the devices share a tailnet):
  `tailscale serve --bg --https=443 http://localhost:4173`, then open
  `https://<machine>.<tailnet>.ts.net` — the certificate is provisioned automatically.
- **Reverse proxy with TLS** (Caddy, Traefik, nginx) in front of port 4173.
- Cloudflare Tunnel or any other HTTPS terminator.

Installing:

- **Android (Chrome/Edge)**: menu → *App installieren*. The same action appears in
  Navideck under *Einstellungen → App* once the browser reports it as installable.
- **iOS/iPadOS — Safari only**: Share → *Zum Home-Bildschirm*. Firefox, Chrome and
  other iOS browsers are WebKit shells without the installation API and cannot
  install web apps at all.

Offline and updates:

- The service worker pre-caches the app shell (HTML, CSS, JS, icons). Navidrome
  traffic (API, cover art, audio streams) is never cached.
- Navigations are network-first, so a redeploy is picked up on the next start. If a
  new worker takes over while a track is playing, the reload waits until playback stops.
- Bump `VERSION` in `public/sw.js` whenever files in `public/` change, so the cached
  shell is refreshed.

The install icons are generated from `public/favicon.svg`:

```bash
npm run icons
```

That rewrites `public/icons/*` (192/512, maskable variants, 180px iOS icon).

## Radio

The **Radio** nav point looks up internet radio stations through
[radio-browser.info](https://www.radio-browser.info/), a free, community-run
directory, and hands the ones you follow to Navidrome — so they turn up there and
in every other Subsonic client. Three things are worth knowing:

- Following and removing a station needs a Navidrome **admin** account. The
  station list itself is visible to everybody, and any user can play from it.
- Only **HTTPS** streams are listed. Navidrome stores a station as a URL and the
  browser plays it directly; a page served over HTTPS refuses to load a plain
  `http://` stream, and Navidrome does not proxy streams itself.
- Station logos come from the directory, because a station in Navidrome only carries
  a logo if somebody uploaded one there — Navidrome's radio API takes a name, a stream
  and a homepage, and nothing else. The device that follows a station remembers its
  logo; every other device looks it up again by stream URL and caches it locally, so
  the covers show up everywhere. Stations the directory has no logo for fall back to
  the app's own artwork.

## TrueNAS + Portainer

Portainer on TrueNAS cannot build this image (`mkdir /.docker: permission denied`). GitHub Actions builds it; Portainer only pulls `ghcr.io/senar030/navideck:latest`.

### 1. Make the package public (once)

After the first GitHub Action succeeds:

1. Open [github.com/senar030/navideck/pkgs/container/navideck](https://github.com/senar030/navideck/pkgs/container/navideck)
2. **Package settings** → **Change visibility** → **Public**

If you leave it private, add a GitHub token in Portainer under **Registries**.

### 2. Deploy the stack

1. Portainer → **Stacks** → **Add stack** → name `navideck`
2. **Repository**: `https://github.com/senar030/navideck`
3. Branch: `main`
4. Compose path: `docker-compose.yml`
5. Deploy

Or paste this into the web editor (no Git clone needed):

```yaml
services:
  navideck:
    image: ghcr.io/senar030/navideck:latest
    container_name: navideck
    restart: unless-stopped
    ports:
      - "4173:80"
```

Open `http://<truenas-ip>:4173`. After a GitHub update, wait for the Action to finish, then **Pull and redeploy**.

On login, Navidrome must be reachable from the player (PC / Steam Deck), e.g. `http://192.168.178.113:4533`, not `localhost`. Change `"4173:80"` if that host port is taken.

## Notes

- Navidrome must be reachable from the browser. If the player is served over HTTPS, Navidrome should be HTTPS too (mixed content is blocked).
- CORS is enabled in Navidrome by default. If login fails with a network error, check the URL and that the server is up.
- Space plays/pauses, arrow keys skip. Media keys work through the Media Session API.
- Steam Deck: open in a browser (desktop mode) or add the URL as a web app / non-Steam shortcut for a standalone window. Use **Session** in the nav to disconnect. Open the queue from the player bar or the full-screen now-playing view.
