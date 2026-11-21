"""Prépare le site de l'app « Croix glorieuse » (app.croix-glorieuse.org) dans espace/site/.
Usage : python3 generer.py "https://script.google.com/macros/s/…/exec"
"""
import json, pathlib, shutil, sys
URL = sys.argv[1] if len(sys.argv) > 1 else "COLLER_ICI_L_ADRESSE_DU_SCRIPT"
ici = pathlib.Path(__file__).parent
site = ici / "site"
site.mkdir(exist_ok=True)
(site / "index.html").write_text((ici / "index.html").read_text(encoding="utf-8").replace("__URL_SCRIPT__", json.dumps(URL)), encoding="utf-8")
for f in ("sw.js", "manifest.webmanifest"):
    shutil.copy(ici / f, site / f)
for f in ("icon-192.png", "icon-512.png", "icon-maskable.png", "apple-touch-icon.png"):
    shutil.copy(ici.parent / "app" / "public" / f, site / f)
(site / "CNAME").write_text("app.croix-glorieuse.org\n", encoding="utf-8")
(site / ".nojekyll").write_text("", encoding="utf-8")
(site / "404.html").write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/">', encoding="utf-8")
print("✓ site prêt :", site)
