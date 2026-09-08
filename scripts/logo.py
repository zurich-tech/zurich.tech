from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent


def generate():
    """Extract the wordmark’s lowercase z and pair it with the same square punctuation."""
    font_path = (
        ROOT
        / "node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2"
    )
    font = instantiateVariableFont(TTFont(font_path), {"wght": 800})
    glyphs = font.getGlyphSet()
    pen = SVGPathPen(glyphs)
    glyphs["z"].draw(pen)

    # keep the square at the wordmark’s 0.24 em size and align it with the baseline
    drawing = (
        f'<g transform="translate(0 550) scale(1 -1)"><path d="{pen.getCommands()}"/>'
        '<path d="M600 0h240v240H600z"/></g>'
    )
    logo = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 -30 840 610" fill="currentColor" aria-hidden="true">{drawing}</svg>'
    favicon = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#174ed8" d="M0 0h64v64H0z"/><svg x="3" y="10" width="58" height="44" viewBox="40 -30 840 610" fill="white">{drawing}</svg></svg>'
    (ROOT / "src/assets/logo.svg").write_text(logo)
    (ROOT / "public/favicon.svg").write_text(favicon)


if __name__ == "__main__":
    generate()
