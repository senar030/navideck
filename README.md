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

Navideck is a static web app. The browser talks to Navidrome directly, so the container only has to serve the UI.

### 1. Copy the project onto the NAS

Put this folder on a dataset Portainer can see, for example `/mnt/tank/apps/navideck`.

If you have git on the NAS:

```bash
cd /mnt/tank/apps
git clone <your-repo-url> navideck
```

Otherwise copy the project over SMB/SFTP (include `Dockerfile`, `docker-compose.yml`, and `nginx.conf`).

### 2. Create a Portainer stack

1. Open Portainer → **Stacks** → **Add stack**.
2. Name it `navideck`.
3. Choose **Repository** if the code is in git, or **Web editor** and paste:

```yaml
services:
  navideck:
    build: /mnt/tank/apps/navideck
    image: navideck:local
    container_name: navideck
    restart: unless-stopped
    ports:
      - "4173:80"
```

If you used **Web editor**, set the build path to the folder on the NAS. Easier: **Repository** / git, or deploy from the compose file in that folder.

Alternative that always works with a copied folder: in Portainer go to **Images** → **Build a new image**, set the build context to `/mnt/tank/apps/navideck`, Dockerfile `Dockerfile`, tag `navideck:local`. Then **Containers** → **Add container**:

- Image: `navideck:local`
- Publish port `4173` → container `80`
- Restart policy: unless stopped

### 3. Open it

`http://<truenas-ip>:4173`

On the login screen, the **Navidrome URL must be reachable from the device you play on** (PC or Steam Deck), not only from the container. Use something like `http://192.168.178.113:4533`, not `localhost`.

If you serve Navideck over HTTPS, Navidrome must be HTTPS too.

Change `"4173:80"` if that host port is taken.

## Notes

- Navidrome must be reachable from the browser. If the player is served over HTTPS, Navidrome should be HTTPS too (mixed content is blocked).
- CORS is enabled in Navidrome by default. If login fails with a network error, check the URL and that the server is up.
- Space plays/pauses, arrow keys skip. Media keys work through the Media Session API.
- Steam Deck: open in a browser (desktop mode) or add the URL as a web app / non-Steam shortcut for a standalone window. Use **Session** in the nav to disconnect. Open the queue from the player bar or the full-screen now-playing view.
