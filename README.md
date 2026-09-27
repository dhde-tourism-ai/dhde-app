# dhde-app

The DHDE product for Fukui tourism: one app with three views that share one data layer.

- **Map**: the priority nodes with actual (solid) vs predicted (dashed ring) visitors, congestion tier, and an economics layer (visitors, revenue and opportunity lost per node and town).
- **Nodes**: per-node dashboards with the daily forecast (Dina Belay's dashboard, carried over from dhde-fukui-tourism-dashboard).
- **Strategy**: Gabriella Gunarto's five strategic questions (what tourism is worth, visitor flow, visitor value, leaks, returns).

Every number shows its status: Real, Modelled, Illustrative or Pending. Pending values display as "[pending]", never as a made-up number.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type check + production build into dist/
npm run lint
```

## Data

The app only reads JSON from `public/data/`. It does no data processing.

| File | Produced by | Contents |
|---|---|---|
| `dashboard_data.json` | pipeline (publish step) | per-node daily actuals and forecasts |
| `nodes.json` | node registry (from dhde-preprocessing-model configs) | node ids, names, coordinates, prefecture, measure type |
| `regional_economics.json` | dhde-ai-demo `economics/build_regional_economics.py` | visitors, revenue, opportunity lost per node and region |
| `strategic_questions.json` | strategy team | numbers and statuses for the Strategy view |

The files here are snapshots so the app runs on its own. In production the pipeline publishes them next to the app.

Known data caveat: JTA monthly figures for Fukui municipalities jump sharply from March 2026. Check them before quoting any town-level number.

## Related repos

- `dhde-preprocessing-model`: raw sources to clean per-node tables
- `dhde-terraform-aws`: AWS infrastructure (EventBridge, Lambda, S3, CloudFront, playground EC2)
- `dhde-ai-demo`: the original single-file demo map (showcase)
- `dhde-fukui-tourism-dashboard`: the research repo behind the published paper
