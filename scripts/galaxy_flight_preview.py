"""飞行视图的视觉模拟：用和 StarMapView 完全相同的公式渲染一张静帧。

用途：在没有浏览器的环境下确认"星星到底多大、密度是否合适"。
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import galaxy_preview as gp  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

SEED = 20261018
TWIST = 6.5
VIEW_RADIUS = 26000
TAN_HALF_FOV = 0.7
W, H = 1280, 800
SS = 2  # 超采样

ECONOMY = {
    "mining": (245, 158, 11),
    "industrial": (148, 163, 184),
    "tech": (56, 189, 248),
    "trade": (52, 211, 153),
    "agriculture": (163, 230, 53),
    "military": (244, 63, 94),
}


def spiral(x: float, y: float, space: float, twist: float) -> tuple[float, float]:
    c = space / 2
    dx, dy = x - c, y - c
    r = math.hypot(dx, dy)
    a = math.atan2(dy, dx) + (r / (space / 2)) * twist
    return c + math.cos(a) * r, c + math.sin(a) * r


def gauss01(n=4):
    total = 0.0
    for _ in range(n):
        total += gp.hash01(int(total * 1e6) + n, int(total * 1e6) + 7, 3)
    return (total - 2) / 2


def depth_of(key: str, radius: float) -> float:
    g = gauss01()
    bulge = max(0.0, 1 - radius / 26000)
    thickness = 420 + 1800 * bulge * bulge
    return g * thickness


def project(p, cam):
    cx, cy, cz, yaw, pitch = cam
    cp, sp = math.cos(pitch), math.sin(pitch)
    fwd = (cp * math.cos(yaw), cp * math.sin(yaw), sp)
    right = (-math.sin(yaw), math.cos(yaw), 0)
    up = (
        right[1] * fwd[2] - right[2] * fwd[1],
        right[2] * fwd[0] - right[0] * fwd[2],
        right[0] * fwd[1] - right[1] * fwd[0],
    )
    d = (p[0] - cx, p[1] - cy, p[2] - cz)
    depth = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2]
    if depth <= 1:
        return None
    vx = d[0] * right[0] + d[1] * right[1] + d[2] * right[2]
    vy = d[0] * up[0] + d[1] * up[1] + d[2] * up[2]
    dist = math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
    return (
        W * SS / 2 + (vx / depth / TAN_HALF_FOV) * (W * SS / 2),
        H * SS / 2 - (vy / depth / TAN_HALF_FOV) * (H * SS / 2),
        depth,
        dist,
    )


def fog(d: float) -> float:
    if d >= VIEW_RADIUS:
        return 0.0
    return max(0.0, 1 - (d / VIEW_RADIUS) ** 1.2)


def main() -> None:
    centers = gp.region_centers(SEED)
    by_region = {rid: gp.sample_systems(SEED, rid, centers[rid]) for rid in range(gp.REGION_COUNT)}
    systems = []
    for lst in by_region.values():
        for s in lst:
            wx, wy = spiral(s.x, s.y, gp.SPACE, TWIST)
            r = math.hypot(wx - gp.SPACE / 2, wy - gp.SPACE / 2)
            systems.append((s, wx, wy, depth_of(s.key, r)))

    # 巡航预设：距银心 16000，朝向银心
    angle = 0.7
    cam = (
        gp.SPACE / 2 + math.cos(angle) * 13000,
        gp.SPACE / 2 + math.sin(angle) * 13000,
        9200,
        angle + math.pi,
        -0.66,
    )

    img = Image.new("RGB", (W * SS, H * SS), (0, 0, 4))
    draw = ImageDraw.Draw(img, "RGBA")

    # 尘埃
    for i in range(900):
        a = (i * 2.399963229728653) % (math.pi * 2)
        r = 1200 + ((i * 7919) % 26000)
        p = (gp.SPACE / 2 + math.cos(a) * r, gp.SPACE / 2 + math.sin(a) * r, (((i * 104729) % 200) - 100) * 4)
        pr = project(p, cam)
        if not pr or pr[3] > VIEW_RADIUS * 1.2:
            continue
        f = fog(pr[3] * VIEW_RADIUS / (VIEW_RADIUS * 1.2))
        draw.point((pr[0], pr[1]), fill=(147, 197, 253, int(255 * 0.18 * f)))

    # 银心
    core = project((gp.SPACE / 2, gp.SPACE / 2, 0), cam)
    if core:
        glow = min(430 * SS, max(24 * SS, (95000 / max(400, core[2])) * SS))
        for step in range(18):
            t = step / 17
            rad = glow * (1 - t)
            alpha = int(255 * 0.5 * (1 - t) ** 2)
            draw.ellipse(
                [core[0] - rad, core[1] - rad, core[0] + rad, core[1] + rad],
                fill=(255, 220, 160, alpha),
            )

    arm_stars = []
    for s, x, y, z in systems:
        for k in range(3):
            h1 = gp.hash01(s.rid, s.idx * 10 + k, 21)
            h2 = gp.hash01(s.rid, s.idx * 10 + k, 22)
            h3 = gp.hash01(s.rid, s.idx * 10 + k, 23)
            arm_stars.append((x + (h1 - 0.5) * 2200, y + (h2 - 0.5) * 2200, z + (h3 - 0.5) * 700))

    for p in arm_stars:
        pr = project(p, cam)
        if not pr or pr[3] > VIEW_RADIUS:
            continue
        f = fog(pr[3])
        rr = 2 * SS
        draw.ellipse([pr[0] - rr, pr[1] - rr, pr[0] + rr, pr[1] + rr], fill=(205, 225, 255, int(255 * 0.5 * f)))

    pos = {s.key: (x, y, z) for s, x, y, z in systems}
    lanes = []
    for rid in range(gp.REGION_COUNT):
        lanes.extend(gp.build_lanes(by_region[rid]))
    gates = gp.build_gates(gp.region_adjacency(centers), by_region)

    for lane in lanes + gates:
        gate = lane.kind == 'gate'
        pa = project(pos[lane.a.key], cam)
        pb = project(pos[lane.b.key], cam)
        if not pa or not pb:
            continue
        nearA = pa[3] <= VIEW_RADIUS
        nearB = pb[3] <= VIEW_RADIUS
        if not nearA and not nearB:
            continue
        ax, ay, bx, by = pa[0], pa[1], pb[0], pb[1]
        if nearA != nearB:
            near = pa if nearA else pb
            far = pb if nearA else pa
            t = (VIEW_RADIUS - near[3]) / (far[3] - near[3])
            cutx = near[0] + (far[0] - near[0]) * t
            cuty = near[1] + (far[1] - near[1]) * t
            if nearA:
                bx, by = cutx, cuty
            else:
                ax, ay = cutx, cuty
        alpha = fog(min(pa[3], pb[3])) * (0.5 if gate else 0.22)
        if alpha < 0.02:
            continue
        color = (167, 139, 250, int(255 * alpha)) if gate else (125, 211, 252, int(255 * alpha))
        draw.line([ax, ay, bx, by], fill=color, width=(3 * SS if gate else SS))

    visible = []
    for s, x, y, z in systems:
        pr = project((x, y, z), cam)
        if not pr or pr[3] > VIEW_RADIUS:
            continue
        visible.append((pr[0], pr[1], pr[2], pr[3], ECONOMY[s.economy]))
    visible.sort(key=lambda item: -item[2])

    for px, py, depth, dist, color in visible:
        alpha = max(0.45, fog(dist))
        radius = max(4 * SS, min(14 * SS, 16000 / depth * SS))
        draw.ellipse([px - radius * 3, py - radius * 3, px + radius * 3, py + radius * 3], fill=color + (int(255 * alpha * 0.2),))
        draw.ellipse([px - radius, py - radius, px + radius, py + radius], fill=color + (int(255 * alpha),))
        coreR = radius * 0.5
        draw.ellipse([px - coreR, py - coreR, px + coreR, py + coreR], fill=(255, 255, 255, int(255 * alpha * 0.8)))

    img = img.resize((W, H), Image.LANCZOS)
    out = os.path.join("doc", "galaxy-flight-preview.png")
    img.save(out)
    print(f"saved {out} · visible={len(visible)} / {len(systems)}")


if __name__ == "__main__":
    main()
