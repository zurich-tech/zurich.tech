import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def point(coordinates):
    """Project local metres into the schematic's SVG coordinates."""
    x, y = coordinates

    return f"{(x + 1050) / 5:.1f},{(y + 1160) / 5:.1f}"


def path(points, closed=False):
    """Preserve geographic outlines as compact SVG paths."""
    return "M" + "L".join(map(point, points)) + ("Z" if closed else "")


def generate():
    """Draw real Zürich geometry as an unlabelled circuit schematic."""
    # retain actual water, building, road and tram geometry without place markers
    city = json.loads((ROOT / "public/city/region.json").read_text())
    water = "".join(f'<path d="{path(points, True)}"/>' for points in city["water"])
    buildings = "".join(
        f'<path d="{path(building["points"], True)}"/>'
        for building in city["buildings"]
    )
    roads = "".join(f'<path d="{path(points)}"/>' for points in city["roads"])
    tracks = "".join(f'<path d="{path(points)}"/>' for points in city["tracks"])

    # leave the wordmark room while allowing the lake and river to cross the banner
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1300 -260 3000 1125" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
<g class="map-buildings">{buildings}</g>
<g class="map-roads">{roads}</g>
<g class="map-water">{water}</g>
<g class="map-tracks">{tracks}</g>
</svg>"""
    (ROOT / "src/assets/map.svg").write_text(svg)


if __name__ == "__main__":
    generate()
