#!/usr/bin/env python3
"""Prepara um artigo agendado para ir ao ar (usado pela tarefa de publicação).

Uso: python3 ferramentas/publicar.py SLUG AAAA-MM-DD

- coloca a data de publicação no artigo (meta "Atualizado em", JSON-LD);
- remove de "Leia também" links para artigos que ainda não existem no site;
- adiciona o artigo no topo de /artigos/ e no sitemap.xml (sem duplicar).
Rodar na raiz do repositório, com o ramo do artigo já atualizado sobre main.
"""
import html
import re
import sys
from pathlib import Path

MESES = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split()


def data_br(iso):
    a, m, d = iso.split("-")
    return f"{int(d)} de {MESES[int(m) - 1]} de {a}"


def main(slug, data):
    raiz = Path(".")
    art = raiz / "artigos" / slug / "index.html"
    s = art.read_text(encoding="utf-8")

    s = re.sub(r"Atualizado em [^·<]+? de \d{4}", "Atualizado em " + data_br(data), s, count=1)
    s = re.sub(r'"datePublished": "[\d-]+"', f'"datePublished": "{data}"', s)
    s = re.sub(r'"dateModified": "[\d-]+"', f'"dateModified": "{data}"', s)

    def filtra(m):
        alvo = m.group(1)
        return m.group(0) if (raiz / "artigos" / alvo / "index.html").exists() else ""
    s = re.sub(r'<li><a href="/artigos/([^/"]+)/">[^<]*</a></li>', filtra, s)
    art.write_text(s, encoding="utf-8")

    titulo = html.unescape(re.search(r"<h1>(.*?)</h1>", s).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', s).group(1))

    idx = raiz / "artigos" / "index.html"
    t = idx.read_text(encoding="utf-8")
    url = f"/artigos/{slug}/"
    if f'href="{url}"' not in t:
        item = f'<li><a href="{url}"><b>{html.escape(titulo, quote=False)}</b><span>{html.escape(desc, quote=False)}</span></a></li>'
        t = t.replace('<ul class="list">', '<ul class="list">' + item, 1)
        idx.write_text(t, encoding="utf-8")

    sm = raiz / "sitemap.xml"
    x = sm.read_text(encoding="utf-8")
    loc = f"https://pixoucartao.com.br{url}"
    x = re.sub(r"(<loc>https://pixoucartao.com.br/artigos/</loc><lastmod>)[\d-]+", r"\g<1>" + data, x)
    if loc not in x:
        linha = f"  <url><loc>{loc}</loc><lastmod>{data}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n"
        x = x.replace("  <url><loc>https://pixoucartao.com.br/sobre/", linha + "  <url><loc>https://pixoucartao.com.br/sobre/", 1)
        sm.write_text(x, encoding="utf-8")
    print(f"ok: {slug} preparado para {data_br(data)}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
