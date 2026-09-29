import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import run
HOST = os.environ.get("V8HOST", "http://127.0.0.1:8811/v8/")
BASE = HOST + "?qa=1&qaRealmArt=1&qaRealm="
ERRS = "1"   # error capture is injected at document start by cdp.run
WAIT_ASSETS = "new Promise(function(r){var t0=Date.now();(function poll(){var d=window.__sisyphusDebug&&window.__sisyphusDebug();if((d&&d.assetsReady)||Date.now()-t0>25000)r(d?String(d.assetsReady):'nodebug');else setTimeout(poll,100)})()})"
START = [("js", ERRS), ("js", WAIT_ASSETS), ("js", "document.getElementById('enterstart').click();1"), ("wait", 1.5),
         ("js", "(()=>{var b=[...document.querySelectorAll('button')].find(b=>/^start /.test(b.textContent.trim())&&b.offsetParent);if(b){b.click();return b.textContent}return 'nobtn'})()"),
         ("wait", 2.5)]
DEVICES = {"desk": (1440, 900), "port": (430, 932), "land": (932, 430)}
FEEL = "JSON.stringify(Object.assign({errs:__errs},window.__sisyphusQa.feel()))"
