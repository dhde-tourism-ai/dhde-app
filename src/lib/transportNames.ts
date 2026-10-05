/**
 * English names for bus routes, bus stops and stations (the feeds only publish
 * Japanese): built by scripts/build_transport_en.py. A name the list doesn't have
 * yet (a stop added since) stays in Japanese.
 */
import EN from '../i18n/transport.en.json'

const ROUTES: Record<string, string> = EN.routes
const PLACES: Record<string, string> = EN.places

export const routeEn = (ja: string): string => ROUTES[ja] ?? ja
export const placeEn = (ja: string): string => PLACES[ja] ?? ja
