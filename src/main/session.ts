import { session } from 'electron'

const YTM_PARTITION = 'persist:ytmusic'

const CHROME_VERSION = '128'
const CHROME_FULL_VERSION = '128.0.6613.186'

// UA without "Electron" to avoid Google's "this browser may not be secure" block.
export const CHROME_UA =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ` +
  `AppleWebKit/537.36 (KHTML, like Gecko) ` +
  `Chrome/${CHROME_FULL_VERSION} Safari/537.36`

// Client-hints headers that match a real Chrome on macOS
const CH_UA = `"Chromium";v="${CHROME_VERSION}", "Not;A=Brand";v="24", "Google Chrome";v="${CHROME_VERSION}"`

export function createYtmSession(): Electron.Session {
  const ytmSession = session.fromPartition(YTM_PARTITION, { cache: true })

  ytmSession.setUserAgent(CHROME_UA)

  // Spoof sec-ch-ua headers so Google sees real Chrome, not Electron
  ytmSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    headers['User-Agent'] = CHROME_UA
    headers['sec-ch-ua'] = CH_UA
    headers['sec-ch-ua-mobile'] = '?0'
    headers['sec-ch-ua-platform'] = '"macOS"'
    headers['sec-ch-ua-platform-version'] = '"15.5.0"'
    headers['sec-ch-ua-full-version-list'] = CH_UA
    callback({ requestHeaders: headers })
  })

  return ytmSession
}
