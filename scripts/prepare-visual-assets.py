#!/usr/bin/env python3
"""Prepare T09 UI visual assets from the studio's source materials.

Inputs are read-only files under agent_docs/需求1-兽装工作室主页/materials/:

- Hero photo ``picture-examples/领养/小狗/小狗-2-横版.jpg``: center-cropped to
  the recipe-v1 hero ratio (16:9) and resized to 1920 px wide JPEG. The output
  is an internal development sample (EXT-01 pending), so it lands under
  ``public/fixtures/samples/`` where the production content guard still blocks
  it from unguarded production builds.
- Logo lockups ``picture-examples/logo/*.png``: the complete stacked lockup
  (dog icon + "DITE DIANY" + 有点小狗工作室) is extracted. The provided files
  are pure black/white inverses on opaque backgrounds; alpha is recovered by
  luminance keying (black background -> white mark, white background ->
  black mark) so both header states get a transparent full lockup.

Outputs (deterministic, safe to re-run):

- ``public/fixtures/samples/hero-dog-overhead.jpg``
- ``public/brand/logo-full-light.png`` (white lockup for the hero overlay header)
- ``public/brand/logo-full-dark.png`` (dark lockup for light inner headers)
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
MATERIALS = (
    REPO_ROOT
    / "agent_docs"
    / "需求1-兽装工作室主页"
    / "materials"
    / "picture-examples"
)

HERO_SOURCE = MATERIALS / "领养" / "小狗" / "小狗-2-横版.jpg"
LOGO_ON_BLACK = MATERIALS / "logo" / "002FAE22E5236C9A7B7EAAAF3C7D7C5C.png"
LOGO_ON_WHITE = MATERIALS / "logo" / "A123E3922E96E98F45121214D2C28410.png"

HERO_TARGET = REPO_ROOT / "public" / "fixtures" / "samples" / "hero-dog-overhead.jpg"
LOCKUP_LIGHT_TARGET = REPO_ROOT / "public" / "brand" / "logo-full-light.png"
LOCKUP_DARK_TARGET = REPO_ROOT / "public" / "brand" / "logo-full-dark.png"

# recipe-v1 首屏或宽图：16:9，声明宽 1920。
HERO_RATIO = 16 / 9
HERO_WIDTH = 1920

# 完整堆叠 Logo：整幅画布做亮度键控后按 alpha 重裁（内容含狗图标、
# "DITE DIANY" 与中文名），留 4% 内边距。
LOCKUP_PADDING_RATIO = 0.04
LOCKUP_TARGET_HEIGHT = 512


def prepare_hero(target: Path) -> None:
    with Image.open(HERO_SOURCE) as source:
        source = source.convert("RGB")
        width, height = source.size
        crop_height = round(width / HERO_RATIO)
        if crop_height > height:
            raise ValueError(
                f"Source {HERO_SOURCE} is narrower than 16:9 allows: {width}x{height}",
            )
        top = (height - crop_height) // 2
        cropped = source.crop((0, top, width, top + crop_height))
        resized = cropped.resize(
            (HERO_WIDTH, round(HERO_WIDTH / HERO_RATIO)),
            Image.Resampling.LANCZOS,
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        resized.save(target, format="JPEG", quality=85, optimize=True, progressive=True)


def luminance_key(source: Path, dark_mark: bool) -> Image.Image:
    with Image.open(source) as opened:
        rgb = opened.convert("RGB")
    pixels = np.asarray(rgb).astype(np.float64)
    luminance = (
        0.2126 * pixels[:, :, 0] + 0.7152 * pixels[:, :, 1] + 0.0722 * pixels[:, :, 2]
    )
    alpha = 255.0 - luminance if dark_mark else luminance
    fill = 0.0 if dark_mark else 255.0
    rgba = np.dstack(
        [
            np.full_like(alpha, fill),
            np.full_like(alpha, fill),
            np.full_like(alpha, fill),
            alpha,
        ],
    ).astype(np.uint8)
    return Image.fromarray(rgba, mode="RGBA")


def trim_and_resize(mark: Image.Image) -> Image.Image:
    bbox = mark.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Luminance keying produced an empty mark.")
    trimmed = mark.crop(bbox)
    pad = round(trimmed.size[1] * LOCKUP_PADDING_RATIO)
    canvas = Image.new("RGBA", (trimmed.size[0] + 2 * pad, trimmed.size[1] + 2 * pad))
    canvas.paste(trimmed, (pad, pad))
    scale = LOCKUP_TARGET_HEIGHT / canvas.size[1]
    return canvas.resize(
        (round(canvas.size[0] * scale), LOCKUP_TARGET_HEIGHT),
        Image.Resampling.LANCZOS,
    )


def prepare_mark(source: Path, target: Path, dark_mark: bool) -> None:
    mark = trim_and_resize(luminance_key(source, dark_mark))
    target.parent.mkdir(parents=True, exist_ok=True)
    mark.save(target, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()

    for required in (HERO_SOURCE, LOGO_ON_BLACK, LOGO_ON_WHITE):
        if not required.is_file():
            raise FileNotFoundError(f"Missing source material: {required}")

    prepare_hero(HERO_TARGET)
    print(f"hero -> {HERO_TARGET.relative_to(REPO_ROOT)}")

    prepare_mark(LOGO_ON_BLACK, LOCKUP_LIGHT_TARGET, dark_mark=False)
    print(f"light lockup -> {LOCKUP_LIGHT_TARGET.relative_to(REPO_ROOT)}")

    prepare_mark(LOGO_ON_WHITE, LOCKUP_DARK_TARGET, dark_mark=True)
    print(f"dark lockup -> {LOCKUP_DARK_TARGET.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
