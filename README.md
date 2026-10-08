# ginbrooks / works

A small, static portfolio for two practical public projects: Book Wiki Reader and Shipping Document Workbench.

## Run locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. No package installation, model credentials, analytics, or external assets required.

## Projects

- [Book Wiki Reader](https://github.com/ginbrooks/book-wiki-reader-skill): local text import and archival, a portable reading workspace, and a Codex co-reading skill.
- [Shipping Document Workbench](https://github.com/ginbrooks/shipping-document-workbench): review-first export-document workflows, deterministic calculations, and a public synthetic-data preflight demo.

The `demos/` directory contains self-contained public examples copied from the source repositories. Examples use original/synthetic content. They do not connect to private libraries, customer records or production services. Capability details and limitations live in each project's README.

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
