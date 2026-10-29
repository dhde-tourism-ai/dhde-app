/**
 * English and Arabic names for bus routes, bus stops and stations (the feeds only
 * publish Japanese): English built by scripts/build_transport_en.py, Arabic
 * transliterated from the English. A name the list doesn't have yet (a stop added
 * since) stays in Japanese.
 */
import type { Lang } from './i18n'
import EN from '../i18n/transport.en.json'
import AR from '../i18n/transport.ar.json'

const ROUTES: Record<string, string> = EN.routes
const PLACES: Record<string, string> = EN.places
const ROUTES_AR: Record<string, string> = AR.routes
const PLACES_AR: Record<string, string> = AR.places

export const routeEn = (ja: string): string => ROUTES[ja] ?? ja
export const placeEn = (ja: string): string => PLACES[ja] ?? ja

/** A stop or station name in `lang`: Japanese as published, else Arabic or English from the lists. */
export const placeName = (lang: Lang, ja: string): string =>
  lang === 'ja' ? ja : lang === 'ar' ? (PLACES_AR[ja] ?? placeEn(ja)) : placeEn(ja)

/** A bus route name in `lang`. */
export const routeName = (lang: Lang, ja: string): string =>
  lang === 'ja' ? ja : lang === 'ar' ? (ROUTES_AR[ja] ?? routeEn(ja)) : routeEn(ja)
