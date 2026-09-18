#!/usr/bin/env python3
"""Component-by-component (CBC) construction of a rank-1 lattice generating
vector, for use as the frequency set in lattice-RFF (see
references/lattice-rff.md). Minimizes the product-weight P2 figure of merit
and can map nodes through an SE/RBF spectral inverse-cdf.
"""

import argparse
import math
from math import gcd

TWO_PI_SQ = 2 * math.pi ** 2


def frac(x):
    return x - math.floor(x)


def b2(x):
    return x * x - x + 1.0 / 6.0


def acklam_inv_cdf(p):
    """Acklam's rational approximation to the standard normal inverse CDF."""
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
         3.754408661907416e+00]

    p_low = 0.02425
    p_high = 1.0 - p_low

    if p < p_low:
        q = math.sqrt(-2.0 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1.0)
    if p <= p_high:
        q = p - 0.5
        r = q * q
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / \
               (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1.0)
    q = math.sqrt(-2.0 * math.log(1.0 - p))
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1.0)


def clamp01(x, eps=1e-12):
    return min(max(x, eps), 1.0 - eps)


def eligible_a(n, extensible):
    if extensible:
        return [a for a in range(1, n) if a % 2 == 1]
    return [a for a in range(1, n) if gcd(a, n) == 1]


def cbc_lattice(n, p, gamma, extensible):
    """Build a rank-1 generating vector z minimizing product-weight P2,
    one coordinate at a time. Returns (z, P2(z))."""
    candidates = eligible_a(n, extensible)
    prod = [1.0] * n
    z = [0] * p
    p2 = None

    for j in range(p):
        best_a, best_p2 = None, None
        for a in candidates:
            total = 0.0
            for k in range(n):
                total += prod[k] * (1.0 + gamma * TWO_PI_SQ * b2(frac(k * a / n)))
            candidate_p2 = total / n - 1.0
            if best_p2 is None or candidate_p2 < best_p2:
                best_p2, best_a = candidate_p2, a
        z[j] = best_a
        p2 = best_p2
        for k in range(n):
            prod[k] *= (1.0 + gamma * TWO_PI_SQ * b2(frac(k * z[j] / n)))

    return z, p2


def se_frequencies(z, n, shift=None, drop_zero=True):
    """Map lattice nodes {s*z/n + shift} through the SE/RBF spectral
    inverse-cdf (standard Gaussian, after ARD coding). Drops s=0 by default
    so it never gets pushed through Phi^-1 at exactly 0."""
    p = len(z)
    if shift is None:
        shift = [0.0] * p
    start = 1 if drop_zero else 0
    omegas = []
    for s in range(start, n):
        v = [frac(s * z[j] / n + shift[j]) for j in range(p)]
        omega = [acklam_inv_cdf(clamp01(vi)) for vi in v]
        omegas.append(omega)
    return omegas


def main():
    parser = argparse.ArgumentParser(
        description="CBC rank-1 lattice construction for lattice-RFF.")
    parser.add_argument("--n", type=int, required=True, help="lattice size N")
    parser.add_argument("--p", type=int, required=True, help="dimension")
    parser.add_argument("--gamma", type=float, default=1.0,
                         help="product weight (uniform across coordinates)")
    parser.add_argument("--extensible", action="store_true",
                         help="restrict to odd a for N=2^L extensible lattices")
    parser.add_argument("--print-omega", action="store_true",
                         help="also print SE-spectrum frequencies via Phi^-1")
    args = parser.parse_args()

    z, p2 = cbc_lattice(args.n, args.p, args.gamma, args.extensible)

    tag = " extensible" if args.extensible else ""
    print(f"n={args.n} p={args.p} gamma={args.gamma}{tag}")
    print("z =", " ".join(str(zi) for zi in z))
    print(f"P2 = {p2:.6g}")

    if args.print_omega:
        for omega in se_frequencies(z, args.n):
            print(" ".join(f"{w:.6f}" for w in omega))


if __name__ == "__main__":
    main()
