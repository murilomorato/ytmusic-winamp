import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createYtmWindow } from './ytm-window'
import { registerIpcHandlers } from './ipc'
import { createTray } from './tray'

let skinWindow: BrowserWindow | null = null

function createSkinWindow(): void {
  skinWindow = new BrowserWindow({
    width: 275,
    height: 316,
    frame: false,
    resizable: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: join(__dirname, '../preload/skin-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    skinWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    skinWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  skinWindow.on('closed', () => {
    skinWindow = null
    app.quit()
  })
}

app.whenReady().then(() => {
  registerIpcHandlers(() => skinWindow)
  createSkinWindow()
  createYtmWindow()
  createTray(() => skinWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSkinWindow()
      createYtmWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
