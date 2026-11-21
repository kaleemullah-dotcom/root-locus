"""
Independent cross-check of the Root Locus Studio engine with python-control + numpy.

For every case in scripts/out/engine.json (written by scripts/dump-cases.ts) it recomputes
  * open-loop poles                (python-control, multiple roots cluster-averaged)
  * breakaway / entry points & K   (numpy roots of N·D' − N'·D, K = −D/N real > 0)
  * jω crossings K_x, ω_x          (sweep of the right-half-plane root count + bisection,
                                    ω from python-control closed-loop poles)
and fails if anything differs from the engine by more than 1e-6 (relative).

Usage:  python scripts/verify.py [path/to/engine.json]
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import control

TOL = 1e-6


def rel_err(a: complex, b: complex, floor: float = 0.0) -> float:
    """Relative error; `floor` is an absolute scale below which values count as zero."""
    d = abs(a - b)
    if d == 0:
        return 0.0
    s = max(abs(a), abs(b), floor)
    return d / s if s > 0 else d


def term_scale(p: np.ndarray, s: complex) -> float:
    """Σ|a_k||s|^k — natural size of p(s) for cancellation-aware zero tests."""
    r = abs(s)
    return float(sum(abs(c) * r ** k for k, c in enumerate(reversed(p))))


def cluster_average(roots: np.ndarray, tol: float = 2e-4) -> list[complex]:
    """Replace clusters produced by multiple roots with their mean (accurate to O(eps))."""
    rs = [complex(r) for r in roots]
    used = [False] * len(rs)
    out: list[complex] = []
    for i, r in enumerate(rs):
        if used[i]:
            continue
        group = [j for j in range(len(rs)) if not used[j] and abs(rs[j] - r) <= tol * max(1.0, abs(r))]
        for j in group:
            used[j] = True
        mean = sum(rs[j] for j in group) / len(group)
        if abs(mean.imag) < 1e-12 * max(1.0, abs(mean)):
            mean = complex(mean.real, 0.0)
        out.extend([mean] * len(group))
    return out


def match_sets(engine: list[complex], ref: list[complex]) -> float:
    """Greedy nearest matching; returns worst relative error (inf if sizes differ)."""
    if len(engine) != len(ref):
        return math.inf
    left = list(ref)
    worst = 0.0
    for z in engine:
        j = min(range(len(left)), key=lambda k: abs(left[k] - z))
        worst = max(worst, rel_err(z, left[j]))
        left.pop(j)
    return worst


def hi_first(low_to_high: list[float]) -> np.ndarray:
    return np.array(list(reversed(low_to_high)), dtype=float)


def rhp_count(den: np.ndarray, num: np.ndarray, K: float, scale: float) -> int:
    ch = np.polyadd(den, K * num)
    ch = np.trim_zeros(ch, "f")
    if len(ch) <= 1:
        return 0
    r = np.roots(ch)
    return int(np.sum(r.real > 1e-11 * scale))


def ref_crossings(den: np.ndarray, num: np.ndarray, G: control.TransferFunction, k_hint: float):
    """K values where the number of RHP closed-loop poles changes (independent of the engine)."""
    pr = np.roots(den)
    scale = max([abs(complex(p)) for p in pr] + [1e-300])
    ks = k_hint * np.logspace(-7, 7, 6000)
    counts = [rhp_count(den, num, k, scale) for k in ks]
    events = []
    for i in range(1, len(ks)):
        if counts[i] != counts[i - 1]:
            lo, hi = ks[i - 1], ks[i]
            c_lo = counts[i - 1]
            for _ in range(200):
                mid = math.sqrt(lo * hi)
                if rhp_count(den, num, mid, scale) == c_lo:
                    lo = mid
                else:
                    hi = mid
                if hi / lo - 1 < 1e-15:
                    break
            Kx = math.sqrt(lo * hi)
            cl = control.feedback(Kx * G, 1)
            p = np.array(control.poles(cl), dtype=complex)
            w = float(abs(p[np.argmin(np.abs(p.real))].imag))
            events.append((Kx, w))
    return events


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "out" / "engine.json"
    cases = json.loads(path.read_text(encoding="utf8"))
    failures = 0
    print(f"python-control {control.__version__}, numpy {np.__version__} — {len(cases)} cases, tol {TOL:g}\n")
    print(f"{'case':<14}{'n':>3}{'m':>3}{'poles':>11}{'break':>11}{'K_brk':>11}{'K_x':>11}{'w_x':>11}  status")
    for c in cases:
        if "error" in c:
            print(f"{c['id']:<14} engine error: {c['error']}")
            failures += 1
            continue
        num = hi_first(c["N"])
        den = hi_first(c["D"])
        G = control.tf(num, den)
        errs: dict[str, float] = {}
        # ---- poles
        ref_p = cluster_average(np.array(control.poles(G), dtype=complex))
        eng_p = [complex(a, b) for a, b in c["poles"]]
        errs["poles"] = match_sets(eng_p, ref_p)  # exact zeros compare equal
        # ---- breakaway points
        P = np.polysub(np.polymul(num, np.polyder(den)), np.polymul(np.polyder(num), den))
        P = np.trim_zeros(P, "f")
        ref_b: list[tuple[complex, float]] = []
        if len(P) > 1:
            for s in cluster_average(np.roots(P)):
                Nv, Dv = np.polyval(num, s), np.polyval(den, s)
                if abs(Nv) < 1e-9 * term_scale(num, s) or abs(Dv) < 1e-9 * term_scale(den, s):
                    continue  # multiple pole / zero, K = 0 or ∞
                K = -Dv / Nv
                if abs(K.imag) <= 1e-7 * max(1.0, abs(K)) and K.real > 0:
                    if any(abs(s - t) < 1e-9 * max(1.0, abs(s)) for t, _ in ref_b):
                        continue  # multiple root of P reported once by the engine
                    ref_b.append((s, K.real))
        eng_b = [(complex(*b["s"]), b["K"]) for b in c["breakpoints"]]
        errs["break"] = match_sets([s for s, _ in eng_b], [s for s, _ in ref_b])
        if errs["break"] != math.inf:
            worst = 0.0
            for s, K in eng_b:
                j = min(range(len(ref_b)), key=lambda k: abs(ref_b[k][0] - s))
                worst = max(worst, rel_err(K, ref_b[j][1]))
            errs["K_brk"] = worst
        else:
            errs["K_brk"] = math.inf
        # ---- crossings (incl. the origin crossing)
        eng_x = [(x["K"], x["omega"]) for x in c["crossings"]]
        if c.get("originK") is not None:
            eng_x.append((c["originK"], 0.0))
        eng_x.sort()
        k_hint = max([k for k, _ in eng_x] + [b for _, b in eng_b] + [1.0])
        ref_x = ref_crossings(den, num, G, k_hint)
        # degree-drop events (n = m) change the root count without a crossing — drop them
        if c["n"] == c["m"]:
            kd = -c["D"][-1] / c["N"][-1]
            ref_x = [e for e in ref_x if abs(e[0] - kd) > 1e-6 * max(1.0, kd)]
        if len(ref_x) != len(eng_x):
            errs["K_x"] = errs["w_x"] = math.inf
        else:
            errs["K_x"] = max([rel_err(a[0], b[0]) for a, b in zip(eng_x, ref_x)] + [0.0])
            errs["w_x"] = max([rel_err(a[1], b[1]) for a, b in zip(eng_x, ref_x)] + [0.0])
        ok = all(v <= TOL for v in errs.values())
        if not ok:
            failures += 1
        fmt = lambda v: "   MISMATCH" if v == math.inf else f"{v:11.1e}"
        print(
            f"{c['id']:<14}{c['n']:>3}{c['m']:>3}"
            + "".join(fmt(errs[k]) for k in ("poles", "break", "K_brk", "K_x", "w_x"))
            + ("  ok" if ok else "  FAIL")
        )
        if not ok:
            print(f"    engine crossings {eng_x}\n    ref    crossings {ref_x}")
            print(f"    engine breaks {eng_b}\n    ref    breaks {ref_b}")
    print(f"\n{len(cases) - failures}/{len(cases)} cases agree to {TOL:g}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
