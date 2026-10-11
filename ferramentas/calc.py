#!/usr/bin/env python3
"""Mesmo motor de cálculo de app.js, para gerar as tabelas dos artigos.

Uso:
  python3 ferramentas/calc.py sobra CARTAO PIX N [--cdi 13.65] [--pct 100] [--sem-ir] [--juros 0.019]
  python3 ferramentas/calc.py empate N [--cdi 13.65] [--pct 100] [--sem-ir]
  python3 ferramentas/calc.py verificar   # confere contra os exemplos já publicados

"sobra" > 0: parcelar compensa (quanto sobra no fim). < 0: o Pix ganha (quanto faltaria).
"empate": desconto no Pix, em %, que empata com N parcelas sem juros.
Esta pasta não é publicada (ver netlify.toml).
"""
import argparse
import sys

CDI_PADRAO = 13.65


def ir_rate(d):
    return .225 if d <= 180 else .20 if d <= 360 else .175 if d <= 720 else .15


def days_of(m):
    # Math.round do JS (arredonda .5 para cima)
    return int(m * 30.44 + 0.5)


def monthly_gross(cdi, pct):
    return (1 + ((1 + cdi / 100) ** (1 / 252) - 1) * pct / 100) ** 21 - 1


def net_factor(g, m, ir):
    return 1 + ((1 + g) ** m - 1) * (1 - (ir_rate(days_of(m)) if ir else 0))


def pmt_of(card, k, i):
    return card * i / (1 - (1 + i) ** -k) if i > 0 else card / k


def sobra(card, pix, k, cdi=CDI_PADRAO, pct=100, ir=True, i=0.0):
    g = monthly_gross(cdi, pct)
    pmt = pmt_of(card, k, i)
    L, falta = pix, 0.0
    for m in range(1, k + 1):
        N = net_factor(g, m, ir)
        avail = L * N if L > 0 else 0
        if avail >= pmt:
            L -= pmt / N
        else:
            falta += pmt - avail
            L = 0
    return L * net_factor(g, k, ir) if L > 0 else -falta


def empate(k, cdi=CDI_PADRAO, pct=100, ir=True, i=0.0):
    """Desconto (%) no Pix em que sobra == 0."""
    lo, hi = 0.0, 60.0
    for _ in range(100):
        mid = (lo + hi) / 2
        if sobra(1000, 1000 * (1 - mid / 100), k, cdi, pct, ir, i) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def br(v, casas=2):
    s = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if v < 0 else "") + s


def verificar():
    casos = [  # (cartão, pix, n, esperado) — artigos publicados em 11/10/2026
        (3000, 2910, 10, 50.64), (3000, 2850, 10, -14.76), (3000, 2790, 10, -80.17),
        (2500, 2400, 12, 38.62), (2500, 2300, 12, -72.64), (2500, 2400, 6, -29.47),
        (2000, 1900, 10, -9.84),
    ]
    ok = True
    for c, p, n, esp in casos:
        r = round(sobra(c, p, n), 2)
        bom = abs(r - esp) < 0.006
        ok &= bom
        print(f"{'ok ' if bom else 'ERRO'} {c} / {p} em {n}x: {r} (esperado {esp})")
    for n, esp in [(3, 1.6), (6, 2.9), (10, 4.5), (12, 5.4)]:
        r = round(empate(n), 1)
        ok &= abs(r - esp) < 0.05
        print(f"empate {n}x: {r}% (esperado {esp}%)")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd")
    ap.add_argument("args", nargs="*", type=float)
    ap.add_argument("--cdi", type=float, default=CDI_PADRAO)
    ap.add_argument("--pct", type=float, default=100)
    ap.add_argument("--sem-ir", action="store_true")
    ap.add_argument("--juros", type=float, default=0.0, help="taxa ao mês, ex. 0.019")
    a = ap.parse_args()
    ir = not a.sem_ir
    if a.cmd == "verificar":
        sys.exit(0 if verificar() else 1)
    if a.cmd == "sobra":
        c, p, n = a.args
        print(br(sobra(c, p, int(n), a.cdi, a.pct, ir, a.juros)))
    elif a.cmd == "empate":
        print(br(empate(int(a.args[0]), a.cdi, a.pct, ir, a.juros), 1) + "%")
    else:
        ap.error("comando desconhecido")


if __name__ == "__main__":
    main()
