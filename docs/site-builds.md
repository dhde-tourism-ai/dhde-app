# Scoped site builds

Run `npm run build:site -- <site>` and `node scripts/check_site_dist.mjs <site>`.
Supported sites are `tojinbo`, `eiheiji` and `rainbow_line`. Output goes to
`dist/<site>/`. Run the full `npm run build` first when building all outputs;
it clears dist. Site builds preserve the root app. Pages builds all three sites.
Japanese is the default unless the browser has a saved language preference.

## Scoping and layers

`scripts/site-config.mjs` defines sites, municipality and hotel feeds, and the
12 km transport clipping radius. `scripts/scope_site_data.mjs` allowlists files
and retains one site's node, real history, forecasts and market data. Neutral
templates provide array shapes only. Routes and legacy dashboard totals are
empty. Transport keeps serving routes and nearby public infrastructure.
Economics keeps the site and its municipality, with modelled totals labelled.
Regional strategy, comparisons, demo posts and other unlisted files are omitted.

`src/lib/siteMode.ts` removes demo fallbacks and gates layers against the merged
real-source lists. `src/lib/sites.ts` selects geometry from `siteGeometry/` so
Vite removes other sites' geometry. `scripts/check_site_dist.mjs` rejects foreign
priority IDs as keys, whole values or hyphen-separated ID segments and checks
JavaScript for foreign geometry. Public transit identifiers containing a site's
name as a substring are allowed. Data loads from the local scoped snapshot;
hourly weather and public JMA warnings use their existing external feeds.

| Site | Shown when backed by real data | Initial map extent |
| --- | --- | --- |
| Tojinbo | People, weather, bus and rail infrastructure, survey, social, reviews, sentiment. Hotels, search intent and modelled economics are optional. | Cliffs and pedestrian approach with nearby stop context. |
| Eiheiji | People as a low-confidence survey proxy, weather, bus and rail infrastructure, survey, social, reviews, sentiment. Search intent and modelled economics are optional. | Temple precinct and monzen approach with nearby bus stops. Zoom out for Eiheiji-guchi. |
| Rainbow Line | People from summit P1/P2 vehicles x 6.98, weather, bus and rail infrastructure, survey, social, reviews, sentiment. Hotels, search intent and modelled economics are optional. | Entire toll road and both summit car parks. |

The real-source lists decide availability as data changes. Eiheiji's map hotel
layer is excluded because the shared coast feed maps to another node. Its
forecast page retains its own published hotel records. Eiheiji has no model forecast;
missing days show no estimate and never use a naive forecast. Its forecast page
labels the survey proxy's low confidence and keeps the published Rakuten
0%/0%/100% block visible despite the questionable shares.

All sites exclude people flow, traffic, action nudges, regional density,
illustrative vehicles and demo advisories. Movement and traffic curves are
simulated; density is not independently measured for one site. Reviews omit
snippets and social omits posts. People values are daily totals, held constant
across hours. Missing weather and hotel dates stay hidden. Continuous CSS
animations are disabled within the site shell.

## Adding a site

Add its feed mappings to `scripts/site-config.mjs`, geometry under
`src/lib/siteGeometry/`, and a static selection branch in `src/lib/sites.ts`.
Check the real-source lists and initial bounds at desktop and phone widths.
Add distinctive geometry fingerprints to `scripts/check_site_dist.mjs` and the
site ID to its priority list. Add the site to the single Pages build list.
Build and check both the full app and every scoped site after changes.
