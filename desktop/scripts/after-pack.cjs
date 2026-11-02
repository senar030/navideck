const fs = require('node:fs/promises')
const path = require('node:path')

/*
 * Steam Game Mode starts the AppImage directly, so the desktop entry's
 * executableArgs never reach Electron. The generated AppRun only adds
 * --no-sandbox when `unshare` fails, which is not the case here. Wrap the Linux
 * executable so every launch gets the flag, whether it comes from the desktop
 * entry or from Steam.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return

  const executable = context.packager.executableName || 'navideck'
  const appDir = context.appOutDir
  const binary = path.join(appDir, executable)
  const renamed = path.join(appDir, `${executable}-bin`)

  await fs.rename(binary, renamed)
  const launcher = `#!/bin/sh
exec "$(dirname "$0")/${executable}-bin" --no-sandbox "$@"
`
  await fs.writeFile(path.join(appDir, executable), launcher, { mode: 0o755 })
}
