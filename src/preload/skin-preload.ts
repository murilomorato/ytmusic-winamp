import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('winamp', {
  toggleYtmWindow: () => ipcRenderer.send('toggle-ytm-window'),
  minimize: () => ipcRenderer.send('minimize-skin'),
  resizeSkin: (height: number) => ipcRenderer.send('resize-skin', height),

  onState: (cb: (state: unknown) => void) => {
    ipcRenderer.on('ytm:state', (_event, state) => cb(state))
  },
  onQueue: (cb: (items: unknown[]) => void) => {
    ipcRenderer.on('ytm:queue', (_event, items) => cb(items))
  },

  play: () => ipcRenderer.send('ytm:command', 'play'),
  pause: () => ipcRenderer.send('ytm:command', 'pause'),
  next: () => ipcRenderer.send('ytm:command', 'next'),
  prev: () => ipcRenderer.send('ytm:command', 'prev'),
  seek: (pct: number) => ipcRenderer.send('ytm:command', 'seek', pct),
  setVolume: (vol: number) => ipcRenderer.send('ytm:command', 'volume', vol),
  clickQueueItem: (index: number) => ipcRenderer.send('ytm:command', 'queue-click', index),
})
