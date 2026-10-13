# Navideck

A browser-based Navidrome client built for a desktop mouse and a Steam Deck touchscreen. Large hit targets, a persistent player bar, and a full-screen now-playing view.

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
