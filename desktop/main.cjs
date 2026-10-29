const { app, BrowserWindow, Menu, protocol, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

/*
 * Navideck as a desktop application for Windows and Linux. It carries the built
 * web app and serves it from a private scheme, so nothing here needs the NAS:
 * the servers are still reached over the network, but the app itself is local.
 */
const DIST = path.join(__dirname, 'dist')
const WINDOW_FILE = () => path.join(app.getPath('userData'), 'window.json')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

let mainWindow = null

function readBounds() {
  try {
    const raw = fs.readFileSync(WINDOW_FILE(), 'utf8')
    const bounds = JSON.parse(raw)
    if (Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      return {
        width: Math.max(940, bounds.width),
        height: Math.max(620, bounds.height),
        x: Number.isFinite(bounds.x) ? bounds.x : undefined,
        y: Number.isFinite(bounds.y) ? bounds.y : undefined,
      }
    }
  } catch {
    /* first start, or the file was removed */
  }
  return { width: 1280, height: 820 }
}

function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    fs.writeFileSync(WINDOW_FILE(), JSON.stringify(mainWindow.getNormalBounds()))
  } catch {
    /* a read-only profile must not stop the app from closing */
  }
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: 'Datei', submenu: [{ role: 'quit', label: 'Beenden' }] },
      {
        label: 'Bearbeiten',
        submenu: [
          { role: 'undo', label: 'Rückgängig' },
          { role: 'redo', label: 'Wiederholen' },
          { type: 'separator' },
          { role: 'cut', label: 'Ausschneiden' },
          { role: 'copy', label: 'Kopieren' },
          { role: 'paste', label: 'Einfügen' },
          { role: 'selectAll', label: 'Alles auswählen' },
        ],
      },
      {
        label: 'Ansicht',
        submenu: [
          { role: 'reload', label: 'Neu laden' },
          { role: 'forceReload', label: 'Neu laden und Cache leeren' },
          { role: 'toggleDevTools', label: 'Entwicklertools' },
          { type: 'separator' },
          { role: 'resetZoom', label: 'Zoom zurücksetzen' },
          { role: 'zoomIn', label: 'Vergrößern' },
          { role: 'zoomOut', label: 'Verkleinern' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Vollbild' },
        ],
      },
      {
        label: 'Hilfe',
        submenu: [
          {
            label: 'Projekt auf GitHub',
            click: () => {
              void shell.openExternal('https://github.com/senar030/navideck')
            },
          },
        ],
      },
    ]),
  )
}

function createWindow() {
  const bounds = readBounds()
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#140e1f',
    title: 'Navideck',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      /*
       * Media servers are not web apps: Navidrome, Audiobookshelf and Nextcloud
       * do not all send CORS headers, and some home setups are plain HTTP. The
       * renderer only ever loads this app's own files, so the trade-off is
       * limited to what the user's own servers answer.
       */
      webSecurity: false,
      allowRunningInsecureContent: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', saveBounds)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    let protocolName = ''
    try {
      protocolName = new URL(url).protocol
    } catch {
      protocolName = ''
    }
    if (protocolName === 'app:') return
    event.preventDefault()
    if (/^https?:/i.test(url)) void shell.openExternal(url)
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[navideck] load failed ${code} ${description} ${url}`)
  })

  void mainWindow.loadURL('app://navideck/index.html')
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

app.whenReady().then(() => {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    let relative = decodeURIComponent(url.pathname)
    if (!relative || relative === '/') relative = '/index.html'
    if (relative.includes('..')) return new Response('Not found', { status: 404 })

    const file = path.join(DIST, relative)
    try {
      const body = await fs.promises.readFile(file)
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/* A quiet start-up check used while building: prints the DOM state and quits. */
if (process.env.NAVIDECK_SMOKE) {
  app.whenReady().then(() => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    const account = process.env.NAVIDECK_SMOKE_ACCOUNT

    const report = async (label) => {
      const state = await window.webContents.executeJavaScript(
        `({ title: document.title, shell: !!document.querySelector('.app'), onboard: !!document.querySelector('.onboard'), theme: document.documentElement.dataset.theme || '', nav: [...document.querySelectorAll('.nav-btn')].map((b) => b.textContent.trim()), albums: [...document.querySelectorAll('.album-name')].slice(0, 4).map((b) => b.textContent), error: document.querySelector('.error')?.textContent || '' })`,
      )
      console.log(`${label} ${JSON.stringify(state)}`)
    }

    window.webContents.once('did-finish-load', () => {
      if (!account) {
        setTimeout(() => {
          void report('SMOKE')
            .then(() => app.exit(0))
            .catch((error) => {
              console.error(`SMOKE FAILED ${error}`)
              app.exit(1)
            })
        }, 1200)
        return
      }

      /* Seed a server the way the settings page would, then load the music area. */
      void window.webContents
        .executeJavaScript(
          `localStorage.setItem('navideck.account.v1', ${JSON.stringify(account)}); location.hash = '#/home'; location.reload(); true`,
        )
        .then(() => {
          window.webContents.once('did-finish-load', () => {
            setTimeout(() => {
              void report('SMOKE-ACCOUNT')
                .then(() => app.exit(0))
                .catch((error) => {
                  console.error(`SMOKE FAILED ${error}`)
                  app.exit(1)
                })
            }, 2500)
          })
        })
    })
  })
}
