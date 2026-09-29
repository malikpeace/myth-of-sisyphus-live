#!/usr/bin/env python3
"""Cache-bust the V8 scripts/styles before a deploy: rewrites every `?v=v8-...` token in v8/index.html to the current time
(GitHub Pages caches for ~10 min; a stale core.js next to a fresh index.html is the classic half-updated-page bug).
usage: python3 v8/tools/bust.py"""
import re, time, os
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")
c = open(p).read()
tok = "v8-" + time.strftime("%m%d%H%M")
n = len(re.findall(r"\?v=v8-[A-Za-z0-9]+", c))
c = re.sub(r"\?v=v8-[A-Za-z0-9]+", "?v=" + tok, c)
open(p, "w").write(c)
print("busted %d references -> %s" % (n, tok))
