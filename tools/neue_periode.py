#!/usr/bin/env python3
"""Legt data/p{n}.json für eine neue Periode an.

Aufruf:
  python3 tools/neue_periode.py <n> <Sammelbericht.pdf> [prognose.json]

  n              Nummer der Periode, deren Sammelbericht vorliegt
  prognose.json  Wirtschaftsnachrichten für Periode n+1 (Schlüssel wie in data/p0.json "prognose").
                 Fehlt die Datei, wird die Prognose der Vorperiode übernommen und markiert.

Danach immer: node tools/check.mjs
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parse_sammelbericht import parse  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data')


def main():
    n, pdf = int(sys.argv[1]), sys.argv[2]
    prev = json.load(open(os.path.join(ROOT, f'p{n - 1}.json'), encoding='utf-8'))
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout
    berichte = parse(txt)
    if len(sys.argv) > 3:
        prognose, hinweis = json.load(open(sys.argv[3], encoding='utf-8')), ''
    else:
        prognose, hinweis = dict(prev['prognose']), 'PROGNOSE NOCH NICHT EINGETRAGEN – Werte der Vorperiode übernommen. '
    out = {
        'periode': n,
        'quelle': os.path.basename(pdf),
        'hinweis': hinweis + 'nachrichten = Parameter, die in dieser Periode galten. prognose = Wirtschaftsnachrichten für die nächste Periode.',
        'nachrichten': prev['prognose'],
        'prognose': prognose,
        'berichte': berichte,
    }
    json.dump(out, open(os.path.join(ROOT, f'p{n}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    idx_path = os.path.join(ROOT, 'index.json')
    idx = json.load(open(idx_path))
    if n not in idx['perioden']:
        idx['perioden'] = sorted(idx['perioden'] + [n])
    json.dump(idx, open(idx_path, 'w'))
    print(f'data/p{n}.json geschrieben ({len(berichte)} Berichtswerte). Jetzt: node tools/check.mjs')


if __name__ == '__main__':
    main()
