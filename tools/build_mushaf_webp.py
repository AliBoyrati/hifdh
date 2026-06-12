from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "Quran_Madinah_night_jp2"
OUT_DIR = ROOT / "mushaf" / "pages"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(SRC_DIR.glob("Quran_Madinah_night_*.jp2"))
    for page, source in enumerate(sources, start=1):
        out = OUT_DIR / f"{page:03d}.webp"
        if out.exists() and out.stat().st_mtime >= source.stat().st_mtime:
            continue
        image = Image.open(source).convert("RGB")
        image.save(out, quality=82, method=6)
        if page % 100 == 0 or page == len(sources):
            print(f"{page}/{len(sources)}")


if __name__ == "__main__":
    main()
