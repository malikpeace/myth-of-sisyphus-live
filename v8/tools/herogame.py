#!/usr/bin/env python3
"""Real-game hero capture. python3 herogame.py PORT REALM ALTS DEV PREFIX [look] [NFR]
Writes out/<PREFIX>_a<alt>_<i>.png (hero crop, native pixels) + out/<PREFIX>.json"""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gamecap import Game, ev
import gamecap
DEV = {"desk": (1440, 900), "port": (430, 932), "land": (932, 430)}
def cap(port, realm, alts, dev, prefix, look="", n=4, secs=5.0, host="http://127.0.0.1:8811"):
    w, h = DEV[dev]
    gamecap.GAME = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"); os.makedirs(gamecap.GAME, exist_ok=True)
    meta = {}
    Game.__init__.__defaults__  # noqa
    G = Game.__new__(Game); G.port, G.w, G.h = port, w, h
    with G:
        extra = (("&" + look) if "=" in look else ("&hero=" + look)) if look else ""      # LOOK may be a look name or raw extra params (e.g. pixels=chunky)
        G.start(realm, extra, host)
        for alt in alts:
            if alt: ev(G.ws, "window.__sisyphusQa.setAltitude(%s);1" % alt)
            ev(G.ws, "window.__drv=window.__sisyphusQa.drive(%s,6.5);1" % (secs + n * 0.35 + 2), await_=False)
            time.sleep(secs)
            rows = []
            for i in range(n):
                im = G.canvas(); dd = G.dbg(); d = None
                for _t in range(6):
                    try: d = json.loads(dd); break
                    except Exception: time.sleep(0.25); dd = G.dbg()
                fn = os.path.join(gamecap.GAME, "%s_a%d_%d.png" % (prefix, alt, i))
                im.save(fn); d["file"] = fn; d["size"] = im.size; rows.append(d); time.sleep(0.13)
            meta[alt] = rows
        print(prefix, "errs", ev(G.ws, "JSON.stringify(window.__errs)"))
    json.dump(meta, open(os.path.join(gamecap.GAME, prefix + ".json"), "w"))
if __name__ == "__main__":
    port, realm = int(sys.argv[1]), sys.argv[2]
    alts = [int(a) for a in sys.argv[3].split(",")]
    dev, prefix = sys.argv[4], sys.argv[5]
    look = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] != "-" else ""
    n = int(sys.argv[7]) if len(sys.argv) > 7 else 4
    cap(port, realm, alts, dev, prefix, look, n)
