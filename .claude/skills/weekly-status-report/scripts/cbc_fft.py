#!/usr/bin/env python3
"""FFT-accelerated component-by-component (CBC) construction of a rank-1
lattice generating vector, for PRIME N only. Builds the same product-weight
P2 figure of merit as the direct O(p*N^2) search in scripts/cbc_lattice.py,
but in O(p*N*log N) by exploiting the cyclic structure of (Z/NZ)* and
computing the per-coordinate figure as a circular correlation via FFT
(Nuyens-Cools fast CBC specialized to alpha=2). See references/lattice-rff.md.

Does NOT handle: composite N (the group isn't cyclic of order N-1 -- use
cbc_lattice.py, or a more general embedding), extensible power-of-two
rules (use --extensible on cbc_lattice.py), alpha=4 / Walsh figures /
order-dependent weights (different kernel, same skeleton), or a Matern
inverse-cdf (still a map applied after z is built).
"""

import argparse
import cmath
import math

TWO_PI_SQ = 2 * math.pi ** 2


def frac(x):
    return x - math.floor(x)


def b2(x):
    return x * x - x + 1.0 / 6.0


def is_prime(n):
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    i = 3
    while i * i <= n:
        if n % i == 0:
            return False
        i += 2
    return True


def primitive_root(n):
    """Smallest primitive root of prime n."""
    phi = n - 1
    factors = set()
    m = phi
    d = 2
    while d * d <= m:
        if m % d == 0:
            factors.add(d)
            while m % d == 0:
                m //= d
        d += 1
    if m > 1:
        factors.add(m)
    for g in range(2, n):
        if all(pow(g, phi // f, n) != 1 for f in factors):
            return g
    raise ValueError(f"no primitive root found for {n}")


def _fft_pow2(a):
    n = len(a)
    if n == 1:
        return list(a)
    even = _fft_pow2(a[0::2])
    odd = _fft_pow2(a[1::2])
    result = [0j] * n
    for k in range(n // 2):
        t = cmath.exp(-2j * math.pi * k / n) * odd[k]
        result[k] = even[k] + t
        result[k + n // 2] = even[k] - t
    return result


def _ifft_pow2(a):
    n = len(a)
    out = _fft_pow2([x.conjugate() for x in a])
    return [x.conjugate() / n for x in out]


def _next_pow2(n):
    p = 1
    while p < n:
        p <<= 1
    return p


def fft_general(a):
    """DFT of arbitrary length via Bluestein's algorithm, falling back to
    the direct power-of-2 FFT when len(a) already is one."""
    n = len(a)
    if n & (n - 1) == 0:
        return _fft_pow2(list(a))

    chirp = [cmath.exp(-1j * math.pi * (k * k % (2 * n)) / n) for k in range(n)]
    length = _next_pow2(2 * n - 1)

    a_pad = [0j] * length
    for k in range(n):
        a_pad[k] = a[k] * chirp[k]

    b_pad = [0j] * length
    b_pad[0] = chirp[0].conjugate()
    for k in range(1, n):
        c = chirp[k].conjugate()
        b_pad[k] = c
        b_pad[length - k] = c

    conv = _ifft_pow2([x * y for x, y in zip(_fft_pow2(a_pad), _fft_pow2(b_pad))])
    return [chirp[k] * conv[k] for k in range(n)]


def ifft_general(a):
    n = len(a)
    out = fft_general([x.conjugate() for x in a])
    return [x.conjugate() / n for x in out]


def cbc_fft(n, p, gamma, tol=1e-9):
    """Fast CBC for prime n. Returns (z, P2(z))."""
    if not is_prime(n):
        raise ValueError("cbc_fft requires prime N -- composite N is not cyclic "
                          "of order N-1; use cbc_lattice.py instead")

    g = primitive_root(n)
    m = n - 1
    gp = [pow(g, u, n) for u in range(m)]          # gp[u] = g^u mod n
    kernel = [b2(frac(gp[u] / n)) for u in range(m)]

    prod = [1.0] * n
    z = [0] * p
    p2 = None

    for j in range(p):
        w = [prod[gp[u]] for u in range(m)]
        term0 = prod[0] * b2(0.0)

        w_hat = fft_general(w)
        k_hat = fft_general(kernel)
        r = ifft_general([wi.conjugate() * ki for wi, ki in zip(w_hat, k_hat)])
        s = [term0 + ri.real for ri in r]  # S(g^v), v = 0..m-1

        min_s = min(s)
        best_v = min(
            (v for v in range(m) if s[v] <= min_s + tol * (1.0 + abs(min_s))),
            key=lambda v: gp[v],
        )

        z[j] = gp[best_v]
        p2 = (sum(prod) + gamma * TWO_PI_SQ * s[best_v]) / n - 1.0

        prod[0] *= (1.0 + gamma * TWO_PI_SQ * b2(0.0))
        for u in range(m):
            k = gp[u]
            prod[k] *= (1.0 + gamma * TWO_PI_SQ * kernel[(u + best_v) % m])

    return z, p2


def _check_against_direct(n, p, gamma):
    from cbc_lattice import cbc_lattice

    z_fft, p2_fft = cbc_fft(n, p, gamma)
    z_direct, p2_direct = cbc_lattice(n, p, gamma, extensible=False)

    print(f"fft:    z = {' '.join(map(str, z_fft))}    P2 = {p2_fft:.10g}")
    print(f"direct: z = {' '.join(map(str, z_direct))}    P2 = {p2_direct:.10g}")
    print(f"|ΔP2| = {abs(p2_fft - p2_direct):.3g}")
    if z_fft == z_direct:
        print("z vectors match exactly.")
    else:
        print("z vectors differ (expected when P2 ties across generators -- "
              "same figure of merit, different equivalent lattice).")


def main():
    parser = argparse.ArgumentParser(
        description="FFT-accelerated CBC rank-1 lattice construction (prime N only).")
    parser.add_argument("--n", type=int, required=True, help="lattice size N (must be prime)")
    parser.add_argument("--p", type=int, required=True, help="dimension")
    parser.add_argument("--gamma", type=float, default=1.0,
                         help="product weight (uniform across coordinates)")
    parser.add_argument("--check-direct", action="store_true",
                         help="also run scripts/cbc_lattice.py's direct search and compare")
    args = parser.parse_args()

    if args.check_direct:
        _check_against_direct(args.n, args.p, args.gamma)
        return

    z, p2 = cbc_fft(args.n, args.p, args.gamma)
    print(f"n={args.n} p={args.p} gamma={args.gamma}")
    print("z =", " ".join(str(zi) for zi in z))
    print(f"P2 = {p2:.6g}")


if __name__ == "__main__":
    main()
