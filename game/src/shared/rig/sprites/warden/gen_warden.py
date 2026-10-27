#!/usr/bin/env python3
# BREACH – generator for Warden trekvart-sprites (v3-prøve). Eies av Breach Karakter.
#
# Metode: «maling i kode» via en enkel 3D-volummodell (avrundede bokser, ellipsoider, kapsler, sylindre) som
# rendres med SDF-raymarching i nøyaktig samme skrå projeksjon som spillet (PROJ: skjerm = (x, y − 0,75·z)),
# lyses med LIGHT_DIR (55° elevasjon) og males: objektfaste støy-/ripeteksturer, kantslitasje fra krumning,
# AO, myk selvskygge, støv nederst, topplys, kantlys og mørk malt kontur. Alle retninger og rammer kommer fra
# SAMME modell, så de er konsistente. Kjøres én gang (python3 gen_warden.py); kjøretiden blitter bare PNG.
#
# Utdata (ved siden av dette skriptet): warden.png (figur-atlas, 2 px per verdens-px), warden_shadow.png
# (bakkeskygger, 1 px per verdens-px), manifest.js (layout, ankere, torso-offset per gangramme).
# Krever: python3, numpy, pillow. Ingen kjøretidsavhengighet.
import numpy as np, json, os, sys, time, math
from multiprocessing import Pool
from PIL import Image, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
F32 = np.float32
TILT_DEG = float(os.environ.get('BREACH_TILT_DEG', math.degrees(math.atan(3 / 4))))   # 27.10: vinkel fra loddrett (PROJ.tiltDeg); standard = atlasets bakevinkel
ZS = math.tan(math.radians(TILT_DEG))   # PROJ.zScale for den vinkelen
SCALE = 2                       # px per verdens-px i atlaset (maks spillzoom ≈ 2×)
SS = 2                          # supersampling
AY = max(58, int(math.ceil(58 * ZS / 0.75)))   # 27.10: fotanker følger zScale (høyere figur ved bratt vinkel)
CW, CH = 64, AY + 18            # celle i verdens-px
AX = 32
SW, SHH, SAX, SAY = 92, 92, 34, 30   # skyggecelle (1 px per verdens-px)
LD = np.array([-0.55, -0.85]); LD /= np.linalg.norm(LD); EL = 0.96
L3 = np.array([math.cos(EL) * LD[0], math.cos(EL) * LD[1], math.sin(EL)], F32); L3 /= np.linalg.norm(L3)
VIEW = np.array([0, 0.6, 0.8], F32)          # mot kameraet (sør og opp), tilt = atan(0,75)
RAYD = -VIEW
N_TORSO, N_LEGS, N_WALK = 16, 8, 8

# ------------------------------------------------------------------ matte
def rotm(yaw=0, pitch=0, roll=0):
    cz, sz, cy, sy, cx, sx = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]); Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    return Rz @ Ry @ Rx
def nrm(v): v = np.asarray(v, float); return v / (np.linalg.norm(v) + 1e-9)
def frame_x(axis, up=(0, 0, 1)):
    x = nrm(axis); u = np.asarray(up, float)
    if abs(np.dot(x, u)) > .95: u = np.array([1.0, 0, 0]) if abs(x[0]) < .9 else np.array([0, 1.0, 0])
    y = nrm(np.cross(u, x)); z = np.cross(x, y)
    return np.stack([x, y, z], 1)          # kolonner = lokale akser

class Prim:
    __slots__ = ('kind', 'c', 'R', 'p', 'mat', 'seed', 'decals', 'shadow_only')
    def __init__(s, kind, c, R, p, mat, seed, decals=None, shadow_only=False):
        s.kind, s.c, s.R, s.p, s.mat, s.seed, s.decals, s.shadow_only = kind, np.asarray(c, float), np.asarray(R, float), p, mat, seed, decals or [], shadow_only

class Model:
    def __init__(s): s.prims = []; s.seed = 0
    def add(s, kind, c, R, p, mat, decals=None, shadow_only=False, seed=None):
        s.seed += 1; s.prims.append(Prim(kind, c, R, p, mat, seed if seed is not None else s.seed, decals, shadow_only)); return s.prims[-1]
    def rbox(s, c, h, r, mat, rot=(0, 0, 0), **k): return s.add('rbox', c, rotm(*rot), (np.array(h, float), r), mat, **k)
    def ell(s, c, rad, mat, rot=(0, 0, 0), **k): return s.add('ell', c, rotm(*rot), np.array(rad, float), mat, **k)
    def cap(s, a, b, r1, r2, mat, up=(0, 0, 1), **k):
        a, b = np.asarray(a, float), np.asarray(b, float); return s.add('cap', a, frame_x(b - a, up), (float(np.linalg.norm(b - a)), r1, r2), mat, **k)
    def cyl(s, a, b, r, mat, up=(0, 0, 1), **k):
        a, b = np.asarray(a, float), np.asarray(b, float); return s.add('cyl', a, frame_x(b - a, up), (float(np.linalg.norm(b - a)), r), mat, **k)
    def boxalong(s, a, b, hy, hz, r, mat, off=(0, 0, 0), up=(0, 0, 1), shrink=0, **k):
        a, b = np.asarray(a, float), np.asarray(b, float); R = frame_x(b - a, up); L = np.linalg.norm(b - a)
        c = (a + b) / 2 + R @ np.asarray(off, float); return s.add('rbox', c, R, (np.array([L / 2 - shrink, hy, hz]), r), mat, **k)
    def transform(s, R, t=(0, 0, 0)):
        R = np.asarray(R, float); t = np.asarray(t, float)
        for p in s.prims: p.c = R @ p.c + t; p.R = R @ p.R
        return s

def sdf_prim(p, P):
    q = (P - p.c.astype(F32)) @ p.R.astype(F32)
    k = p.kind
    if k == 'rbox':
        h, r = p.p; qq = np.abs(q) - (h - r).astype(F32)
        return np.linalg.norm(np.maximum(qq, 0), axis=1) + np.minimum(qq.max(1), 0) - r, q
    if k == 'ell':
        rad = p.p.astype(F32); k0 = np.linalg.norm(q / rad, axis=1); k1 = np.linalg.norm(q / (rad * rad), axis=1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-6), q
    if k == 'cap':
        L, r1, r2 = p.p; t = np.clip(q[:, 0] / L, 0, 1); d = q.copy(); d[:, 0] -= t * L
        return np.linalg.norm(d, axis=1) - (r1 + (r2 - r1) * t), q
    if k == 'cyl':
        L, r = p.p; dx = np.abs(q[:, 0] - L / 2) - L / 2; dr = np.linalg.norm(q[:, 1:], axis=1) - r
        return np.minimum(np.maximum(dx, dr), 0) + np.hypot(np.maximum(dx, 0), np.maximum(dr, 0)), q
    raise ValueError(k)

def scene(prims, P, want_id=False, shadow=True):
    best = np.full(len(P), 1e9, F32); bid = np.zeros(len(P), np.int16) if want_id else None
    for i, p in enumerate(prims):
        if p.shadow_only and not shadow: continue
        d, _ = sdf_prim(p, P)
        if want_id: m = d < best; bid[m] = i
        best = np.minimum(best, d)
    return (best, bid) if want_id else best

# ------------------------------------------------------------------ støy (objektfast)
def hash3(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = h & 0xffffffff; h = (h ^ (h >> 13)) * 1274126177 & 0xffffffff; h = h ^ (h >> 16)
    return (h & 0xffff).astype(F32) / 65535.0
def vnoise(q, seed):
    f = np.floor(q); t = q - f; i = f.astype(np.int64); t = t * t * (3 - 2 * t)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out = out + w * hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out
def fbm(q, seed, oct=3, f0=0.5):
    a, s, tot = 1.0, 0, 0
    for o in range(oct): s = s + a * vnoise(q * f0 * (2 ** o), seed + o * 17); tot += a; a *= .5
    return s / tot

# ------------------------------------------------------------------ materialer (sRGB 0..1)
def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], F32)
MATS = {
    'armor':  dict(c=hexc('#45464a'), spec=.38, wear=1.0, dirt=1.0, scr=1.0),
    'armorL': dict(c=hexc('#64666a'), spec=.42, wear=1.25, dirt=.9, scr=1.0),
    'suit':   dict(c=hexc('#4a4436'), spec=.10, wear=0.0, dirt=1.2, scr=0.2),
    'fabric': dict(c=hexc('#8a7a5c'), spec=.04, wear=0.0, dirt=1.0, scr=0.0, weave=1),
    'gun':    dict(c=hexc('#1f2225'), spec=.55, wear=.9, dirt=.5, scr=.8),
    'paint':  dict(c=hexc('#2f86b4'), spec=.30, wear=1.6, dirt=.6, scr=.6, emit=.10),
    'visor':  dict(c=hexc('#39c6ff'), spec=.9, wear=0.0, dirt=0, scr=0, emit=1.0),
    'boot':   dict(c=hexc('#2c2823'), spec=.15, wear=.5, dirt=1.6, scr=.3),
    'pouch':  dict(c=hexc('#4a4535'), spec=.08, wear=.2, dirt=1.1, scr=0, weave=1),
    'glove':  dict(c=hexc('#2c2c2b'), spec=.15, wear=.3, dirt=.8, scr=0),
    'light':  dict(c=hexc('#7fe0ff'), spec=0, wear=0, dirt=0, scr=0, emit=1.4),
}
MAT_ID = {k: i for i, k in enumerate(MATS)}
WORN = hexc('#b3ada2'); DIRT = hexc('#5a4a36'); KEY = np.array([1.0, .93, .82], F32); AMB = np.array([.56, .58, .62], F32)

# ------------------------------------------------------------------ dekaler (lokale koordinater → maske)
def dec_helmet(q):     # visir foran (bred spalte) + cyan stripe over toppen
    zc = -0.35 + 0.16 * q[:, 1] ** 2   # løft endene → rett spalte sett ovenfra (ikke 'smil')
    visor = (q[:, 0] > 2.6) & (q[:, 2] > zc - 0.95) & (q[:, 2] < zc + 0.95) & (np.abs(q[:, 1]) < 3.6)
    stripe = (np.abs(q[:, 1]) < 0.75) & (q[:, 2] > 1.2) & (q[:, 0] > -3.5)
    return [(visor, 'visor'), (stripe & ~visor, 'paint')]
def dec_tri_top(q):    # cyan trekant på skulderplatens topp
    x, y = q[:, 0], q[:, 1]
    tri = (q[:, 2] > 0.6) & (x > -2.2) & (x < 2.6) & (np.abs(y) < (2.6 - x) * 0.55)
    return [(tri, 'paint')]
def dec_chest(q):      # emblem: trekant + midtstripe på brystplaten
    y, z = q[:, 1], q[:, 2]
    tri = (q[:, 0] > 0.3) & (z > -2.2) & (z < 2.4) & (np.abs(y) < (z + 2.2) * 0.5)
    return [(tri, 'paint')]
def dec_gunstripe(q):
    return [((np.abs(q[:, 2]) < .35) & (np.abs(q[:, 1]) > 1.0), 'paint')]
def dec_packstripe(q):
    return [((q[:, 0] < -2.4) & (np.abs(q[:, 2] - 2.5) < .45), 'paint')]

# ------------------------------------------------------------------ modell
def ik3(sh, hand, l1, l2, pole):
    sh, hand, pole = np.asarray(sh, float), np.asarray(hand, float), nrm(pole)
    d = hand - sh; L = np.linalg.norm(d); L2 = min(L, l1 + l2 - 1e-3); dn = d / L
    a = (l1 * l1 - l2 * l2 + L2 * L2) / (2 * L2); h = math.sqrt(max(0, l1 * l1 - a * a))
    pp = nrm(pole - np.dot(pole, dn) * dn)
    return sh + dn * a + pp * h, sh + dn * L2

def build_leg(m, s, hip, ankle, foot_pitch=0.0, foot_yaw=0.0, kneel_back=False, knee_override=None):
    hip, ankle = np.asarray(hip, float), np.asarray(ankle, float)
    if knee_override is not None: knee = np.asarray(knee_override, float)
    else: knee, ankle = ik3(hip, ankle, 9.7, 9.6, (1, s * 0.15, 0.1))
    m.cap(hip, knee, 3.5, 3.0, 'suit')
    m.boxalong(hip, knee, 1.3, 2.7, 1.0, 'armor', off=(0, s * 2.2, 0.6), shrink=2.0, up=(0, 0, 1))      # lårplate ute
    m.cap(knee, ankle, 3.0, 2.5, 'suit')
    sd = nrm(ankle - knee); fwd = nrm(np.cross(np.array([0, 0, 1.0]) if abs(sd[2]) < .95 else np.array([1.0, 0, 0]), sd))
    m.boxalong(knee, ankle, 2.2, 1.1, 0.9, 'armor', off=(0, 0, 0), up=(1, 0, 0) if not kneel_back else (0, 0, -1), shrink=1.4)  # leggskinne
    # kneskål foran kneet
    kd = nrm(np.array([1.0, 0, 0]) if not kneel_back else np.array([0.3, 0, -1.0]))
    m.ell(knee + kd * 1.7 + np.array([0, 0, .3]), (1.9, 2.5, 2.6), 'armorL')
    # støvel
    R = rotm(foot_yaw, foot_pitch, 0)
    c = ankle + R @ np.array([1.5, 0, -1.7])
    m.add('rbox', c, R, (np.array([4.5, 2.5, 1.9]), 1.2), 'boot')
    m.add('rbox', ankle + R @ np.array([4.8, 0, -2.0]), R, (np.array([1.4, 2.3, 1.5]), 1.0), 'gun')
    return knee

def lower_body(kind, phase=0.0):
    """kind: 'idle' | 'walk' | 'crouch'. Returnerer (Model, torso_dz)."""
    m = Model(); dz = 0.0
    if kind == 'crouch':
        pz = 11.8
        m.rbox((0, 0, pz + 0.5), (4.2, 6.8, 3.4), 1.8, 'suit')
        m.rbox((0, 0, pz + 2.5), (4.6, 7.2, 1.2), 0.8, 'pouch')
        for s in (-1, 1): m.rbox((2.6, s * 5.6, pz + 1), (1.6, 1.8, 2.2), .7, 'pouch'); m.rbox((-4.3, s * 3, pz + 1.5), (1.4, 2.2, 2.0), .7, 'pouch')
        # framfot venstre (s=−1): lår vannrett fram, legg ned
        build_leg(m, -1, (0.5, -4.4, pz - 0.5), (8.6, -6.2, 3.6), knee_override=(9.2, -5.6, 11.0))
        # bakre kne høyre i bakken, legg bak, tærne i bakken
        build_leg(m, 1, (0, 4.4, pz - 0.5), (-7.6, 5.4, 3.0), kneel_back=True, knee_override=(2.0, 5.2, 2.9), foot_pitch=-1.0)
        torso_proxy(m, pz - 20 + 0.0, crouch=True)
        return m, pz - 20.0
    A, H = 8.5, 4.2
    if kind == 'walk':
        dz = -0.75 + 0.75 * math.cos(2 * math.pi * (2 * phase - 0.5))
    pz = 20.0 + dz
    sway = 0.7 * math.sin(2 * math.pi * phase) if kind == 'walk' else 0
    hipyaw = 0.10 * math.sin(2 * math.pi * phase) if kind == 'walk' else 0
    pel = Model()
    pel.rbox((0, 0, 0.5), (4.2, 6.8, 3.4), 1.8, 'suit')
    pel.rbox((0, 0, 2.5), (4.6, 7.2, 1.2), 0.8, 'pouch')
    pel.rbox((4.3, 0, -0.6), (0.9, 2.6, 2.6), .7, 'armor')
    for s in (-1, 1): pel.rbox((2.6, s * 5.6, 1), (1.6, 1.8, 2.2), .7, 'pouch'); pel.rbox((-4.3, s * 3, 1.5), (1.4, 2.2, 2.0), .7, 'pouch')
    pel.transform(rotm(hipyaw), (0, sway, pz)); m.prims += pel.prims
    for s in (-1, 1):
        if kind == 'walk':
            q = (phase + (0 if s > 0 else .5)) % 1
            if q < .5: fx, lift = A - (q / .5) * 2 * A, 0.0
            else:
                t = (q - .5) / .5; e = 2 * t * t if t < .5 else 1 - (-2 * t + 2) ** 2 / 2
                fx, lift = -A + e * 2 * A, math.sin(t * math.pi)
            pitch = -0.35 * lift + (0.15 if q < .5 and q > .35 else 0)
        else:
            fx, lift, pitch = (1.0 if s < 0 else -0.5), 0.0, 0.0
        hy = math.cos(hipyaw) * s * 4.4; hx = -math.sin(hipyaw) * s * 4.4
        build_leg(m, s, (hx, sway + hy, pz - 0.5), (fx, s * 5.4, 3.6 + lift * H), foot_pitch=pitch, foot_yaw=s * 0.10)
    torso_proxy(m, dz)
    return m, dz

def torso_proxy(m, dz, crouch=False):
    # skygge-proxy for overkroppen (rotasjonssymmetrisk), så beina får selvskygge fra torso/skulderplater
    z = (31 if not crouch else 24) + dz * (0 if crouch else 1)
    m.ell((0 if not crouch else 2, 0, z + (0 if not crouch else 0)), (9.5, 9.5, 9.0), 'armor', shadow_only=True)

def upper_body(kind):
    """kind: 'stand' | 'crouch'. Torso-rom: x fram, y høyre, z opp; origo = bakkepunkt under hofta."""
    m = Model(); cr = kind == 'crouch'
    m.cap((0, 0, 21), (0.5, 0, 27.5), 5.0, 5.4, 'suit')
    m.rbox((1.2, 0, 31), (4.8, 7.8, 5.6), 3.0, 'armor', rot=(0, 0.10, 0))
    m.rbox((4.7, 0, 31.6), (1.4, 5.6, 4.3), 1.3, 'armorL', rot=(0, 0.12, 0), decals=[dec_chest])
    for s in (-1, 1):
        m.rbox((4.9, s * 3.6, 26.4), (1.1, 1.6, 2.0), .6, 'pouch')     # magasinlommer
        m.rbox((4.9, s * 0.0, 26.4), (1.0, 1.4, 1.8), .6, 'pouch') if s > 0 else None
    # skjerf/krage
    m.ell((1.0, 0, 37.0), (4.8, 6.4, 2.0), 'fabric')
    m.cap((-3.2, -2.6, 36.6), (-6.2, -4.0, 31.5), 1.6, 1.1, 'fabric')
    m.cap((-3.0, -1.0, 36.6), (-6.6, -1.4, 32.6), 1.4, 1.0, 'fabric')
    m.cap((0, 0, 36), (0.6, 0, 40), 2.6, 2.6, 'suit')
    # ryggsekk
    m.rbox((-7.3, 0, 31.5), (3.2, 6.0, 6.6), 2.0, 'armor', decals=[dec_packstripe])
    m.rbox((-7.2, 0, 38.4), (2.6, 5.0, 1.2), 0.8, 'armorL')
    for s in (-1, 1): m.cyl((-8.2, s * 6.8, 26.5), (-8.2, s * 6.8, 35.5), 1.5, 'gun')
    m.cap((-8.4, -4.4, 38.6), (-11.5, -6.0, 50.0), .42, .3, 'gun')
    m.ell((-10.7, 3.6, 34.0), (.6, .8, .8), 'light')
    # hjelm
    m.ell((1.3, 0, 43.2), (5.5, 5.0, 4.8), 'armor', decals=[dec_helmet])
    m.rbox((4.7, 0, 41.2), (1.5, 3.4, 1.5), 1.1, 'armorL')                         # kjeve/ansiktsplate
    for s in (-1, 1): m.cyl((0.8, s * 4.0, 42.4), (0.8, s * 5.6, 42.4), 1.7, 'armorL', up=(1, 0, 0))
    # skulderplater
    for s in (-1, 1):
        m.rbox((0.2, s * 9.8, 35.6), (4.8, 3.4, 2.4), 2.0, 'armor', rot=(0, 0, s * 0.38), decals=[dec_tri_top])
        m.rbox((0.4, s * 10.8, 32.0), (3.6, 2.4, 1.4), 1.1, 'armorL', rot=(0, 0, s * 0.62))
    # rifle
    if not cr: ro, rr = np.array([1.2, 4.0, 32.2]), rotm(-0.07, 0.10, 0.0)
    else: ro, rr = np.array([2.0, 3.6, 31.0]), rotm(-0.42, -0.42, 0.15)
    rif = Model(); rif.seed = 200
    rif.rbox((-1.5, 0, -0.3), (3.0, 1.1, 1.7), 0.7, 'gun')                # kolbe
    rif.rbox((6.8, 0, 0.1), (4.8, 1.35, 2.0), 0.6, 'gun')                 # låskasse
    rif.rbox((8.2, 0, -3.3), (1.2, 1.0, 2.2), 0.5, 'gun', rot=(0, -0.2, 0))  # magasin
    rif.rbox((4.0, 0, -2.6), (0.9, 0.9, 1.8), 0.5, 'gun', rot=(0, -0.3, 0))  # grep
    rif.rbox((15.4, 0, 0.3), (3.9, 1.35, 1.6), 0.6, 'gun', decals=[dec_gunstripe])
    rif.cyl((19.0, 0, 0.4), (27.0, 0, 0.4), 0.7, 'gun')
    rif.cyl((26.2, 0, 0.4), (28.0, 0, 0.4), 1.0, 'gun')
    rif.cyl((5.0, 0, 2.7), (10.8, 0, 2.7), 1.05, 'armorL')
    rif.transform(rr, ro)
    m.prims += rif.prims
    hR = ro + rr @ np.array([4.0, 0, -2.4]); hL = ro + rr @ np.array([13.5, -0.6, -1.4])
    for s, hand in ((1, hR), (-1, hL)):
        sh = np.array([0.6, s * 8.6, 34.0])
        elbow, hand2 = ik3(sh, hand, 8.8, 9.2, (-0.3, s * 1.0, -0.8))
        m.cap(sh, elbow, 2.6, 2.4, 'suit'); m.boxalong(sh, elbow, 2.2, 2.2, 1.2, 'armor', shrink=1.6)
        m.cap(elbow, hand2, 2.4, 2.0, 'suit'); m.boxalong(elbow, hand2, 2.4, 2.2, 1.2, 'armorL', shrink=1.8)
        m.ell(elbow, (1.9, 1.9, 1.9), 'armor')
        m.ell(hand2, (1.8, 1.6, 1.6), 'glove')
    if cr:   # huket: senk og len fram rundt hofta
        m.transform(np.eye(3), (0, 0, -20))
        m.transform(rotm(0, 0.30, 0), (0, 0, 0))
        m.transform(np.eye(3), (1.5, 0, 11.8))
    return m

# ------------------------------------------------------------------ rendering
def soft_shadow(prims, P, k=6.0, steps=22):
    res = np.ones(len(P), F32); t = np.full(len(P), 0.35, F32); act = np.arange(len(P))
    for _ in range(steps):
        if len(act) == 0: break
        d = scene(prims, P[act] + t[act, None] * L3)
        res[act] = np.minimum(res[act], np.clip(k * d / t[act], 0, 1))
        t[act] += np.clip(d, 0.25, 3.0)
        keep = (d > 0.01) & (t[act] < 40)
        res[act[d <= 0.01]] = 0
        act = act[keep]
    return res

def render_cell(job):
    kind, part, yaw, phase = job['kind'], job['part'], job['yaw'], job.get('phase', 0)
    if part == 'legs': m, _ = lower_body(kind, phase)
    else: m = upper_body(kind)
    m.transform(rotm(yaw))
    prims = m.prims
    vis = [p for p in prims if not p.shadow_only]
    R = SCALE * SS; W, H = CW * R, CH * R
    u = (np.arange(W, dtype=F32) + .5) / R - AX; v = (np.arange(H, dtype=F32) + .5) / R - AY
    U, V = np.meshgrid(u, v); U = U.ravel(); V = V.ravel()
    z0 = 56.0
    O = np.stack([U, V + ZS * z0, np.full_like(U, z0)], 1).astype(F32)
    N = len(O); t = np.zeros(N, F32); hit = np.zeros(N, bool); act = np.arange(N); tmax = (z0 + 1.5) / 0.8
    for it in range(110):
        if len(act) == 0: break
        P = O[act] + t[act, None] * RAYD
        d = scene(vis, P)
        t[act] += d * 0.9
        h = d < 0.02; ms = t[act] > tmax
        hit[act[h]] = True
        act = act[~(h | ms)]
    hi = np.nonzero(hit)[0]
    P = O[hi] + t[hi, None] * RAYD
    _, pid = scene(vis, P, want_id=True)
    e = 0.04
    nx = scene(vis, P + [e, 0, 0]) - scene(vis, P - [e, 0, 0]); ny = scene(vis, P + [0, e, 0]) - scene(vis, P - [0, e, 0]); nz = scene(vis, P + [0, 0, e]) - scene(vis, P - [0, 0, e])
    n = np.stack([nx, ny, nz], 1); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    # krumning (konvekse kanter > 0)
    e2 = 0.55; d0 = scene(vis, P)
    lap = sum(scene(vis, P + dv) + scene(vis, P - dv) for dv in ([e2, 0, 0], [0, e2, 0], [0, 0, e2])) - 6 * d0
    curv = lap / (e2 * e2)
    # AO
    ao = np.zeros(len(P), F32)
    for i, hh in enumerate((0.5, 1.1, 2.0, 3.2, 4.8)):
        ao += (hh - scene(prims, P + n * hh)) / hh * (0.55 ** i)
    ao = np.clip(1 - 0.42 * ao, 0, 1)
    sh = soft_shadow(prims, P + n * 0.08)
    # materiale + dekaler + objektfaste koordinater
    mat = np.zeros(len(P), np.int16); Q = np.zeros_like(P); seed = np.zeros(len(P), np.int64)
    for i, p in enumerate(vis):
        sel = pid == i
        if not sel.any(): continue
        _, q = sdf_prim(p, P[sel]); Q[sel] = q; seed[sel] = p.seed
        mm = np.full(sel.sum(), MAT_ID[p.mat], np.int16)
        for dec in p.decals:
            for mask, mname in dec(q): mm[mask] = MAT_ID[mname]
        mat[sel] = mm
    col = np.zeros((len(P), 3), F32); emit = np.zeros((len(P), 3), F32)
    names = list(MATS)
    zq = P[:, 2]
    # støy (seed per del, så hver plate får eget mønster)
    sd = (seed * 31) % 997
    Qs = Q + sd[:, None].astype(F32) * 3.17
    n1 = fbm(Qs, 11, 3, 0.45); n2 = fbm(Qs, 23, 2, 1.6)
    scr = vnoise(Qs * np.array([0.35, 2.6, 2.6], F32), 41) * vnoise(Qs * np.array([2.6, 0.35, 2.0], F32) + 7, 43)
    for mi, name in enumerate(names):
        sel = mat == mi
        if not sel.any(): continue
        M = MATS[name]; c = np.repeat(M['c'][None], sel.sum(), 0)
        var = (0.66 + 0.68 * n1[sel] + 0.22 * (n2[sel] - .5))[:, None]
        c = c * var
        if M.get('weave'):
            w = 0.88 + 0.12 * np.sin(Q[sel, 0] * 9 + Q[sel, 2] * 2) * np.sin(Q[sel, 2] * 9)
            c = c * w[:, None]
        # kantslitasje: konvekse kanter + støy → slitt metall
        if M['wear'] > 0:
            wm = np.clip((curv[sel] * 0.75 - 0.45 + (n2[sel] - .5) * 2.0) * M['wear'], 0, 1)
            if name == 'paint':   # slitt maling: flekkvis bort
                chip = np.clip((n2[sel] - 0.62) * 6, 0, 1); wm = np.maximum(wm, chip)
                c = c * (1 - wm[:, None]) + (MATS['armor']['c'] * 1.25)[None] * wm[:, None]
            else:
                c = c * (1 - wm[:, None] * .75) + WORN[None] * (wm[:, None] * .75)
        if M['scr'] > 0:
            s = np.clip((scr[sel] - 0.45) * 4, 0, 1) * M['scr']
            c = c + (WORN[None] - c) * (s[:, None] * .45)
        # støv/skitt: nede ved bakken og i hulrom
        dm = np.clip((1 - zq[sel] / 16) * 0.75 + (1 - ao[sel]) * 0.6 + (n1[sel] - .5) * .9, 0, 1) * 0.75 * M['dirt']
        c = c * (1 - dm[:, None]) + DIRT[None] * c.mean(1, keepdims=True) / DIRT.mean() * 1.1 * dm[:, None] * 0 + DIRT[None] * dm[:, None] * 0.55 + c * dm[:, None] * 0.45
        col[sel] = c
        if M.get('emit'): emit[sel] = M['c'] * M['emit']
    # lys
    ndl = n @ L3; key = np.clip(ndl * 0.9 + 0.1, 0, 1) * sh
    sky = 0.30 + 0.30 * np.clip(n[:, 2] * .5 + .5, 0, 1)
    fill = 0.10 * np.clip(n @ VIEW, 0, 1)
    spec_i = np.array([MATS[k]['spec'] for k in names], F32)[mat]
    Hv = nrm(L3 + VIEW).astype(F32); sp = np.clip(n @ Hv, 0, 1) ** 26 * spec_i * sh * (0.5 + n2)
    fres = (1 - np.clip(n @ VIEW, 0, 1)) ** 3
    rimside = np.clip(n[:, 0] * LD[0] + n[:, 1] * LD[1], 0, 1)
    lit = col * (AMB * (sky * ao)[:, None] + KEY * (key * 1.45)[:, None] + fill[:, None]) + sp[:, None] * KEY
    lit += (fres * (0.12 + 0.35 * rimside) * ao)[:, None] * np.array([.75, .82, .9], F32)
    lit *= (0.74 + 0.34 * np.clip(zq / 46, 0, 1))[:, None]          # topplys: hjelm lysest
    lit += emit * (0.6 + 0.4 * np.clip(n @ VIEW, 0, 1))[:, None]
    # bilde i SS-oppløsning
    img = np.zeros((N, 4), F32); img[hi, :3] = lit; img[hi, 3] = 1
    depth = np.full(N, np.nan, F32); depth[hi] = t[hi]
    img = img.reshape(H, W, 4); depth = depth.reshape(H, W)
    matimg = np.full(N, -1, np.int16); matimg[hi] = pid; matimg = matimg.reshape(H, W)
    # indre malte konturer: dybdesprang og del-grenser
    dpad = np.where(np.isnan(depth), 1e3, depth)
    jump = np.zeros((H, W), F32)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        sh_ = np.roll(np.roll(dpad, dy, 0), dx, 1); jump = np.maximum(jump, sh_ - dpad)
    line = np.clip((jump - 1.2) / 2.0, 0, 1) * 0.65
    pb = np.zeros((H, W), F32)
    for dy, dx in ((0, 1), (1, 0)):
        pb = np.maximum(pb, (np.roll(np.roll(matimg, dy, 0), dx, 1) != matimg).astype(F32))
    line = np.maximum(line, pb * 0.22) * img[..., 3]
    img[..., :3] *= (1 - line[..., None])
    # ytre kontur: utvid alfa ~0,8 verdens-px, mørk malt farge bak figuren
    a = Image.fromarray((img[..., 3] * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    oa = np.asarray(a, F32) / 255 * 0.92
    outc = np.array([.04, .045, .055], F32)
    A = img[..., 3]; comp_a = A + oa * (1 - A)
    comp_rgb = (img[..., :3] * A[..., None] + outc * (oa * (1 - A))[..., None])   # premultiplisert
    # nedskaler SS → atlas (premultiplisert boks)
    comp = np.concatenate([comp_rgb, comp_a[..., None]], 2).reshape(H // SS, SS, W // SS, SS, 4).mean((1, 3))
    rgb = np.where(comp[..., 3:4] > 1e-4, comp[..., :3] / np.maximum(comp[..., 3:4], 1e-4), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), comp[..., 3:4]], 2)
    # bakkeskygge
    sx = (np.arange(SW * 2, dtype=F32) + .5) / 2 - SAX; sy = (np.arange(SHH * 2, dtype=F32) + .5) / 2 - SAY
    GX, GY = np.meshgrid(sx, sy); G = np.stack([GX.ravel(), GY.ravel(), np.zeros(GX.size, F32)], 1).astype(F32)
    vis_s = [p for p in prims if not p.shadow_only]
    gs = 1 - soft_shadow(vis_s, G + np.array([0, 0, 0.05], F32), k=4.0, steps=26)
    gs = gs.reshape(SHH * 2, SW * 2).reshape(SHH, 2, SW, 2).mean((1, 3))
    return (np.clip(out * 255 + .5, 0, 255).astype(np.uint8), np.clip(gs * 255 + .5, 0, 255).astype(np.uint8))

# ------------------------------------------------------------------ jobber + atlas
def jobs():
    J = []
    for i in range(N_TORSO): J.append(dict(set='torso_stand', part='torso', kind='stand', yaw=i * 2 * math.pi / N_TORSO, dir=i, frame=0))
    for i in range(N_TORSO): J.append(dict(set='torso_crouch', part='torso', kind='crouch', yaw=i * 2 * math.pi / N_TORSO, dir=i, frame=0))
    for i in range(N_LEGS): J.append(dict(set='legs_idle', part='legs', kind='idle', yaw=i * 2 * math.pi / N_LEGS, dir=i, frame=0))
    for i in range(N_LEGS): J.append(dict(set='legs_crouch', part='legs', kind='crouch', yaw=i * 2 * math.pi / N_LEGS, dir=i, frame=0))
    for i in range(N_LEGS):
        for f in range(N_WALK): J.append(dict(set='legs_walk', part='legs', kind='walk', yaw=i * 2 * math.pi / N_LEGS, dir=i, frame=f, phase=f / N_WALK))
    return J

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    J = jobs()
    if only: J = [j for j in J if j['set'] == only]
    t0 = time.time()
    with Pool(int(os.environ.get('NPROC', os.cpu_count()))) as pool: res = pool.map(render_cell, J)
    print('render', len(J), 'celler', round(time.time() - t0, 1), 's')
    COLS = 16; cw, ch = CW * SCALE, CH * SCALE
    rows = (len(J) + COLS - 1) // COLS
    atlas = np.zeros((rows * ch, COLS * cw, 4), np.uint8); satlas = np.zeros((rows * SHH, COLS * SW), np.uint8)
    sets = {}
    for k, (j, (img, sh)) in enumerate(zip(J, res)):
        r, c = divmod(k, COLS); atlas[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] = img; satlas[r * SHH:(r + 1) * SHH, c * SW:(c + 1) * SW] = sh
        S = sets.setdefault(j['set'], {'dirs': 0, 'frames': 0, 'cells': {}})
        S['dirs'] = max(S['dirs'], j['dir'] + 1); S['frames'] = max(S['frames'], j['frame'] + 1); S['cells'][f"{j['dir']}_{j['frame']}"] = [c, r]
    suffix = '' if not only else '_' + only
    Image.fromarray(atlas, 'RGBA').save(os.path.join(OUT, f'warden{suffix}.png'), optimize=True)
    sh_rgba = np.zeros(satlas.shape + (4,), np.uint8); sh_rgba[..., 3] = satlas
    Image.fromarray(sh_rgba, 'RGBA').save(os.path.join(OUT, f'warden_shadow{suffix}.png'), optimize=True)
    walk_dz = [round(-0.75 + 0.75 * math.cos(2 * math.pi * (2 * (f / N_WALK) - 0.5)), 3) for f in range(N_WALK)]
    walk_sway = [round(0.7 * math.sin(2 * math.pi * f / N_WALK), 3) for f in range(N_WALK)]
    man = dict(version=1, scale=SCALE, cell=[CW, CH], anchor=[AX, AY], shadowCell=[SW, SHH], shadowAnchor=[SAX, SAY], cols=COLS,
               zScale=round(ZS, 4), tiltDeg=round(TILT_DEG, 2), sets=sets, walkTorsoDz=walk_dz, walkSway=walk_sway, crouchTorsoDz=0,
               note='Generert av gen_warden.py – ikke rediger for hånd. Vinkel for retning i = i·2π/dirs (0 = øst, med klokka).')
    if not only:
        with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
            f.write('// Generert av gen_warden.py – ikke rediger for hånd.\nexport const MANIFEST = ' + json.dumps(man, separators=(',', ':')) + ';\nexport default MANIFEST;\n')
    print('atlas', atlas.shape, 'skygge', satlas.shape, 'tid', round(time.time() - t0, 1), 's')

if __name__ == '__main__':
    main()
