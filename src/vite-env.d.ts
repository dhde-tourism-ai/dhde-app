/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional origin for live data, e.g. a CloudFront URL. Files load from `${VITE_DATA_BASE_URL}/data/<file>`. */
  readonly VITE_DATA_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
