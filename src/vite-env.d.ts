/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional origin for live data, e.g. a CloudFront URL. Files load from `${VITE_DATA_BASE_URL}/data/<file>`. */
  readonly VITE_DATA_BASE_URL?: string
  /** Optional root of the preprocessing repo's live-data history (default: its GitHub live-data branch). */
  readonly VITE_LIVE_DATA_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
