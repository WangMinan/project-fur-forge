#!/usr/bin/env python3
"""Extract a deterministic blue palette from a raster reference image.

The script downsamples the image, keeps blue-family pixels in HSV space, builds
a weighted color histogram, and clusters the histogram in CIE Lab space. It is
intended for repeatable design-token evidence, not for editing the source image.
"""

from __future__ import annotations

import argparse
import colorsys
import json
import math
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


@dataclass(frozen=True)
class PaletteColor:
    hex: str
    rgb: tuple[int, int, int]
    blue_pixel_share: float
    image_pixel_share: float


def parse_hex(value: str) -> tuple[int, int, int]:
    normalized = value.strip().removeprefix("#")
    if len(normalized) != 6:
        raise argparse.ArgumentTypeError(f"Expected #RRGGBB, got {value!r}")
    try:
        return tuple(int(normalized[index : index + 2], 16) for index in (0, 2, 4))
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"Expected #RRGGBB, got {value!r}") from error


def to_hex(rgb: Iterable[int]) -> str:
    return "#" + "".join(f"{channel:02x}" for channel in rgb)


def srgb_channel_to_linear(value: float) -> float:
    value /= 255.0
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def rgb_to_lab(rgb: tuple[float, float, float]) -> tuple[float, float, float]:
    red, green, blue = (srgb_channel_to_linear(channel) for channel in rgb)
    x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047
    y = red * 0.2126729 + green * 0.7151522 + blue * 0.0721750
    z = (red * 0.0193339 + green * 0.1191920 + blue * 0.9503041) / 1.08883

    def pivot(value: float) -> float:
        delta = 6 / 29
        return value ** (1 / 3) if value > delta**3 else value / (3 * delta**2) + 4 / 29

    fx, fy, fz = pivot(x), pivot(y), pivot(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def distance_squared(
    left: tuple[float, float, float],
    right: tuple[float, float, float],
) -> float:
    return sum((a - b) ** 2 for a, b in zip(left, right, strict=True))


def is_blue(rgb: tuple[int, int, int]) -> bool:
    red, green, blue = rgb
    hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
    hue_degrees = hue * 360
    return (
        195 <= hue_degrees <= 250
        and saturation >= 0.08
        and value >= 0.12
        and blue - red >= 8
        and blue - green >= 2
    )


def weighted_histogram(
    pixels: Iterable[tuple[int, int, int]],
) -> tuple[list[dict[str, object]], int]:
    bins: dict[tuple[int, int, int], dict[str, object]] = defaultdict(
        lambda: {"count": 0, "sum": [0, 0, 0]}
    )
    blue_count = 0
    for rgb in pixels:
        if not is_blue(rgb):
            continue
        blue_count += 1
        key = tuple(channel >> 3 for channel in rgb)
        record = bins[key]
        record["count"] = int(record["count"]) + 1
        sums = record["sum"]
        assert isinstance(sums, list)
        for index, channel in enumerate(rgb):
            sums[index] += channel

    points: list[dict[str, object]] = []
    for record in bins.values():
        count = int(record["count"])
        sums = record["sum"]
        assert isinstance(sums, list)
        rgb = tuple(channel_sum / count for channel_sum in sums)
        points.append({"count": count, "rgb": rgb, "lab": rgb_to_lab(rgb)})
    return points, blue_count


def cluster_colors(
    points: list[dict[str, object]],
    cluster_count: int,
    iterations: int = 40,
) -> list[dict[str, object]]:
    if not points:
        raise ValueError("No blue-family pixels matched the extraction mask.")
    cluster_count = min(cluster_count, len(points))

    first = max(points, key=lambda point: int(point["count"]))
    centroids = [first["lab"]]
    while len(centroids) < cluster_count:
        next_point = max(
            points,
            key=lambda point: int(point["count"])
            * min(
                distance_squared(point["lab"], centroid)
                for centroid in centroids
            ),
        )
        centroids.append(next_point["lab"])

    assignments = [-1] * len(points)
    for _ in range(iterations):
        changed = False
        for index, point in enumerate(points):
            nearest = min(
                range(cluster_count),
                key=lambda cluster_index: distance_squared(
                    point["lab"], centroids[cluster_index]
                ),
            )
            if assignments[index] != nearest:
                assignments[index] = nearest
                changed = True

        updated_centroids: list[tuple[float, float, float]] = []
        for cluster_index in range(cluster_count):
            members = [
                point
                for point, assignment in zip(points, assignments, strict=True)
                if assignment == cluster_index
            ]
            if not members:
                updated_centroids.append(centroids[cluster_index])
                continue
            total_weight = sum(int(point["count"]) for point in members)
            mean_rgb = tuple(
                sum(
                    float(point["rgb"][channel_index]) * int(point["count"])
                    for point in members
                )
                / total_weight
                for channel_index in range(3)
            )
            updated_centroids.append(rgb_to_lab(mean_rgb))
        centroids = updated_centroids
        if not changed:
            break

    clusters: list[dict[str, object]] = []
    for cluster_index in range(cluster_count):
        members = [
            point
            for point, assignment in zip(points, assignments, strict=True)
            if assignment == cluster_index
        ]
        if not members:
            continue
        count = sum(int(point["count"]) for point in members)
        rgb = tuple(
            round(
                sum(
                    float(point["rgb"][channel_index]) * int(point["count"])
                    for point in members
                )
                / count
            )
            for channel_index in range(3)
        )
        clusters.append({"count": count, "rgb": rgb, "lab": rgb_to_lab(rgb)})
    return sorted(clusters, key=lambda cluster: int(cluster["count"]), reverse=True)


def text_color(rgb: tuple[int, int, int]) -> str:
    red, green, blue = rgb
    luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    return "#111111" if luminance > 0.58 else "#ffffff"


def write_swatch(path: Path, palette: list[PaletteColor]) -> None:
    width = 960
    row_height = 96
    image = Image.new("RGB", (width, row_height * len(palette)), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=24)
    for index, color in enumerate(palette):
        top = index * row_height
        draw.rectangle((0, top, width, top + row_height), fill=color.rgb)
        label = (
            f"{color.hex.upper()}  "
            f"blue pixels {color.blue_pixel_share:.2f}%  "
            f"sampled image {color.image_pixel_share:.2f}%"
        )
        draw.text((28, top + 33), label, fill=text_color(color.rgb), font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--clusters", type=int, default=8)
    parser.add_argument("--max-side", type=int, default=1024)
    parser.add_argument("--anchor", action="append", default=[], type=parse_hex)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--swatch", type=Path)
    args = parser.parse_args()

    with Image.open(args.image) as source:
        source = source.convert("RGBA")
        original_size = source.size
        source.thumbnail((args.max_side, args.max_side), Image.Resampling.LANCZOS)
        sampled_size = source.size
        pixel_source = (
            source.get_flattened_data()
            if hasattr(source, "get_flattened_data")
            else source.getdata()
        )
        pixels = [
            (red, green, blue)
            for red, green, blue, alpha in pixel_source
            if alpha >= 32
        ]

    points, blue_count = weighted_histogram(pixels)
    clusters = cluster_colors(points, args.clusters)
    palette = [
        PaletteColor(
            hex=to_hex(cluster["rgb"]),
            rgb=cluster["rgb"],
            blue_pixel_share=round(int(cluster["count"]) / blue_count * 100, 4),
            image_pixel_share=round(int(cluster["count"]) / len(pixels) * 100, 4),
        )
        for cluster in clusters
    ]

    anchors = []
    for anchor in args.anchor:
        anchor_lab = rgb_to_lab(anchor)
        nearest_point = min(
            points,
            key=lambda point: distance_squared(anchor_lab, point["lab"]),
        )
        nearest = min(
            clusters,
            key=lambda cluster: distance_squared(anchor_lab, cluster["lab"]),
        )
        neighborhood = [
            point
            for point in points
            if math.sqrt(distance_squared(anchor_lab, point["lab"])) <= 5
        ]
        neighborhood_count = sum(int(point["count"]) for point in neighborhood)
        neighborhood_rgb = (
            tuple(
                round(
                    sum(
                        float(point["rgb"][channel_index]) * int(point["count"])
                        for point in neighborhood
                    )
                    / neighborhood_count
                )
                for channel_index in range(3)
            )
            if neighborhood_count
            else None
        )
        anchors.append(
            {
                "requested": to_hex(anchor),
                "nearest_sampled_color": to_hex(
                    tuple(round(channel) for channel in nearest_point["rgb"])
                ),
                "nearest_sampled_delta_e_76": round(
                    math.sqrt(distance_squared(anchor_lab, nearest_point["lab"])), 3
                ),
                "nearest_cluster": to_hex(nearest["rgb"]),
                "delta_e_76": round(
                    math.sqrt(distance_squared(anchor_lab, nearest["lab"])), 3
                ),
                "delta_e_76_neighborhood": 5,
                "neighborhood_mean": (
                    to_hex(neighborhood_rgb) if neighborhood_rgb else None
                ),
                "neighborhood_blue_pixel_share": round(
                    neighborhood_count / blue_count * 100, 4
                ),
            }
        )

    result = {
        "source": str(args.image.resolve()),
        "original_size": {"width": original_size[0], "height": original_size[1]},
        "sampled_size": {"width": sampled_size[0], "height": sampled_size[1]},
        "sampled_opaque_pixels": len(pixels),
        "matched_blue_pixels": blue_count,
        "matched_blue_share": round(blue_count / len(pixels) * 100, 4),
        "mask": {
            "hue_degrees": [195, 250],
            "minimum_saturation": 0.08,
            "minimum_value": 0.12,
            "minimum_blue_minus_red": 8,
            "minimum_blue_minus_green": 2,
        },
        "palette": [asdict(color) for color in palette],
        "anchors": anchors,
    }

    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(rendered + "\n", encoding="utf-8")
    if args.swatch:
        write_swatch(args.swatch, palette)


if __name__ == "__main__":
    main()
