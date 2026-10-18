"""星图布局预演：把 GALAXY_MAP_DESIGN.md 的算法真跑一遍并渲染成 PNG。

只用于设计评审，不参与游戏构建。运行：
  python scripts/galaxy_preview.py
输出：
  doc/galaxy-preview.png
"""

from __future__ import annotations

import math
import os
import random
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- 配置（与 GALAXY_BALANCE.md 一致）
SPACE = 65536
REGION_COUNT = 16
SYSTEMS_PER_REGION = 64
REGION_RADIUS = 5200
SYSTEM_MIN_SPACING = 620
LOCAL_LANE_K = 3
SEED = 20261018

ECONOMIES = ["mining", "industrial", "tech", "trade", "agriculture", "military"]
ECONOMY_COLOR = {
    "mining": (245, 158, 11),
    "industrial": (148, 163, 184),
    "tech": (56, 189, 248),
    "trade": (52, 211, 153),
    "agriculture": (163, 230, 53),
    "military": (244, 63, 94),
}
DANGER_COLOR = {1: (120, 130, 150), 2: (245, 158, 11), 3: (239, 68, 68)}
FACTION_COLOR = {
    "neutral": (100, 116, 139),
    "miners_guild": (245, 158, 11),
    "deep_council": (167, 139, 250),
    "free_fleet": (56, 189, 248),
    "swarm": (244, 63, 94),
}
BG = (11, 15, 25)
PANEL = (17, 24, 39)
GRID = (30, 41, 59)
TEXT = (226, 232, 240)
MUTED = (148, 163, 184)
GOLD = (250, 204, 21)


# ---------------------------------------------------------------- 确定性随机
def rng_from(seed: int) -> random.Random:
    return random.Random(seed)


def hash01(a: int, b: int, salt: int = 0) -> float:
    h = (a * 374761393 + b * 668265263 + salt * 2147483647) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    h = (h ^ (h >> 16)) & 0xFFFFFFFF
    return h / 0xFFFFFFFF


@dataclass
class System:
    rid: int
    idx: int
    x: float
    y: float
    economy: str
    danger: int
    planets: int
    gateway: bool = False

    @property
    def key(self) -> str:
        return f"{self.rid}:{self.idx}"


@dataclass
class Lane:
    a: System
    b: System
    kind: str  # local | gate
    length: float = field(init=False)

    def __post_init__(self) -> None:
        self.length = math.dist((self.a.x, self.a.y), (self.b.x, self.b.y))


# ---------------------------------------------------------------- 布局
def region_centers(seed: int) -> list[tuple[float, float]]:
    rng = rng_from(seed)
    centers: list[tuple[float, float]] = []
    golden = 2.399963229728653
    r_max = SPACE * 0.48
    for i in range(REGION_COUNT):
        angle = i * golden + rng.uniform(-0.12, 0.12)
        radius = r_max * math.sqrt((i + 0.5) / REGION_COUNT) * rng.uniform(0.92, 1.08)
        cx = SPACE / 2 + math.cos(angle) * radius
        cy = SPACE / 2 + math.sin(angle) * radius
        centers.append((cx, cy))

    # 松弛：把过近的星区推开，让云团基本不重叠
    min_gap = REGION_RADIUS * 2.0
    lo, hi = SPACE * 0.05, SPACE * 0.95
    for _ in range(120):
        moved = False
        for a in range(len(centers)):
            for b in range(a + 1, len(centers)):
                ax, ay = centers[a]
                bx, by = centers[b]
                d = math.dist((ax, ay), (bx, by))
                if d < min_gap and d > 1e-6:
                    push = (min_gap - d) / 2
                    ux, uy = (bx - ax) / d, (by - ay) / d
                    centers[a] = (
                        min(max(ax - ux * push, lo), hi),
                        min(max(ay - uy * push, lo), hi),
                    )
                    centers[b] = (
                        min(max(bx + ux * push, lo), hi),
                        min(max(by + uy * push, lo), hi),
                    )
                    moved = True
        if not moved:
            break
    return centers


def sample_systems(seed: int, rid: int, center: tuple[float, float]) -> list[System]:
    rng = rng_from(seed * 1000 + rid)
    grid_n = 8
    cell = (REGION_RADIUS * 2) / grid_n
    cells = [(gx, gy) for gx in range(grid_n) for gy in range(grid_n)]
    rng.shuffle(cells)
    points: list[tuple[float, float]] = []
    for gx, gy in cells:
        if len(points) >= SYSTEMS_PER_REGION:
            break
        base_x = center[0] - REGION_RADIUS + (gx + 0.5) * cell
        base_y = center[1] - REGION_RADIUS + (gy + 0.5) * cell
        for _ in range(4):
            px = base_x + rng.uniform(-0.45, 0.45) * cell
            py = base_y + rng.uniform(-0.45, 0.45) * cell
            if math.dist((px, py), center) > REGION_RADIUS * 0.96:
                continue
            if any(math.dist((px, py), q) < SYSTEM_MIN_SPACING for q in points):
                continue
            points.append((px, py))
            break

    # 补齐（极端情况下采样不足）
    while len(points) < SYSTEMS_PER_REGION:
        angle = rng.uniform(0, math.tau)
        r = REGION_RADIUS * math.sqrt(rng.random()) * 0.9
        p = (center[0] + math.cos(angle) * r, center[1] + math.sin(angle) * r)
        if all(math.dist(p, q) > SYSTEM_MIN_SPACING * 0.6 for q in points):
            points.append(p)

    systems = []
    for idx, (x, y) in enumerate(points, start=1):
        systems.append(
            System(
                rid=rid,
                idx=idx,
                x=x,
                y=y,
                economy=ECONOMIES[int(hash01(rid, idx, 2) * len(ECONOMIES)) % len(ECONOMIES)],
                danger=1 + int(hash01(rid, idx, 3) * 3) % 3,
                planets=2 + int(hash01(rid, idx, 4) * 7),
            )
        )
    return systems


class UnionFind:
    def __init__(self, n: int) -> None:
        self.p = list(range(n))

    def find(self, a: int) -> int:
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        self.p[ra] = rb
        return True


def build_lanes(systems: list[System]) -> list[Lane]:
    lanes: dict[tuple[str, str], Lane] = {}

    def add(a: System, b: System) -> None:
        key = tuple(sorted((a.key, b.key)))
        if key not in lanes:
            lanes[key] = Lane(a, b, "local")

    # 区内 kNN
    for s in systems:
        nearest = sorted(systems, key=lambda o: math.dist((s.x, s.y), (o.x, o.y)))[1 : LOCAL_LANE_K + 1]
        for n in nearest:
            add(s, n)

    # 连通性修复
    index = {s.key: i for i, s in enumerate(systems)}
    uf = UnionFind(len(systems))
    for lane in lanes.values():
        uf.union(index[lane.a.key], index[lane.b.key])

    candidates = []
    for i, a in enumerate(systems):
        for b in systems[i + 1 :]:
            if uf.find(index[a.key]) != uf.find(index[b.key]):
                candidates.append((math.dist((a.x, a.y), (b.x, b.y)), a, b))
    candidates.sort(key=lambda t: t[0])
    for _, a, b in candidates:
        if uf.union(index[a.key], index[b.key]):
            add(a, b)

    return list(lanes.values())


def region_adjacency(centers: list[tuple[float, float]], k: int = 3) -> list[tuple[int, int]]:
    pairs: set[tuple[int, int]] = set()
    for i, c in enumerate(centers):
        nearest = sorted(range(len(centers)), key=lambda j: math.dist(c, centers[j]))[1 : k + 1]
        for j in nearest:
            pairs.add((min(i, j), max(i, j)))

    uf = UnionFind(len(centers))
    for a, b in pairs:
        uf.union(a, b)
    cand = []
    for i in range(len(centers)):
        for j in range(i + 1, len(centers)):
            if uf.find(i) != uf.find(j):
                cand.append((math.dist(centers[i], centers[j]), i, j))
    cand.sort()
    for _, i, j in cand:
        if uf.union(i, j):
            pairs.add((i, j))
    return sorted(pairs)


def build_gates(adj: list[tuple[int, int]], by_region: dict[int, list[System]]) -> list[Lane]:
    gates: list[Lane] = []
    for a, b in adj:
        best = None
        for sa in by_region[a]:
            for sb in by_region[b]:
                d = math.dist((sa.x, sa.y), (sb.x, sb.y))
                if best is None or d < best[0]:
                    best = (d, sa, sb)
        if best:
            _, sa, sb = best
            sa.gateway = True
            sb.gateway = True
            gates.append(Lane(sa, sb, "gate"))
    return gates


# ---------------------------------------------------------------- 工具
def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def clip_segment(
    x1: float, y1: float, x2: float, y2: float, rect: tuple[float, float, float, float]
) -> tuple[float, float, float, float] | None:
    """Liang-Barsky：把线段裁剪到矩形内，完全在外返回 None。"""
    rx0, ry0, rx1, ry1 = rect
    dx, dy = x2 - x1, y2 - y1
    p = [-dx, dx, -dy, dy]
    q = [x1 - rx0, rx1 - x1, y1 - ry0, ry1 - y1]
    u1, u2 = 0.0, 1.0
    for pi, qi in zip(p, q):
        if pi == 0:
            if qi < 0:
                return None
            continue
        t = qi / pi
        if pi < 0:
            u1 = max(u1, t)
        else:
            u2 = min(u2, t)
        if u1 > u2:
            return None
    return (x1 + u1 * dx, y1 + u1 * dy, x1 + u2 * dx, y1 + u2 * dy)


# ---------------------------------------------------------------- 渲染
def main() -> None:
    rng = rng_from(SEED)
    centers = region_centers(SEED)
    by_region = {rid: sample_systems(SEED, rid, centers[rid]) for rid in range(REGION_COUNT)}
    all_systems = [s for lst in by_region.values() for s in lst]

    local_lanes: list[Lane] = []
    for rid in range(REGION_COUNT):
        local_lanes.extend(build_lanes(by_region[rid]))

    adj = region_adjacency(centers)
    gates = build_gates(adj, by_region)

    # 最短路（示例跨区航线）
    import heapq

    graph: dict[str, list[tuple[str, float]]] = {}
    for lane in local_lanes + gates:
        graph.setdefault(lane.a.key, []).append((lane.b.key, lane.length))
        graph.setdefault(lane.b.key, []).append((lane.a.key, lane.length))

    start = by_region[0][0]
    end = by_region[REGION_COUNT - 1][0]
    dist = {start.key: 0.0}
    prev: dict[str, str] = {}
    pq = [(0.0, start.key)]
    seen: set[str] = set()
    while pq:
        d, key = heapq.heappop(pq)
        if key in seen:
            continue
        seen.add(key)
        if key == end.key:
            break
        for nxt, w in graph.get(key, []):
            nd = d + w
            if nd < dist.get(nxt, float("inf")):
                dist[nxt] = nd
                prev[nxt] = key
                heapq.heappush(pq, (nd, nxt))

    by_key = {s.key: s for s in all_systems}
    path: list[System] = []
    cur = end.key
    while cur in prev:
        path.append(by_key[cur])
        cur = prev[cur]
    path.append(by_key[cur])
    path.reverse()

    # ------------------------------------------------------------ 画布
    W, H = 1640, 1080
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img, "RGBA")

    f_title = load_font(30, bold=True)
    f_h2 = load_font(19, bold=True)
    f_body = load_font(15)
    f_small = load_font(12)
    f_tiny = load_font(10)

    for _ in range(900):
        x = rng.uniform(0, W)
        y = rng.uniform(0, H)
        a = rng.randint(18, 55)
        draw.point((x, y), fill=(255, 255, 255, a))

    # ================= 左侧：银河视图
    GX0, GY0, GW, GH = 24, 78, 1010, 760
    draw.rounded_rectangle([GX0 - 8, GY0 - 8, GX0 + GW + 8, GY0 + GH + 8], radius=14, fill=PANEL, outline=GRID)

    xs = [s.x for s in all_systems]
    ys = [s.y for s in all_systems]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    span = max(maxx - minx, maxy - miny) * 1.10
    cxm, cym = (minx + maxx) / 2, (miny + maxy) / 2

    def to_panel(x: float, y: float) -> tuple[float, float]:
        return (GX0 + GW / 2 + (x - cxm) / span * GW, GY0 + GH / 2 + (y - cym) / span * GH)

    scale_panel = GW / span

    for rid, (cx, cy) in enumerate(centers):
        px, py = to_panel(cx, cy)
        r = REGION_RADIUS * scale_panel
        faction = ["neutral", "miners_guild", "deep_council", "free_fleet", "swarm"][rid % 5]
        col = FACTION_COLOR[faction]
        draw.ellipse([px - r, py - r, px + r, py + r], fill=col + (22,), outline=col + (85,), width=2)
        dx, dy = cx - SPACE / 2, cy - SPACE / 2
        norm = math.hypot(dx, dy) or 1.0
        lx = px + dx / norm * (r + 12)
        ly = py + dy / norm * (r + 12)
        draw.text((lx, ly), f"R{rid + 1}", font=f_small, fill=(col[0], col[1], col[2], 235), anchor="mm")

    for s in all_systems:
        px, py = to_panel(s.x, s.y)
        draw.ellipse([px - 1.5, py - 1.5, px + 1.5, py + 1.5], fill=ECONOMY_COLOR[s.economy] + (140,))

    for lane in gates:
        x1, y1 = to_panel(lane.a.x, lane.a.y)
        x2, y2 = to_panel(lane.b.x, lane.b.y)
        draw.line([x1, y1, x2, y2], fill=(167, 139, 250, 110), width=1)

    for s in all_systems:
        if s.gateway:
            px, py = to_panel(s.x, s.y)
            draw.polygon(
                [(px, py - 3.6), (px + 3.6, py), (px, py + 3.6), (px - 3.6, py)],
                fill=(167, 139, 250, 240),
            )

    for a, b in zip(path, path[1:]):
        x1, y1 = to_panel(a.x, a.y)
        x2, y2 = to_panel(b.x, b.y)
        draw.line([x1, y1, x2, y2], fill=GOLD + (235,), width=2)

    px, py = to_panel(path[0].x, path[0].y)
    draw.ellipse([px - 7, py - 7, px + 7, py + 7], outline=GOLD + (255,), width=2)
    draw.text((px + 10, py - 22), f"起点 {path[0].key}", font=f_small, fill=GOLD)
    px, py = to_panel(path[-1].x, path[-1].y)
    draw.ellipse([px - 7, py - 7, px + 7, py + 7], outline=GOLD + (255,), width=2)
    draw.text((px + 10, py + 10), f"终点 {path[-1].key}", font=f_small, fill=GOLD)

    draw.text(
        (GX0 + 4, GY0 + GH + 16),
        "银河视图：16 个星区 · 1024 个恒星系 · 紫色虚线为跨区星门 · 金色为示例航线",
        font=f_small,
        fill=MUTED,
    )

    # ================= 右上：区域视图
    RX0, RY0, RW, RH = 1060, 78, 556, 470
    draw.rounded_rectangle([RX0 - 8, RY0 - 8, RX0 + RW + 8, RY0 + RH + 8], radius=14, fill=PANEL, outline=GRID)

    focus = by_region[3]
    fxs = [s.x for s in focus]
    fys = [s.y for s in focus]
    fminx, fmaxx, fminy, fmaxy = min(fxs), max(fxs), min(fys), max(fys)
    fspan = max(fmaxx - fminx, fmaxy - fminy) * 1.18
    fcx, fcy = (fminx + fmaxx) / 2, (fminy + fmaxy) / 2

    def to_region(x: float, y: float) -> tuple[float, float]:
        return (RX0 + RW / 2 + (x - fcx) / fspan * RW, RY0 + RH / 2 + (y - fcy) / fspan * RH)

    panel_rect = (RX0, RY0, RX0 + RW, RY0 + RH)

    for lane in local_lanes:
        if lane.a.rid != 3:
            continue
        x1, y1 = to_region(lane.a.x, lane.a.y)
        x2, y2 = to_region(lane.b.x, lane.b.y)
        draw.line([x1, y1, x2, y2], fill=(71, 85, 105, 220), width=1)

    for lane in gates:
        if lane.a.rid != 3 and lane.b.rid != 3:
            continue
        x1, y1 = to_region(lane.a.x, lane.a.y)
        x2, y2 = to_region(lane.b.x, lane.b.y)
        clipped = clip_segment(x1, y1, x2, y2, panel_rect)
        if clipped:
            draw.line(list(clipped), fill=(167, 139, 250, 200), width=2)

    for s in focus:
        px, py = to_region(s.x, s.y)
        r = 2.6 + s.planets * 0.28
        draw.ellipse(
            [px - r, py - r, px + r, py + r],
            fill=ECONOMY_COLOR[s.economy] + (255,),
            outline=DANGER_COLOR[s.danger] + (255,),
            width=2 if s.danger > 1 else 1,
        )
        if s.gateway:
            draw.polygon(
                [(px, py - r - 5), (px + 5, py), (px, py + r + 5), (px - 5, py)],
                fill=(167, 139, 250, 240),
            )

    for s in focus[:6]:
        px, py = to_region(s.x, s.y)
        draw.text((px + 8, py - 14), f"3:{s.idx}", font=f_tiny, fill=(203, 213, 225, 210))

    draw.text(
        (RX0 + 4, RY0 + RH + 16),
        "区域视图（R4，64 个恒星系）：颜色=经济类型，描边=危险度，菱形=星门",
        font=f_small,
        fill=MUTED,
    )

    # ================= 右下：图例与统计
    LX0, LY0, LW, LH = 1060, 590, 556, 452
    draw.rounded_rectangle([LX0 - 8, LY0 - 8, LX0 + LW + 8, LY0 + LH + 8], radius=14, fill=PANEL, outline=GRID)

    draw.text((LX0 + 6, LY0 + 4), "经济类型", font=f_h2, fill=TEXT)
    for i, eco in enumerate(ECONOMIES):
        y = LY0 + 40 + i * 26
        draw.ellipse([LX0 + 8, y + 4, LX0 + 18, y + 14], fill=ECONOMY_COLOR[eco] + (255,))
        draw.text((LX0 + 26, y), eco, font=f_body, fill=TEXT)

    draw.text((LX0 + 220, LY0 + 4), "危险度（描边）", font=f_h2, fill=TEXT)
    for i, (lvl, col) in enumerate(DANGER_COLOR.items()):
        y = LY0 + 40 + i * 30
        draw.ellipse([LX0 + 222, y + 3, LX0 + 236, y + 17], fill=(30, 41, 59), outline=col + (255,), width=2)
        draw.text((LX0 + 246, y), f"危险 {lvl}", font=f_body, fill=TEXT)

    draw.text((LX0 + 380, LY0 + 4), "统计", font=f_h2, fill=TEXT)

    index_of = {s.key: i for i, s in enumerate(all_systems)}
    uf_all = UnionFind(len(all_systems))
    for lane in local_lanes + gates:
        uf_all.union(index_of[lane.a.key], index_of[lane.b.key])
    components = len({uf_all.find(i) for i in range(len(all_systems))})
    conn_ok = "是" if components == 1 else f"否（{components} 个分量）"

    route_len = sum(math.dist((a.x, a.y), (b.x, b.y)) for a, b in zip(path, path[1:]))
    stats = [
        f"星区 {REGION_COUNT}",
        f"恒星系 {len(all_systems)}",
        f"区内航道 {len(local_lanes)}",
        f"跨区星门 {len(gates)}（相邻星区 {len(adj)} 对）",
        f"平均每系航道 {len(local_lanes) / len(all_systems):.1f} 条",
        f"全图连通 {conn_ok}",
        f"示例航线 {path[0].key} → {path[-1].key}",
        f"  全程 {len(path) - 1} 段 · {route_len / 1024:.1f} 光年",
    ]
    for i, line in enumerate(stats):
        draw.text((LX0 + 382, LY0 + 38 + i * 24), line, font=f_small if i else f_body, fill=MUTED if i else TEXT)

    notes = [
        "算法：黄金角螺旋铺星区 → 8×8 网格拒绝采样铺恒星系",
        "      → kNN(3) 连区内航道 → 并查集补连通",
        "      → 星区中心 kNN 求相邻 → 每对取最近系统对建星门",
        "结果：无孤岛、布局自然，全部由 SEED 确定性生成。",
    ]
    for i, line in enumerate(notes):
        draw.text((LX0 + 6, LY0 + 312 + i * 22), line, font=f_tiny, fill=MUTED)

    draw.text((24, 24), "OGame-Vue-Ts · 星图布局预演", font=f_title, fill=TEXT)
    draw.text(
        (24, 58),
        f"SEED={SEED} · 布局与航道全部由确定性算法生成（示意，非最终美术）",
        font=f_small,
        fill=MUTED,
    )

    out = os.path.join("doc", "galaxy-preview.png")
    img.save(out)
    print(f"saved {out}  ({W}x{H})")
    print(f"systems={len(all_systems)} local_lanes={len(local_lanes)} gates={len(gates)} components={components}")
    print(f"route {path[0].key} -> {path[-1].key} legs={len(path) - 1} len={route_len / 1024:.1f}ly")


if __name__ == "__main__":
    main()
