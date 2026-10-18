"""星图 3D 投影预演：把布局算法产出的坐标加上深度，做透视投影渲染。

两个相机角度并排，用于判断"真 3D"观感与风格是否协调。
只用于设计评审，不参与构建。
"""

from __future__ import annotations

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))

import galaxy_preview as gp  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

SEED = 20261018
Z_RANGE = 2600  # 星区在深度方向上的分布范围（世界单位）
BG = gp.BG
PANEL = gp.PANEL
GRID = gp.GRID


def region_depths(seed: int, count: int) -> list[float]:
    rand = random.Random(seed)
    return [(rand.random() - 0.5) * 2 * Z_RANGE for _ in range(count)]


def project(
    x: float,
    y: float,
    z: float,
    yaw: float,
    pitch: float,
    distance: float,
    focal: float,
    width: int,
    height: int,
    center: tuple[float, float],
) -> tuple[float, float, float]:
    cx, cy = center
    nx = (x - gp.SPACE / 2) / (gp.SPACE / 2)
    ny = (y - gp.SPACE / 2) / (gp.SPACE / 2)
    nz = z / (gp.SPACE / 2)

    x1 = nx * math.cos(yaw) - nz * math.sin(yaw)
    z1 = nx * math.sin(yaw) + nz * math.cos(yaw)
    y1 = ny
    y2 = y1 * math.cos(pitch) - z1 * math.sin(pitch)
    z2 = y1 * math.sin(pitch) + z1 * math.cos(pitch)

    depth = distance + z2
    if depth < 0.1:
        depth = 0.1
    scale = focal / depth
    sx = cx + x1 * scale * width * 0.5
    sy = cy + y2 * scale * height * 0.5
    return sx, sy, depth


def draw_panel(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    centers: list[tuple[float, float]],
    depths: list[float],
    systems: list[gp.System],
    gates: list[gp.Lane],
    lanes: list[gp.Lane],
    box: tuple[int, int, int, int],
    yaw: float,
    title: str,
    subtitle: str,
) -> None:
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    center = (x0 + width / 2, y0 + height / 2)
    distance, focal, pitch = 3.0, 2.6, 0.34

    draw.rounded_rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], radius=14, fill=PANEL, outline=GRID)

    # 区域光晕（按深度排序，远的先画）
    order = sorted(range(len(centers)), key=lambda i: -depths[i])
    for i in order:
        cx, cy = centers[i]
        px, py, depth = project(cx, cy, depths[i], yaw, pitch, distance, focal, width, height, center)
        r = gp.REGION_RADIUS * (focal / depth) * width * 0.5 / (gp.SPACE / 2)
        if r < 2:
            continue
        faction = ["neutral", "miners_guild", "deep_council", "free_fleet", "swarm"][i % 5]
        col = gp.FACTION_COLOR[faction]
        alpha = max(20, min(90, int(90 - (depth - distance) * 40)))
        for step in range(3):
            rr = r * (1 + step * 0.18)
            draw.ellipse([px - rr, py - rr, px + rr, py + rr], outline=col + (max(14, alpha // (step + 2)),), width=1)

    # 航道
    system_z = {}
    for s in systems:
        system_z[s.key] = depths[s.rid] + (gp.hash01(s.rid, s.idx, 9) - 0.5) * 2 * 400

    for lane in lanes + gates:
        ax, ay, ad = project(lane.a.x, lane.a.y, system_z[lane.a.key], yaw, pitch, distance, focal, width, height, center)
        bx, by, bd = project(lane.b.x, lane.b.y, system_z[lane.b.key], yaw, pitch, distance, focal, width, height, center)
        alpha = max(12, min(110, int(120 - (max(ad, bd) - distance) * 60)))
        col = (167, 139, 250, alpha) if lane.kind == "gate" else (71, 85, 105, alpha)
        draw.line([ax, ay, bx, by], fill=col, width=2 if lane.kind == "gate" else 1)

    # 恒星系（远的先画）
    for s in sorted(systems, key=lambda item: -system_z[item.key]):
        z = system_z[s.key]
        px, py, depth = project(s.x, s.y, z, yaw, pitch, distance, focal, width, height, center)
        if not (x0 - 20 < px < x1 + 20 and y0 - 20 < py < y1 + 20):
            continue
        r = max(1.2, 55 * (focal / depth) / 34)
        alpha = max(40, min(230, int(240 - (depth - distance) * 120)))
        col = gp.ECONOMY_COLOR[s.economy]
        draw.ellipse([px - r, py - r, px + r, py + r], fill=col + (alpha,))

    for i in order:
        cx, cy = centers[i]
        px, py, depth = project(cx, cy, depths[i], yaw, pitch, distance, focal, width, height, center)
        faction = ["neutral", "miners_guild", "deep_council", "free_fleet", "swarm"][i % 5]
        col = gp.FACTION_COLOR[faction]
        draw.text((px, py), f"R{i + 1}", font=gp.load_font(12), fill=(col[0], col[1], col[2], 210), anchor="mm")

    draw.text((x0 + 2, y0 - 44), title, font=gp.load_font(22, bold=True), fill=gp.TEXT)
    draw.text((x0 + 2, y0 - 18), subtitle, font=gp.load_font(12), fill=gp.MUTED)


def main() -> None:
    centers = gp.region_centers(SEED)
    by_region = {rid: gp.sample_systems(SEED, rid, centers[rid]) for rid in range(gp.REGION_COUNT)}
    systems = [s for lst in by_region.values() for s in lst]
    lanes = []
    for rid in range(gp.REGION_COUNT):
        lanes.extend(gp.build_lanes(by_region[rid]))
    adj = gp.region_adjacency(centers)
    gates = gp.build_gates(adj, by_region)
    depths = region_depths(SEED, gp.REGION_COUNT)

    W, H = 1680, 960
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img, "RGBA")

    # 背景星点（固定种子，避免每次渲染不同）
    star_rand = gp.rng_from("stars")
    star_rand.seed(SEED)
    for _ in range(1200):
        x = star_rand.uniform(0, W)
        y = star_rand.uniform(0, H)
        draw.point((x, y), fill=(255, 255, 255, star_rand.randint(16, 50)))

    draw.text((24, 22), "星图 3D 投影预演 · 同一宇宙的两个视角", font=gp.load_font(28, bold=True), fill=gp.TEXT)
    draw.text(
        (24, 58),
        "深度只用于表现，玩法距离仍按平面坐标计算；配色与发光沿用现有主题",
        font=gp.load_font(13),
        fill=gp.MUTED,
    )

    draw_panel(
        img, draw, centers, depths, systems, gates, lanes,
        (24, 128, 824, 888), 0.62,
        "视角 A · 偏航 35°",
        f"16 星区 / 1024 恒星系 / {len(lanes)} 航道 / {len(gates)} 星门",
    )
    draw_panel(
        img, draw, centers, depths, systems, gates, lanes,
        (856, 128, 1656, 888), 2.25,
        "视角 B · 偏航 129°",
        "旋转后星区前后关系变化，验证深度层次",
    )

    draw.text(
        (24, 906),
        "提示：真实实现建议 Canvas 2D + DOM 覆盖层（标签/提示/焦点用 DOM，保持可访问性与现有风格）",
        font=gp.load_font(12),
        fill=gp.MUTED,
    )

    out = os.path.join("doc", "galaxy-3d-preview.png")
    img.save(out)
    print(f"saved {out} ({W}x{H})")


if __name__ == "__main__":
    main()
