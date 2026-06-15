import { ipcMain, BrowserWindow } from 'electron'
import { toggleYtmWindow, getYtmWindow } from './ytm-window'
import { updateTrayPlayState } from './tray'

const SKIN_WIDTH = 275

export function registerIpcHandlers(getSkinWindow: () => BrowserWindow | null): void {
  ipcMain.on('toggle-ytm-window', () => toggleYtmWindow())

  ipcMain.on('minimize-skin', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('resize-skin', (event, height: number) => {
    BrowserWindow.fromWebContents(event.sender)?.setSize(SKIN_WIDTH, height)
  })

  // YTM → skin: state updates
  ipcMain.on('ytm:state', (_event, state) => {
    getSkinWindow()?.webContents.send('ytm:state', state)
    updateTrayPlayState(state.paused)
  })

  // YTM → skin: queue updates
  ipcMain.on('ytm:queue', (_event, items) => {
    getSkinWindow()?.webContents.send('ytm:queue', items)
  })

  // skin → YTM: transport + queue commands
  ipcMain.on('ytm:command', (_event, cmd: string, arg?: number) => {
    getYtmWindow()?.webContents.send('ytm:command', cmd, arg)
  })
}
