"""周目对比预演：同一个 worldSeed 派生出的两张星图并排展示。

用于验证「每个周目一张独立星图」的视觉效果。运行：
  python scripts/galaxy_cycles_preview.py
输出：
  doc/galaxy-cycles.png
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import galaxy_preview as gp  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

WORLD_SEED = 20261018
CYCLE_NAMES = ["起源", "荒芜", "炽焰", "深空", "终末"]


def cycle_seed(world_seed: int, cycle: int) -> int:
    """worldSeed 派生出每一层的 layoutSeed（确定性）。"""
    h = (world_seed * 6364136223846793005 + cycle * 1442695040888963407) & 0xFFFFFFFF
    h = (h ^ (h >> 33)) * 0xFF51AFD7ED558CCD & 0xFFFFFFFF
    return h ^ (h >> 29)


def build_cycle(seed: int) -> dict:
    centers = gp.region_centers(seed)
    by_region = {rid: gp.sample_systems(seed, rid, centers[rid]) for rid in range(gp.REGION_COUNT)}
    all_systems = [s for lst in by_region.values() for s in lst]
    lanes = []
    for rid in range(gp.REGION_COUNT):
        lanes.extend(gp.build_lanes(by_region[rid]))
    adj = gp.region_adjacency(centers)
    gates = gp.build_gates(adj, by_region)

    index = {s.key: i for i, s in enumerate(all_systems)}
    uf = gp.UnionFind(len(all_systems))
    for lane in lanes + gates:
        uf.union(index[lane.a.key], index[lane.b.key])
    components = len({uf.find(i) for i in range(len(all_systems))})

    eco = {}
    for s in all_systems:
        eco[s.economy] = eco.get(s.economy, 0) + 1

    return {
        "seed": seed,
        "centers": centers,
        "by_region": by_region,
        "systems": all_systems,
        "lanes": lanes,
        "gates": gates,
        "components": components,
        "economy": eco,
    }


def draw_panel(img: Image.Image, draw: ImageDraw.ImageDraw, data: dict, box: tuple[int, int, int, int], title: str, subtitle: str) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], radius=14, fill=gp.PANEL, outline=gp.GRID)

    systems = data["systems"]
    xs = [s.x for s in systems]
    ys = [s.y for s in systems]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    span = max(maxx - minx, maxy - miny) * 1.10
    cxm, cym = (minx + maxx) / 2, (miny + maxy) / 2

    def to_panel(x: float, y: float) -> tuple[float, float]:
        return (x0 + (x1 - x0) / 2 + (x - cxm) / span * (x1 - x0), y0 + (y1 - y0) / 2 + (y - cym) / span * (y1 - y0))

    scale = (x1 - x0) / span

    for rid, (cx, cy) in enumerate(data["centers"]):
        px, py = to_panel(cx, cy)
        r = gp.REGION_RADIUS * scale
        faction = ["neutral", "miners_guild", "deep_council", "free_fleet", "swarm"][rid % 5]
        col = gp.FACTION_COLOR[faction]
        draw.ellipse([px - r, py - r, px + r, py + r], fill=col + (24,), outline=col + (90,), width=2)
        dx, dy = cx - gp.SPACE / 2, cy - gp.SPACE / 2
        norm = math.hypot(dx, dy) or 1.0
        draw.text(
            (px + dx / norm * (r + 10), py + dy / norm * (r + 10)),
            f"R{rid + 1}",
            font=gp.load_font(10),
            fill=(col[0], col[1], col[2], 225),
            anchor="mm",
        )

    for s in systems:
        px, py = to_panel(s.x, s.y)
        draw.ellipse([px - 1.4, py - 1.4, px + 1.4, py + 1.4], fill=gp.ECONOMY_COLOR[s.economy] + (140,))

    for lane in data["gates"]:
        x1p, y1p = to_panel(lane.a.x, lane.a.y)
        x2p, y2p = to_panel(lane.b.x, lane.b.y)
        draw.line([x1p, y1p, x2p, y2p], fill=(167, 139, 250, 120), width=1)

    for s in systems:
        if s.gateway:
            px, py = to_panel(s.x, s.y)
            draw.polygon(
                [(px, py - 3.4), (px + 3.4, py), (px, py + 3.4), (px - 3.4, py)],
                fill=(167, 139, 250, 235),
            )

    draw.text((x0 + 2, y0 - 44), title, font=gp.load_font(22, bold=True), fill=gp.TEXT)
    draw.text((x0 + 2, y0 - 18), subtitle, font=gp.load_font(12), fill=gp.MUTED)


def main() -> None:
    cycles = []
    for i in range(2):
        seed = cycle_seed(WORLD_SEED, i + 1)
        data = build_cycle(seed)
        cycles.append(data)
        print(
            f"cycle {i + 1} seed={seed} systems={len(data['systems'])} "
            f"lanes={len(data['lanes'])} gates={len(data['gates'])} components={data['components']}"
        )

    W, H = 1680, 1090
    img = Image.new("RGB", (W, H), gp.BG)
    draw = ImageDraw.Draw(img, "RGBA")

    draw.text((24, 22), "周目对比 · 每一层都是一张全新的星图", font=gp.load_font(28, bold=True), fill=gp.TEXT)
    draw.text(
        (24, 58),
        f"同一个 worldSeed={WORLD_SEED} → 每层派生出不同的 layoutSeed → 完全不同的星区布局、航道与星门",
        font=gp.load_font(13),
        fill=gp.MUTED,
    )

    labels = [
        ("宇宙 I · 起源", "第 1 层 · 新手与主世界"),
        ("宇宙 II · 荒芜", "第 2 层 · 资源 ×1.15 / NPC ×1.25"),
    ]
    boxes = [(24, 130, 820, 850), (860, 130, 1656, 850)]
    for data, (title, sub), box in zip(cycles, labels, boxes):
        draw_panel(
            img,
            draw,
            data,
            box,
            title,
            f"{sub}   seed={data['seed']}",
        )

    # 底部对比表
    draw.rounded_rectangle([24, 872, 1656, 1066], radius=14, fill=gp.PANEL, outline=gp.GRID)
    f_h = gp.load_font(17, bold=True)
    f_b = gp.load_font(14)
    draw.text((40, 888), "指标", font=f_h, fill=gp.TEXT)
    draw.text((360, 888), "宇宙 I · 起源", font=f_h, fill=gp.TEXT)
    draw.text((700, 888), "宇宙 II · 荒芜", font=f_h, fill=gp.TEXT)
    draw.text((1040, 888), "结论", font=f_h, fill=gp.TEXT)

    a, b = cycles
    rows = [
        ("恒星系", f"{len(a['systems'])}", f"{len(b['systems'])}", "规模相同"),
        ("区内航道", f"{len(a['lanes'])}", f"{len(b['lanes'])}", "局部连通方式不同"),
        (
            "跨区星门",
            f"{len(a['gates'])}",
            f"{len(b['gates'])}",
            "星区相邻关系重排",
        ),
        ("连通分量", f"{a['components']}", f"{b['components']}", "都保证无孤岛"),
        (
            "区中心最小间距",
            f"{min_center_gap(a['centers']) / 1024:.1f} 光年",
            f"{min_center_gap(b['centers']) / 1024:.1f} 光年",
            "布局互不相同",
        ),
        (
            "布局指纹",
            fingerprint(a),
            fingerprint(b),
            "同一 seed 永远同一张图",
        ),
    ]
    for i, (k, va, vb, note) in enumerate(rows):
        y = 920 + i * 23
        draw.text((40, y), k, font=f_b, fill=gp.MUTED)
        draw.text((360, y), va, font=f_b, fill=gp.TEXT)
        draw.text((700, y), vb, font=f_b, fill=gp.TEXT)
        draw.text((1040, y), note, font=f_b, fill=gp.MUTED)

    out = os.path.join("doc", "galaxy-cycles.png")
    img.save(out)
    print(f"saved {out} ({W}x{H})")


def min_center_gap(centers: list[tuple[float, float]]) -> float:
    best = float("inf")
    for i in range(len(centers)):
        for j in range(i + 1, len(centers)):
            best = min(best, math.dist(centers[i], centers[j]))
    return best


def fingerprint(data: dict) -> str:
    """布局指纹：对全部星区中心坐标做 FNV-1a，用来证明两张图不同。"""
    h = 2166136261
    for cx, cy in data["centers"]:
        for v in (round(cx), round(cy)):
            h ^= v & 0xFFFFFFFF
            h = (h * 16777619) & 0xFFFFFFFF
    return f"{h:08X}"


def top_economies(eco: dict) -> str:
    items = sorted(eco.items(), key=lambda kv: -kv[1])[:2]
    total = sum(eco.values()) or 1
    return " / ".join(f"{name} {count / total:.0%}" for name, count in items)


if __name__ == "__main__":
    main()
