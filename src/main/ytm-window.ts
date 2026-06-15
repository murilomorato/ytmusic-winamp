import { BrowserWindow } from 'electron'
import { join } from 'path'
import { createYtmSession } from './session'

let ytmWindow: BrowserWindow | null = null

export function createYtmWindow(): BrowserWindow {
  const ses = createYtmSession()

  ytmWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'YouTube Music',
    webPreferences: {
      preload: join(__dirname, '../preload/ytm-inject.js'),
      session: ses,
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    }
  })

  ytmWindow.loadURL('https://music.youtube.com')

  ytmWindow.on('closed', () => {
    ytmWindow = null
  })

  return ytmWindow
}

export function getYtmWindow(): BrowserWindow | null {
  return ytmWindow
}

export function toggleYtmWindow(): void {
  if (!ytmWindow) return
  if (ytmWindow.isVisible()) {
    ytmWindow.hide()
  } else {
    ytmWindow.show()
    ytmWindow.focus()
  }
}
