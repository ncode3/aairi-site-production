"""Stage only the public website, keeping operational files out of deployments."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "dist"


def build():
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    DESTINATION.mkdir()
    files = list(ROOT.glob("*.html")) + [
        ROOT / name for name in ("robots.txt", "sitemap.xml", "staticwebapp.config.json")
    ]
    for source in files:
        shutil.copy2(source, DESTINATION / source.name)
    for name in ("assets", "images"):
        shutil.copytree(ROOT / name, DESTINATION / name)
    print(f"Staged {sum(p.is_file() for p in DESTINATION.rglob('*'))} public files in dist")


if __name__ == "__main__":
    build()
