# Scoped partner builds

Run `npm run build:site -- tojinbo`, then `node scripts/check_site_dist.mjs tojinbo`.
The build runner passes VITE_SITE to TypeScript/Vite and generates a separate public
snapshot. The normal `npm run build` still writes index.html, assets/ and data/ at
the dist root. Site builds write dist/<site>/ and preserve that root build.

## Snapshot rules

`scripts/site-config.mjs` defines targets, town/feed mappings and a 12 km clipping
radius. `scripts/scope_site_data.mjs` allowlists files, so adding a source file does
not silently publish it in partner builds:

- nodes.json: one registry node.
- real_data.json: one node, shared_date from its visitor date.
- live_demo.json: one neutral timeline template, no movement, traffic, advisories
  or warnings. The runtime replaces daily visitor totals and published forecasts.
- market_voice_demo.json: neutral survey/social/review templates; no text snippets
  or posts. Only the site's hotel feed and search municipality are retained.
- dashboard_data.json: empty legacy dashboard and aggregate containers; this old
  snapshot is not used for partner metrics.
- routes.json: empty. Congestion profiles and movements use simulated inputs.
- transport.json: one site's access timetable; source operators filtered to its
  routes. Hub journey descriptions remain public timetable access information.
- transport_map.json: routes serving the site, clipped to the radius box; stops
  and railway stations inside that box; clipped railway paths; one walking area.
- transport_trips.json: serving routes only, stop arrays and trip indices rebuilt
  to include only stops inside the box.
- regional_economics.json: the site's node and its municipality only. No prefecture
  aggregates, comparison regions, external points, shared assumptions or flows.
  Municipality totals cover the whole town and economics is labelled modelled.
- All other JSON files are omitted, including strategy, monthly forecasts,
  transport market/modes/trends and hotel nudge thresholds. Favicon is copied.

`src/lib/siteMode.ts` cleans the merged result and controls layer availability.
Site snapshots are always loaded locally through dataSource.ts. Only the site's
hourly weather CSV/Open-Meteo point and the public JMA warning feed are requested
externally. No CloudFront data is used. Site geometry modules are selected through
static VITE_SITE comparisons and other site geometry is removed by the bundler.
The dist check rejects other priority IDs anywhere in JSON and distinctive other
site geometry coordinates in JavaScript.

## Tojinbo behaviour

The existing MapView is reused with site geometry and street-level bounds. The
shell has Map and Forecast, defaults to Japanese unless a preference is stored,
and keeps English and Arabic. Invalid routes return to Map. Forecast retains
SiteView, SiteData and SiteTransit. The separate Transport dashboard is omitted
because its market, mode-share and Trends panels cover the wider prefecture.

Initial layers: People, Weather, Bus routes, Train routes, Survey, Social,
Reviews, Sentiment. Hotels and Search intent can be enabled when their real feed
is present. Hotels omit dates without real occupancy. Economics is optional and
labelled modelled. The map keeps basemaps, selection/drawer, cards, live board,
status strip, responsive panels and timeline. Weather cards/drawer/tint require a
real hourly source. Daily weather remains available in the forecast page.

People uses daily estimates and published model forecasts held constant across
hours, without simulated hourly footfall. Daily charts sum to the daily total.
Crowd alerts compare actual daily estimates with the site's real normal-day mean.
The normal-day ratio is not a measured physical site capacity. Model forecasts
are estimates. Missing published forecasts do not invoke the main app's naive
forecast. Reviews keep published aggregates and omit snippets; surveys without
real detail are omitted; social retains counts and model-scored sentiment only.

Excluded: People flow, Traffic, Action nudges, demo warnings/advisories, fictional
reviews/posts, regional density and illustrative vehicle motion. Traffic is
excluded because its congestion curves are simulated even where daily counters
exist. Density is unnecessary for a single site and is not independently
measured. Rail infrastructure remains; illustrative trains are excluded. CSS
animations are disabled within the site shell.

## Other targets and follow-up

Only Tojinbo is in the Pages loop for now.

- Eiheiji compiles, but the isolation check rejects nearby transit IDs containing
  katsuyama in transport_map.json. Resolve public operator/line identifiers without
  weakening private node isolation, then check bounds and layers in a browser.
  No model forecast is published. Keep the low-confidence survey-proxy count and
  suspect Rakuten 0/0/100 shares visible; do not fabricate a forecast.
- Rainbow Line compiles and passes isolation with the shared mechanism. It is not
  deployed until Eiheiji also passes, as requested. Browser-check the long road
  bounds and P1/P2 geometry. Calibration remains the source's P1/P2 vehicles x 6.98.
- Review missing-data presentation at timeline dates outside published forecasts,
  and the distinction between daily counts and hourly on-site occupancy before
  adding private data. The shared normal-day terminology in some tooltips still
  inherits main-map crowd tiers.

## Verification

Full build, lint, Japanese-string check, check_data.mjs and check_transport.mjs
pass. The full root data-file inventory matches public/data. Tojinbo build and
dist isolation pass; grep for all five other priority IDs returns no matches.
Browser sanity check through Vite preview confirmed forecast page, map, real cards, layer
switches and economics render. Network inspection confirmed scoped local data and
only Tojinbo's hourly weather point. No demo badge appeared after cleanup.
Vite reports its usual large-chunk advisory for the shared map bundle.

## Files changed

- `.github/workflows/pages.yml`: Build and check Tojinbo after the full app.
- `.gitignore`: Ignore generated public snapshots.
- `docs/site-builds.md`: Document scoping, verification and follow-up work.
- `package.json`: Add the site build command.
- `scripts/build_site.mjs`: Generate a snapshot and run the flagged production build.
- `scripts/check_site_dist.mjs`: Reject foreign node IDs and geometry in site artifacts.
- `scripts/scope_site_data.mjs`: Apply the explicit per-file scoping rules.
- `scripts/site-config.mjs`: Define supported sites, town/feed mappings and geographic radius.
- `src/App.tsx`: Add site branding and navigation, excluding unrelated view chunks.
- `src/components/SourceBadge.tsx`: Show source badges only for included real site layers.
- `src/hooks/useHashRoute.ts`: Redirect inapplicable partner routes to Map.
- `src/hooks/useProductData.ts`: Apply site cleanup and skip strategy loading.
- `src/lib/alerts.ts`: Build site crowd alerts from real daily totals.
- `src/lib/dataSource.ts`: Disable CloudFront loading in site mode.
- `src/lib/live.ts`: Mark timeline dates without counts or published forecasts as unavailable.
- `src/lib/i18n.ts`: Default flagged builds to Japanese.
- `src/lib/siteGeometry/eiheiji.ts`: Separate this site geometry so other builds can discard it.
- `src/lib/siteGeometry/rainbow_line.ts`: Separate this site geometry so other builds can discard it.
- `src/lib/siteGeometry/tojinbo.ts`: Separate this site geometry so other builds can discard it.
- `src/lib/siteMode.ts`: Clean merged data and gate real site layers.
- `src/lib/siteTypes.ts`: Keep shared geometry types and provenance.
- `src/lib/sites.ts`: Select geometry through static build branches.
- `src/styles/base.css`: Disable continuous animations within site builds.
- `src/views/map/MapView.tsx`: Reuse the full map with site bounds, geometry and scoped controls.
- `src/views/map/layers/PeopleLayer.tsx`: Describe site counts as daily totals.
- `src/views/map/layers/WeatherLayer.tsx`: Require real hourly weather for site detail.
- `src/views/map/layers/cardRows.ts`: Omit weather rows without real hourly readings.
- `src/views/map/panels/AlertsPanel.tsx`: Remove unsupported traffic/operator claims in site mode.
- `src/views/map/panels/LayersPanel.tsx`: Expose allowed layers with site-specific explanations.
- `src/views/map/panels/NodeDrawer.tsx`: Keep real site detail and label daily totals.
- `src/views/map/panels/TransportLegend.tsx`: Avoid the omitted illustrative Trends resource.
- `vite.config.ts`: Select scoped public and output directories.
