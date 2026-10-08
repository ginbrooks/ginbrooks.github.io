# ginbrooks / works

A small, static portfolio for three practical products: Book Wiki Reader, Shipping Document Workbench, and Trading Assistant.

## Run locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. No package installation, model credentials, analytics, or external assets required.

## Projects

- [Book Wiki Reader](https://github.com/ginbrooks/book-wiki-reader-skill): local text import and archival, a portable reading workspace, and a Codex co-reading skill.
- [Shipping Document Workbench](https://github.com/ginbrooks/shipping-document-workbench): review-first export-document workflows, deterministic calculations, and a public synthetic-data preflight demo.
- Trading Assistant: API-driven trade data organization, cumulative realized PnL, entry/exit chart markers, and notes attached to trades. The current private review integration supports Binance USD-M with manually triggered updates; multi-platform aggregation and continuous real-time synchronization are not yet connected. The public interactive demo is independently written with synthetic data.

The `demos/` directory contains self-contained public examples. Book and Shipping demos are copied from their public source repositories; Trading Assistant is authored separately for this portfolio and contains no private implementation code. Examples use original/synthetic content. They do not connect to private libraries, customer records or production services. Capability details and limitations live in each project's README.

## Publish on GitHub Pages

Use repository `ginbrooks.github.io`. In **Settings → Pages**, publish from branch `main`, folder `/ (root)`. The canonical homepage will be `https://ginbrooks.github.io/` once Pages is enabled and deployment succeeds.

## Maintain

Refresh the demos from their source repos after changes, update the actual screenshots in `assets/`, then check both desktop and mobile layouts. `DEMO_SOURCES.json` records which source commits were used.

After committing updated public demos in both source checkouts, synchronize with:

```sh
python3 scripts/sync_demos.py \
  --book-repo ../book-wiki-reader-skill \
  --shipping-repo ../shipping-document-workbench
```

The synchronization script copies a fixed allowlist from `docs/demo/` and refuses uncommitted demo changes. It never reads book libraries or shipping production data.

Trading demo source lives directly in `demos/trading/`; its own README and Node tests document the sample and verify sample calculations and note structure. It does not use the private application API or implementation. The existing sync script preserves its provenance entry.
