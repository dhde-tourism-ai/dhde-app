# Scoped site builds

Run `npm run build:site -- <site>` and `node scripts/check_site_dist.mjs <site>`
for `tojinbo`, `eiheiji`, `rainbow_line` or `katsuyama`. Output goes to `dist/<site>/`.
Build the full app first with `npm run build`, which clears dist. Pages builds
all four sites. Japanese is the default unless a language preference is saved.

`scripts/scope_site_data.mjs` selects files and filters node records to the
selected id, retaining baseline field structures. It removes fictional posts,
review snippets, simulated movement and legacy dashboard totals. Transport
routes, stops, rail geometry and trip indexes use the baseline data without
geographic clipping. Node records and walking areas retain only the selected
site. The initial viewport uses the site's baseline geometry.

`src/lib/siteMode.ts` removes demo fallbacks and gates layers using real-source
lists. Economics is excluded because it required separate site and town mappings.
Flow, traffic, nudges, density and illustrative vehicles remain excluded.
Reviews have no snippets and social has no posts. Missing weather, hotel and
forecast dates stay hidden. Daily totals stay constant across hours, and forecast
availability follows the baseline merge's model selection. The survey proxy
retains its low-confidence wording. The existing normal-day capacity comparison
remains because removing it would expose baseline demo capacity.

The site-only Map / Forecast tabs are removed. The baseline forecast page remains
available through the map's detail link and `#/site/<site>`. Full-app navigation
and behavior are unchanged. Site layer preferences use `dhde.layers.<site>`;
the full app uses `dhde.layers`.

Data loads from the local snapshot. Hourly weather and JMA warnings use the
existing external feeds. The distribution check rejects other configured partner-site ids
as JSON keys or `id` values. It does not scan JavaScript, aliases or numeric
fingerprints. Shared baseline geometry and transit infrastructure remain bundled.
GitHub Pages is public, so scoping is not access control.

To add a site, add its market feed mappings to `scripts/site-config.mjs` and use
its baseline geometry in `src/lib/sites.ts`. Build and check the full app and all
sites, and inspect their initial bounds.
