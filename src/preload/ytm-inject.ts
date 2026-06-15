// Preload for the YTM BrowserWindow — contextIsolation: false.
// Runs BEFORE any page JavaScript. Two responsibilities:
//   1. Stealth: hide Electron fingerprints so Google login works
//   2. State + queue bridge: read YTM data and relay to main → skin

import { ipcRenderer } from 'electron'

// ─── 1. STEALTH ───────────────────────────────────────────────────────────────
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/128.0.6613.186 Safari/537.36'

const w = globalThis as Record<string, unknown>

try { delete w['process'] } catch { /* read-only on some Electron versions */ }

try {
  const nav = globalThis.navigator as Record<string, unknown>
  Object.defineProperty(nav, 'userAgent', { get: () => CHROME_UA, configurable: true })
  Object.defineProperty(nav, 'webdriver', { get: () => false, configurable: true })
  Object.defineProperty(nav, 'plugins', {
    get: () => [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }],
    configurable: true,
  })
} catch { /* ignore */ }

try {
  if (!w['chrome'] || !(w['chrome'] as Record<string, unknown>)['runtime']) {
    Object.defineProperty(w, 'chrome', {
      value: {
        app: { isInstalled: false },
        runtime: { id: undefined, connect: () => {}, sendMessage: () => {} },
        csi: () => ({}),
        loadTimes: () => ({}),
      },
      configurable: true, writable: true,
    })
  }
} catch { /* ignore */ }

// ─── 2. STATE BRIDGE ─────────────────────────────────────────────────────────
interface YtmState {
  title: string
  artist: string
  artUrl: string
  currentTime: number
  duration: number
  paused: boolean
  volume: number
}

function getState(): YtmState {
  const video = document.querySelector('video')
  const meta = navigator.mediaSession?.metadata
  return {
    title: meta?.title ?? '',
    artist: meta?.artist ?? '',
    artUrl: meta?.artwork?.[0]?.src ?? '',
    currentTime: video?.currentTime ?? 0,
    duration: video?.duration ?? 0,
    paused: video?.paused ?? true,
    volume: video?.volume ?? 1,
  }
}

function sendState() {
  ipcRenderer.send('ytm:state', getState())
}

let throttleTimer: ReturnType<typeof setTimeout> | null = null
function throttledSend() {
  if (throttleTimer) return
  throttleTimer = setTimeout(() => { throttleTimer = null; sendState() }, 500)
}

function attachVideo(video: HTMLVideoElement) {
  video.addEventListener('play', sendState)
  video.addEventListener('pause', sendState)
  video.addEventListener('loadedmetadata', sendState)
  video.addEventListener('volumechange', sendState)
  video.addEventListener('timeupdate', throttledSend)
  sendState()
}

function findAndWatchVideo() {
  const video = document.querySelector('video')
  if (video) { attachVideo(video as HTMLVideoElement); return }
  const obs = new MutationObserver(() => {
    const v = document.querySelector('video')
    if (v) { obs.disconnect(); attachVideo(v as HTMLVideoElement) }
  })
  obs.observe(document.body, { childList: true, subtree: true })
}

// ─── 3. QUEUE BRIDGE ─────────────────────────────────────────────────────────
interface QueueItem {
  title: string
  artist: string
  duration: string
  selected: boolean
}

function readQueue(): QueueItem[] {
  const nodes = document.querySelectorAll('ytmusic-player-queue-item')
  if (!nodes.length) return []
  return Array.from(nodes).slice(0, 60).map(node => {
    const el = node as HTMLElement
    const title =
      (el.querySelector('.song-title') as HTMLElement | null)?.title ||
      (el.querySelector('.song-title') as HTMLElement | null)?.textContent?.trim() ||
      (el.querySelector('yt-formatted-string.title') as HTMLElement | null)?.textContent?.trim() ||
      ''
    // byline is usually "Artist · Album" — take only the artist part
    const rawByline =
      (el.querySelector('.byline') as HTMLElement | null)?.textContent?.trim() ||
      (el.querySelector('.secondary-flex-columns yt-formatted-string') as HTMLElement | null)?.textContent?.trim() ||
      ''
    const artist = rawByline.split('·')[0].trim()
    const duration =
      (el.querySelector('.duration') as HTMLElement | null)?.textContent?.trim() ||
      (el.querySelector('.fixed-columns yt-formatted-string') as HTMLElement | null)?.textContent?.trim() ||
      (el.querySelector('.time-column yt-formatted-string') as HTMLElement | null)?.textContent?.trim() ||
      ''
    const selected = el.hasAttribute('selected') || el.classList.contains('selected')
    return { title, artist, duration, selected }
  })
}

let lastQueueLen = 0
let lastSelectedIndex = -1

function sendQueue() {
  const items = readQueue()
  const sel = items.findIndex(i => i.selected)
  if (items.length === lastQueueLen && sel === lastSelectedIndex) return
  lastQueueLen = items.length
  lastSelectedIndex = sel
  ipcRenderer.send('ytm:queue', items)
}

// ─── 4. COMMAND HANDLER ──────────────────────────────────────────────────────
ipcRenderer.on('ytm:command', (_event, cmd: string, arg?: number) => {
  const video = document.querySelector('video') as HTMLVideoElement | null
  switch (cmd) {
    case 'play':   video?.play(); break
    case 'pause':  video?.pause(); break
    case 'seek':   if (video && arg !== undefined) video.currentTime = (arg / 100) * video.duration; break
    case 'volume': if (video && arg !== undefined) video.volume = arg; break
    case 'next':
      document.querySelector<HTMLElement>('.next-button')?.click()
      break
    case 'prev':
      document.querySelector<HTMLElement>('.previous-button')?.click()
      break
    case 'queue-click': {
      if (arg === undefined) break
      const items = document.querySelectorAll('ytmusic-player-queue-item')
      const target = items[arg] as HTMLElement | undefined
      const clickable = (
        target?.querySelector('.song-title, .item-main-content, .flex-columns') ?? target
      ) as HTMLElement | undefined
      clickable?.click()
      setTimeout(sendQueue, 400)
      break
    }
  }
})

// ─── 5. BOOT ─────────────────────────────────────────────────────────────────
// Poll metadata & queue — queue re-sent when track or selection changes
let lastTitle = ''
setInterval(() => {
  const title = navigator.mediaSession?.metadata?.title ?? ''
  if (title !== lastTitle) {
    lastTitle = title
    sendState()
    setTimeout(sendQueue, 300) // wait for YTM to update the selected item
  }
  sendQueue() // no-op if nothing changed
}, 1000)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndWatchVideo, { once: true })
} else {
  findAndWatchVideo()
}
