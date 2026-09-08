import json
import math
import sys
from pathlib import Path

from shapely.geometry import LineString, Polygon, box
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
CLIP = box(-6000, -5000, 5600, 5200)


def project(point):
    """Project OpenStreetMap coordinates into metres around central Zürich."""
    return (
        (point["lon"] - 8.538) * 111320 * math.cos(math.radians(47.3715)),
        (47.3715 - point["lat"]) * 111320,
    )


def coordinates(points):
    """Round simplified geographic paths to metre precision."""
    return [[round(x), round(y)] for x, y in points]


def generate(source):
    """Compile a wider Zürich map from an Overpass geometry export."""
    city = {"buildings": [], "water": [], "roads": [], "tracks": []}
    waters = []

    # retain roads and trams while joining complete outer water boundaries
    for element in source["elements"]:
        tags = element.get("tags", {})
        points = [project(point) for point in element.get("geometry", [])]
        if tags.get("natural") == "water":
            if element["type"] == "relation":
                edges = [
                    LineString([project(point) for point in member["geometry"]])
                    for member in element["members"]
                    if member.get("role") == "outer"
                    and len(member.get("geometry", [])) > 1
                ]
                waters.extend(polygonize(unary_union(edges)))
            elif len(points) >= 4:
                waters.append(Polygon(points).buffer(0))
        elif len(points) > 1:
            line = LineString(points).intersection(CLIP).simplify(5)
            segments = [line] if line.geom_type == "LineString" else list(line.geoms)
            category = "tracks" if tags.get("railway") == "tram" else "roads"
            city[category].extend(
                coordinates(segment.coords)
                for segment in segments
                if not segment.is_empty
            )

    # merge overlapping lake and river records before clipping the regional extent
    water = unary_union(waters).intersection(CLIP).simplify(4)
    polygons = [water] if water.geom_type == "Polygon" else list(water.geoms)
    city["water"] = [
        coordinates(polygon.exterior.coords)
        for polygon in polygons
        if polygon.area > 5000
    ]
    (ROOT / "public/city/region.json").write_text(
        json.dumps(city, separators=(",", ":"))
    )


if __name__ == "__main__":
    generate(json.loads(Path(sys.argv[1]).read_text()))
