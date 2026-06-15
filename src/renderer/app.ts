interface QueueItem {
  title: string
  artist: string
  duration: string
  selected: boolean
}

interface WinampAPI {
  toggleYtmWindow: () => void
  minimize: () => void
  resizeSkin: (height: number) => void
  onState: (cb: (state: PlayerState) => void) => void
  onQueue: (cb: (items: QueueItem[]) => void) => void
  play: () => void
  pause: () => void
  next: () => void
  prev: () => void
  seek: (pct: number) => void
  setVolume: (vol: number) => void
  clickQueueItem: (index: number) => void
}

interface PlayerState {
  title: string
  artist: string
  artUrl: string
  currentTime: number
  duration: number
  paused: boolean
  volume: number
}

declare global { interface Window { winamp: WinampAPI } }

const api: WinampAPI = window.winamp ?? {
  toggleYtmWindow: () => {}, minimize: () => {}, resizeSkin: () => {},
  onState: () => {}, onQueue: () => {},
  play: () => {}, pause: () => {}, next: () => {}, prev: () => {},
  seek: () => {}, setVolume: () => {}, clickQueueItem: () => {},
}
// ── Window controls ────────────────────────────────────────────────────────
document.getElementById('btn-close')?.addEventListener('click', () => window.close())
document.getElementById('btn-minimize')?.addEventListener('click', () => api.minimize())

// ── YTM window toggle ──────────────────────────────────────────────────────
const btnYtm = document.getElementById('btn-ytm')
let ytmVisible = false
btnYtm?.addEventListener('click', () => {
  api.toggleYtmWindow()
  ytmVisible = !ytmVisible
  btnYtm.classList.toggle('active', ytmVisible)
})

// ── Transport buttons ──────────────────────────────────────────────────────
function flashActive(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.add('active')
  setTimeout(() => el.classList.remove('active'), 120)
}

document.getElementById('btn-play')?.addEventListener('click',  () => { api.play();  flashActive('btn-play')  })
document.getElementById('btn-pause')?.addEventListener('click', () => { api.pause(); flashActive('btn-pause') })
document.getElementById('btn-stop')?.addEventListener('click',  () => { api.pause(); flashActive('btn-stop')  })
document.getElementById('btn-next')?.addEventListener('click',  () => { api.next();  flashActive('btn-next')  })
document.getElementById('btn-prev')?.addEventListener('click',  () => { api.prev();  flashActive('btn-prev')  })

// ── Seek bar ───────────────────────────────────────────────────────────────
const seekBar = document.getElementById('seek-bar') as HTMLInputElement | null

let seekDragging = false
seekBar?.addEventListener('mousedown', () => { seekDragging = true })
document.addEventListener('mouseup',   () => { seekDragging = false })
seekBar?.addEventListener('change', () => api.seek(Number(seekBar!.value)))

// ── Volume slider ──────────────────────────────────────────────────────────
const volumeBar = document.getElementById('volume-bar') as HTMLInputElement | null
volumeBar?.addEventListener('input', () => api.setVolume(Number(volumeBar!.value) / 100))

// ── Digit time display ─────────────────────────────────────────────────────
function setDigit(id: string, n: number) {
  const el = document.getElementById(id)
  if (el) el.className = `digit d${Math.min(9, Math.max(0, n))}`
}

function setTime(totalSeconds: number) {
  const s   = Math.max(0, Math.floor(isFinite(totalSeconds) ? totalSeconds : 0))
  const m   = Math.floor(s / 60) % 100
  const sec = s % 60
  setDigit('d1', Math.floor(m / 10))
  setDigit('d2', m % 10)
  setDigit('d3', Math.floor(sec / 10))
  setDigit('d4', sec % 10)
}

// ── Marquee scrolling ──────────────────────────────────────────────────────
const marqueeWrap  = document.getElementById('marquee-wrap')!
const trackTitleEl = document.getElementById('track-title')!

function applyMarquee(text: string) {
  trackTitleEl.textContent = text
  trackTitleEl.classList.remove('scrolling')
  trackTitleEl.style.removeProperty('--scroll-px')

  requestAnimationFrame(() => {
    const overflow = trackTitleEl.scrollWidth - marqueeWrap.clientWidth
    if (overflow > 4) {
      trackTitleEl.style.setProperty('--scroll-px', `-${overflow + 20}px`)
      trackTitleEl.classList.add('scrolling')
    }
  })
}

// ── State updates from YTM ─────────────────────────────────────────────────
const playPauseEl = document.getElementById('play-pause')!
let lastTitle = ''

api.onState((state: PlayerState) => {
  // Marquee: "ARTIST - TITLE" or just title
  const label = [state.artist, state.title].filter(Boolean).join(' - ').toUpperCase()
    || 'NO MEDIA LOADED'
  if (label !== lastTitle) {
    lastTitle = label
    applyMarquee(label)
  }

  // Digit time
  setTime(state.currentTime)

  // Play/pause indicator
  playPauseEl.classList.toggle('playing', !state.paused)

  // Seek bar position (only when not dragging)
  if (seekBar && !seekDragging && state.duration > 0) {
    seekBar.value = String((state.currentTime / state.duration) * 100)
  }

  // Volume knob (sync from YTM)
  if (volumeBar && !volumeBar.matches(':active')) {
    const vol = state.volume ?? 0.75
    volumeBar.value = String(Math.round(vol * 100))
    volumeBar.style.setProperty('--vol-y', `${-Math.round(vol * 29) * 14}px`)
  }
})

// ── Queue updates from YTM ─────────────────────────────────────────────────
const queueList  = document.getElementById('queue-list')
const queueCount = document.getElementById('queue-count')

api.onQueue((items: QueueItem[]) => {
  if (!queueList) return
  queueList.innerHTML = ''

  if (queueCount) {
    queueCount.textContent = items.length ? `${items.length} tracks` : ''
  }

  items.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'queue-item' + (item.selected ? ' playing' : '')

    const numEl = document.createElement('span')
    numEl.className = 'qi-num'
    numEl.textContent = `${index + 1}.`

    const nameEl = document.createElement('span')
    nameEl.className = 'qi-name'
    nameEl.textContent = item.artist && item.title
      ? `${item.artist} - ${item.title}`
      : item.title || item.artist || '(unknown)'

    const durEl = document.createElement('span')
    durEl.className = 'qi-duration'
    durEl.textContent = item.duration

    row.append(numEl, nameEl, durEl)
    row.addEventListener('click', () => api.clickQueueItem(index))
    queueList.appendChild(row)
  })

  queueList.querySelector('.playing')?.scrollIntoView({ block: 'nearest' })
})

// ── Boot ───────────────────────────────────────────────────────────────────
setTime(0)  // show 0:00 digits on startup
