#!/usr/bin/env python3
"""Bygger data/positivliste.json ud fra Skattestyrelsens ABIS-liste (Excel).

Brug (én gang om året, når skat.dk lægger en ny liste op):
    1. Hent "Liste over aktiebaserede investeringsselskaber" fra
       https://skat.dk/erhverv/ekapital/vaerdipapirer/beviser-og-aktier-i-investeringsforeninger-og-selskaber-ifpa
    2. python3 scripts/build-positivliste.py <fil.xlsx> <år> <udgivelsesdato> [kilde-url]
       fx: python3 scripts/build-positivliste.py abis.xlsx 2026 2026-08-28

Kun Pythons standardbibliotek - en .xlsx er zippet XML.
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL_ID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
ISIN = re.compile(r'^[A-Z]{2}[A-Z0-9]{9}[0-9]$')


def read_sheet(path, name):
    z = zipfile.ZipFile(path)
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            strings.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheet = next(s for s in wb.find('m:sheets', NS) if s.get('name') == name)
    target = rels[sheet.get(REL_ID)].lstrip('/')
    target = target if target.startswith('xl/') else 'xl/' + target
    rows = []
    for row in ET.fromstring(z.read(target)).iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            col = re.match(r'[A-Z]+', c.get('r')).group()
            v = c.find('m:v', NS)
            if c.get('t') == 's' and v is not None:
                cells[col] = strings[int(v.text)]
            elif c.get('t') == 'inlineStr':
                cells[col] = ''.join(t.text or '' for t in c.iter('{%s}t' % NS['m']))
            else:
                cells[col] = v.text if v is not None else ''
        rows.append(cells)
    return rows


def clean(value):
    value = (value or '').strip()
    value = re.sub(r'\s+(null|None|nan)$', '', value, flags=re.I)   # rester fra Skattestyrelsens eksport
    return '' if value in ('[tom]', '-', '') else re.sub(r'\s+', ' ', value)


def main(path, year, published, source):
    rows = read_sheet(path, str(year))
    header = rows[0]
    assert 'ISIN' in header.get('B', ''), f'Uventet overskrift: {header}'
    funds, seen = [], set()
    for r in rows[1:]:
        isin = clean(r.get('B')).upper().replace(' ', '')
        isin = isin if ISIN.match(isin) else ''
        name = clean(r.get('C')) or clean(r.get('F')) or clean(r.get('H'))
        if not name and not isin:
            continue
        country = re.search(r'\(([A-Z]{2})\)', r.get('A', '') or '')
        # "Registrerede år" kan stå som "2025.2026000000001" i arket - tag bare årstallene.
        years = sorted({int(y) for y in re.findall(r'20\d\d', r.get('I', '') or '') if 2015 <= int(y) <= year})
        if year not in years:
            continue
        key = (isin, name)
        if key in seen:
            continue
        seen.add(key)
        funds.append([isin, name, country.group(1) if country else '', years[0] if years else year])
    funds.sort(key=lambda f: (f[1].lower(), f[0]))
    out = {'year': year, 'published': published, 'source': source, 'count': len(funds),
           'columns': ['isin', 'name', 'country', 'since'], 'funds': funds}
    with open('data/positivliste.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(funds)} fonde skrevet til data/positivliste.json')


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1], int(sys.argv[2]), sys.argv[3],
         sys.argv[4] if len(sys.argv) > 4 else 'https://skat.dk/erhverv/ekapital/vaerdipapirer/beviser-og-aktier-i-investeringsforeninger-og-selskaber-ifpa')
