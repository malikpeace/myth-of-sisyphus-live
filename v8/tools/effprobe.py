import sys, json
sys.path.insert(0, '.')
from start8 import *
steps = list(START) + [("js", "window.__sisyphusQa.drive(4,6.5).then(function(r){return JSON.stringify(r)})"), ("js", "JSON.stringify(window.__sisyphusQa.feel())"),
        ("js", "window.__sisyphusQa.drive(4,3).then(function(r){return JSON.stringify(r)})"), ("js", "JSON.stringify(window.__sisyphusQa.feel())"),
        ("js", "window.__sisyphusQa.drive(4,10).then(function(r){return JSON.stringify(r)})"), ("js", "JSON.stringify(window.__sisyphusQa.feel())")]
r = run(BASE + "hills", 1440, 900, steps, quiet=True, port=10620)
for x in r[-6:]: print(x)
