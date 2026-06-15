import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { getYtmWindow } from './ytm-window'

let tray: Tray | null = null
let isPaused = true
let getSkin: (() => BrowserWindow | null) | null = null

function sendCommand(cmd: string) {
  getYtmWindow()?.webContents.send('ytm:command', cmd)
}

function rebuildMenu(): void {
  if (!tray) return
  const skinWindow = getSkin?.()
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show skin',            click: () => { skinWindow?.show(); skinWindow?.focus() } },
      { label: 'Hide skin',            click: () => skinWindow?.hide() },
      { label: 'Show YouTube Music',   click: () => { getYtmWindow()?.show(); getYtmWindow()?.focus() } },
      { label: 'Hide YouTube Music',   click: () => getYtmWindow()?.hide() },
      { type: 'separator' },
      { label: isPaused ? 'Play' : 'Pause', click: () => sendCommand(isPaused ? 'play' : 'pause') },
      { label: 'Next track',           click: () => sendCommand('next') },
      { type: 'separator' },
      { label: 'Quit',                 click: () => app.quit() },
    ])
  )
}

export function createTray(getSkinWindow: () => BrowserWindow | null): void {
  getSkin = getSkinWindow

  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('YouTube Music')
  rebuildMenu()
}

export function updateTrayPlayState(paused: boolean): void {
  if (paused === isPaused) return
  isPaused = paused
  rebuildMenu()
}
