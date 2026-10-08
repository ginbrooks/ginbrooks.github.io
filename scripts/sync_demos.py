#!/usr/bin/env python3
"""Copy only the public demos and record their exact source revisions."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "book": {"repo": "ginbrooks/book-wiki-reader-skill", "files": ["index.html"]},
    "shipping": {"repo": "ginbrooks/shipping-document-workbench", "files": ["index.html", "app.js", "style.css", "data.js"] + [f"sources/{scenario}/{filename}" for scenario in ("problem", "corrected") for filename in ("SYNTHETIC-invoice.txt", "SYNTHETIC-packing-list.txt", "SYNTHETIC-carrier-return.txt")]},
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--book-repo", type=Path, required=True)
    parser.add_argument("--shipping-repo", type=Path, required=True)
    args = parser.parse_args()
    pending = []
    manifest = {}
    for name, spec in SOURCES.items():
        checkout = getattr(args, name + "_repo").expanduser().resolve()
        revision = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        if subprocess.check_output(["git", "-C", str(checkout), "status", "--porcelain", "--", "docs/demo"], text=True):
            parser.error(f"{name}: commit demo changes before copying them")
        files = [(checkout / "docs/demo" / filename, ROOT / "demos" / name / filename) for filename in spec["files"]]
        files.append((checkout / "docs/demo/screenshot.png", ROOT / "assets" / (name + "-preview.png")))
        for source, destination in files:
            if not source.is_file():
                parser.error(f"Missing public demo file: {source}")
            pending.append((source, destination))
        manifest[name] = {"repository": "https://github.com/" + spec["repo"], "commit": revision,
                          "source_path": "docs/demo", "content": "original/synthetic public demonstration"}
    for source, destination in pending:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    (ROOT / "DEMO_SOURCES.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Copied public demos and actual screenshots; recorded both source revisions.")


if __name__ == "__main__":
    main()
