#!/usr/bin/env python3
"""Rebuild fonts/material-symbols-outlined.woff2 with only the icons icons.js uses.

Usage: python3 scripts/subset-icons.py FULL_FONT.woff2
(needs: pip install fonttools brotli; get the full variable font from the
material-symbols npm package or Google Fonts.)
"""
import re, subprocess, sys
from fontTools.ttLib import TTFont

src = sys.argv[1]
names = sorted(set(re.findall(r':\s*"([a-z0-9_]+)"', re.search(r"const MAP = \{(.*?)\n  \};", open("icons.js").read(), re.S).group(1))))
f = TTFont(src)
cm = f.getBestCmap()
lig = {}
for l in f["GSUB"].table.LookupList.Lookup:
    for st in l.SubTable:
        st = getattr(st, "ExtSubTable", st)
        if hasattr(st, "ligatures"):
            for first, ls in st.ligatures.items():
                for L in ls:
                    lig[tuple([first] + L.Component)] = L.LigGlyph
keep = {cm[ord(c)] for c in "abcdefghijklmnopqrstuvwxyz0123456789_"}
for n in names:
    keep.add(lig[tuple(cm[ord(c)] for c in n)])
open("/tmp/glyphs.txt", "w").write(",".join(sorted(keep)))
subprocess.check_call(["pyftsubset", src, "--glyphs-file=/tmp/glyphs.txt", "--no-layout-closure", "--layout-features=*",
                       "--flavor=woff2", "--no-hinting", "--notdef-outline", "--output-file=fonts/material-symbols-outlined.woff2"])
