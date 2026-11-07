#!/usr/bin/env python3
"""Build the social card at `public/og.png`.

Run it from the repo root:

    python3 tools/og-card/build.py

The card is 1200 by 630 pixels. It carries the avatar, the handle, the site
address, and a two line tagline.

`avatar.png` beside this script holds the 158 by 158 avatar tile. Replace that
file when the avatar art changes.

ImageMagick draws the text, so the glyphs match the card that ships in the
repo. Each run lands by its ink box, which keeps a run centred when a word
changes case or length.

Dependencies: python3, Pillow, ImageMagick 7 (`magick`), and the DejaVu Sans
Mono font at FONT below.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import NamedTuple

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "public" / "og.png"
AVATAR = HERE / "avatar.png"
FONT = "/usr/share/fonts/TTF/DejaVuSansMono.ttf"
MAGICK = "magick"

CARD = (1200, 630)
BG = "#080b09"
RULE = "#1f3a24"
HANDLE_INK = "#b6f2b1"
ADDRESS_INK = "#78e16b"
TAGLINE_INK = "#84b289"

# The outer rule, 4 px thick, drawn inside these edges.
RULE_BOX = (2, 2, 1197, 627)
RULE_WIDTH = 4
# The avatar frame, 2 px thick, with the 158 by 158 tile inside it.
FRAME_BOX = (110, 108, 271, 269)
FRAME_WIDTH = 2
AVATAR_AT = (112, 110)

# The scratch canvas that holds one rendered run.
RENDER_SIZE = (1600, 400)
RENDER_PAD = 40
RENDER_BASELINE = 200


class Run(NamedTuple):
    """One run of text, placed by its ink box.

    Give `left`, or give `centre` to centre the run. Always give `top`.
    """

    text: str
    pointsize: int
    colour: str
    top: int
    left: int | None = None
    centre: int | None = None


# @JoeOfSomeTrades starts the handle, joeofsometrades.com sits under it on the
# same left edge, and the two tagline lines sit centred below.
#
# The tagline does not name this site. It names the trades, so it stays in the
# card alone.
#
# 373 and 461 put the two tagline ink tops 88 px apart.
RUNS = (
    Run("@JoeOfSomeTrades", 82, HANDLE_INK, top=110, left=310),
    Run("joeofsometrades.com", 63, ADDRESS_INK, top=208, left=310),
    Run("IT · Music · Audio", 64, TAGLINE_INK, top=373, centre=600),
    Run("Game Design", 64, TAGLINE_INK, top=461, centre=600),
)


def render(run: Run, scratch: Path) -> Image.Image:
    """Draw one run on a transparent canvas with ImageMagick."""
    out = scratch / "run.png"
    subprocess.run(
        [
            MAGICK,
            "-size", "{}x{}".format(*RENDER_SIZE),
            "xc:none",
            "-font", FONT,
            "-pointsize", str(run.pointsize),
            "-fill", run.colour,
            "-annotate", "+{}+{}".format(RENDER_PAD, RENDER_BASELINE),
            run.text,
            str(out),
        ],
        check=True,
    )
    return Image.open(out).convert("RGBA")


def ink_box(run: Image.Image) -> tuple[int, int, int, int]:
    """The box of the fully inked pixels.

    The antialiased fringe sits outside this box. So the box holds the pixels
    a reader sees as solid ink, and it moves only when a run really moves.
    """
    mask = run.getchannel("A").point(lambda v: 255 if v == 255 else 0)
    box = mask.getbbox()
    if box is None:
        raise SystemExit("nothing was drawn for this run")
    return box


def place(card: Image.Image, run: Image.Image, spec: Run) -> None:
    left, top, right, bottom = ink_box(run)
    if spec.centre is not None:
        x = round(spec.centre - (left + right + 1) / 2)
    else:
        x = spec.left - left
    card.paste(run, (x, spec.top - top), run.getchannel("A"))


def main() -> None:
    if shutil.which(MAGICK) is None:
        raise SystemExit("{} is not on PATH".format(MAGICK))

    card = Image.new("RGB", CARD, BG)
    draw = ImageDraw.Draw(card)
    draw.rectangle(RULE_BOX, outline=RULE, width=RULE_WIDTH)
    draw.rectangle(FRAME_BOX, outline=RULE, width=FRAME_WIDTH)
    card.paste(Image.open(AVATAR).convert("RGB"), AVATAR_AT)

    with tempfile.TemporaryDirectory() as work:
        scratch = Path(work)
        for spec in RUNS:
            place(card, render(spec, scratch), spec)

    card.save(OUT)
    print("wrote {} at {}x{}".format(OUT, *CARD))


if __name__ == "__main__":
    main()
