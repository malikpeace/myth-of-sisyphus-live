#!/usr/bin/env python3
"""Render one frame of a realm with synthetic terrain and save its native pixels.
usage: python3 realmshot.py NAME "realm=hills&alt=350&zoom=0.6&slope=0.22" [w h [port]]
Requires the static server on :8811 (see REALM-GUIDE.md). Output: v8/tools/out/NAME.png"""
import sys, os
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
from cdp import run
def main():
    name, q = sys.argv[1], sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 480; h = int(sys.argv[4]) if len(sys.argv) > 4 else 300
    port = int(sys.argv[5]) if len(sys.argv) > 5 else 9600
    if "w=" not in q: q += "&w=%d&h=%d" % (w, h)
    out = os.path.join(here, "out"); os.makedirs(out, exist_ok=True)
    url = "http://127.0.0.1:8811/v8/tools/realm-test.html?" + q
    r = run(url, w, h, [("wait", 1.5), ("js", "document.title"), ("js", "JSON.stringify(window.__errs)"), ("canvas", os.path.join(out, name + ".png"))], quiet=True, port=port)
    print(name, r)
if __name__ == "__main__": main()
