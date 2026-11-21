# Root Locus Studio

**Live app:** _https://your-project.vercel.app_ (placeholder — replace with the Vercel URL after the first deploy)

Root Locus Studio solves the root locus of any open-loop transfer function
G(s)H(s) = K·N(s)/D(s). It shows the full working in the **7-rule (R1–R7) table** used in our Linear Control Systems course, an exact **Routh array** in K, the **stable K ranges**, and an **interactive, accurate root-locus plot**.

## Features
- **Three input modes:** N(s)/D(s), one line (`K(s+2)/(s(s+1)(s+5))`), or pole/zero/gain lists (complex values such as `-1+2j`; missing conjugates are added). Input is factored or polynomial, with implicit multiplication, decimals and `^`. A live KaTeX preview shows the parsed function, and errors give clear positions.
- **Validation:** improper G(s)H(s) (m > n) is rejected with an explanation. Common pole–zero factors are cancelled exactly, with a warning. A negative effective gain switches to the 0° rules with a notice.
- **Rule table:** columns Rule # · Name · Formula · Calculations · Results · Plot · Remarks, in the teacher's style and colours. R2 tests every interval. R5 lists every root of P(s) and marks it ✓ or ✗ with the reason. R6 lists every angle. R7 shows the vanishing row, Kₓ, the auxiliary equation and sₓ. R4 includes the tan-rule check. On phones the table becomes one card per rule.
- **Routh panel:** exact rational entries in K in the teacher's form, e.g. `(40.8 − 5K)/6.8`, with a red bar after the sᵏ column. It also shows the first-column conditions, every crossing with its auxiliary equation, and explanations of the **ε** and **zero-row** special cases.
- **Plot:** custom SVG with true 1:1 aspect, so a circle locus looks like a circle. It has a grid, auto view, zoom/pan/reset, hover readout (s, K, ζ, ωₙ), direction arrows, labels that don't overlap, the legend drawn on the graph, and PNG/SVG export.
- **Gain range K > 0 / K < 0 / Both:** the K < 0 (complementary, 0°) locus is solved exactly with the same 7 rules: its own real-axis segments, asymptotes, break points and jω crossings. It is drawn in teal so the two ranges stay clearly apart.
- **Interactive:** a log-scale K slider and **Play** button move the closed-loop poles along the locus for the selected range (in *Both*, Play sweeps 0 → +∞ and then 0 → −∞). Speed is adjustable (default *Slow*: 24 s per sweep). The simulation card sits beside the plot, so the plot and the controls fit on one screen. A live readout shows the poles, ζ, ωₙ, a stable/marginal/unstable badge and a step-response chart. Clicking a rule highlights it on the plot. **Step-by-step (Teach) mode** reveals one rule at a time while the plot builds up.
- **Export & share:** A4-landscape **PDF** (table, Routh, vector plot + legend), a print stylesheet, and a shareable URL (`#tf=K/(s(s+4)(s+5))`).

## The method (R1–R7)
| Rule | Name | Formula |
|---|---|---|
| R1 | No. of branches | = n if n ≥ m, otherwise m |
| R2 | Real-axis segment | points to the left of an odd number of real poles + zeros |
| R3 | Angles of asymptotes | θₖ = (180° + 360°·i)/(n − m) |
| R4 | Centroid | σ = (Σ poles − Σ zeros)/(n − m) |
| R5 | Breakaway / entry | P = N·D′ − N′·D = 0, K = −D/N at the root |
| R6 | Departure / approach | φ_dp = −Σ other pole ∠ + Σ zero ∠ + 180°; φ_az = −Σ other zero ∠ + Σ pole ∠ − 180° |
| R7 | jω crossings | 1 + KG(s)H(s) = 0 → Routh table → Kₓ, sₓ |

The engine goes beyond the hand method where that is needed for correctness. It accepts complex break points when K is real and positive, gives the true multiplicity at multiple meeting points, reports every jω crossing (not just the first), handles repeated poles in R6, and supports the 0° locus.

## How correctness is verified
The engine (`src/engine`, pure TypeScript, strict, no `any`) uses exact BigInt rational arithmetic. It does exact square-free factorisation for true multiplicities, Sturm-certified real-root counts, Aberth–Ehrlich root finding with Newton polishing, an exact symbolic Routh array in K (with ε and auxiliary-polynomial handling), and exact Routh–Hurwitz tests at rational K for the stability intervals. A dense numeric scan cross-checks those intervals. The locus is traced with an adaptive step and optimal (Hungarian) branch matching, in a Web Worker.

- `npm run test:unit`: **56 Vitest tests**, covering all course reference cases plus a zero row, the ε case, a double pole at the origin, n = m, conditional stability, complex breakaways, a triple meeting point, the 0° locus, and branch continuity.
- `npm run verify`: `scripts/verify.py` independently recomputes poles, breakaway points and K, and Kₓ/ωₓ for **45 transfer functions** (23 hand-picked + 22 seeded random) with **python-control + numpy**. It uses different algorithms: cluster-averaged numpy roots, and a right-half-plane root-count sweep with bisection. **All agree to better than 1e-6 relative** (typically 1e-9 to 1e-15).
- `npm run e2e`: 19 Playwright interaction checks (inputs, errors, highlighting, slider/Play, PNG/SVG/PDF export, Teach mode, sharing, mobile layout, no console errors).
- `npm run screenshots`: every example at 1440 px and 390 px, failing on console errors or horizontal overflow.
- `npm run lighthouse`: median of 3 runs. Desktop: performance 98–99, accessibility 100. Mobile: accessibility 100, performance 81–96 (median about 88), because Lighthouse's simulated throttling is noisy on a busy machine.

## Run locally
```bash
npm install
pip install control numpy scipy   # for the cross-check
npm run dev            # http://localhost:5173
npm test               # unit tests + python cross-check
npm run build && npm run e2e && npm run screenshots
```

## Deploy (Vercel)
1. On vercel.com choose **Add New → Project → Import** `kaleemullah-dotcom/root-locus`.
2. Vercel reads `vercel.json`: framework Vite, `npm ci`, `npm run build`, output `dist`. No environment variables are needed; the app is fully static.
3. Every push to `main` redeploys, and pull requests get preview URLs.

`vercel.json` also sets security headers (Content-Security-Policy, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) and immutable caching for hashed assets. GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, the unit tests, the python-control cross-check and the build on every push.

Netlify works the same way (build `npm run build`, publish `dist`). For GitHub Pages, build with `BASE_PATH=/root-locus/ npm run build`.

## For instructors
- Open any problem directly by URL, e.g. `…/#tf=K/(s(s%2B3)(s%5E2%2B2s%2B2))`, or use **Copy link**.
- **Step-by-step** mode is meant for presenting: use ← → to reveal R1 … R7 and then the Routh array. The plot shows only what has been derived so far.
- **Export PDF** produces an A4-landscape handout (table, Routh array, plot with legend).
- The *Book Table 4.2* entries (a), (c), (d), (k), (o), (p) come from the course. The other letters in the examples list are classic shapes labelled **Gallery**.

## Known limitations
- Time delays (e^{−sT}) and symbolic parameters other than K are out of scope. Coefficients must be numbers (decimals are converted to exact rationals).
- Displayed values are rounded to 3–4 decimals. Internally, exact or about 1e-10.
- Very high orders (n > 12) work, but the Routh expressions get long.
- The rule table and Routh array are written for K > 0 (the course convention). The K < 0 locus is analysed exactly but shown on the plot and in the simulation.
