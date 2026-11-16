"""12th Coach — demo server.

Run:  python server.py     (Python 3.9+, no packages to install)

Serves the four views, a small live-vote backend (Server-Sent Events) and the
server-side Gemini calls. All state is in memory and resets on restart.
"""
import json
import mimetypes
import os
import re
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")


def load_env(path):
    """Minimal .env reader: KEY=value lines, existing environment wins."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env(os.path.join(ROOT, ".env"))

import content as C          # noqa: E402  (after .env so settings are visible)
import gemini                # noqa: E402
from engine import Engine    # noqa: E402

OPERATOR_KEY = os.environ.get("OPERATOR_KEY", "").strip()
PAGES = {"/": "index.html", "/fan": "fan.html", "/club": "club.html", "/operator": "operator.html"}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,40}$")


class Hub:
    """Holds the latest public state; SSE handlers wait here for a new version."""

    def __init__(self):
        self.cond = threading.Condition()
        self.version = 0
        self.payload = "{}"

    def publish(self, payload):
        with self.cond:
            self.payload = payload
            self.version += 1
            self.cond.notify_all()

    def wait(self, last_version, timeout):
        with self.cond:
            if self.version == last_version:
                self.cond.wait(timeout)
            return self.version, self.payload


HUB = Hub()


def publish():
    HUB.publish(json.dumps(ENGINE.public_state(), ensure_ascii=False))


ENGINE = Engine(on_change=publish)


def ticker():
    step = 0.5
    while True:
        time.sleep(step)
        try:
            if ENGINE.tick(step) or ENGINE.dirty:
                publish()
        except Exception as err:  # keep the demo alive whatever happens
            print("tick error:", err, file=sys.stderr)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "12thCoach"
    timeout = 30   # frees threads held by idle keep-alive connections

    def log_message(self, fmt, *args):
        pass

    # ---- helpers ----

    def _send(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, status=200):
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _body(self):
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 16384)
            data = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            return data if isinstance(data, dict) else {}
        except (ValueError, UnicodeDecodeError):
            return {}

    def _operator_ok(self, query):
        if not OPERATOR_KEY:
            return True
        return (self.headers.get("X-Operator-Key") or query.get("key", [""])[0]) == OPERATOR_KEY

    @staticmethod
    def _fan(source):
        device = str(source.get("fanId", ""))
        persona = str(source.get("persona", ""))
        if not ID_RE.match(device):
            return None, None
        return device, persona if persona in C.PERSONAS else "season"

    # ---- routes ----

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        path = url.path.rstrip("/") or "/"
        if path == "/api/stream":
            return self._stream(query)
        if path == "/api/state":
            return self._json(ENGINE.public_state())
        if path == "/api/pool":
            return self._json(ENGINE.pool())
        if path == "/api/pilot-info":
            return self._pilot_info()
        if path in ("/api/operator/info", "/api/pilot"):
            if not self._operator_ok(query):
                return self._json({"ok": False, "error": "Operator key required."}, 403)
            if path == "/api/pilot":
                return self._json(ENGINE.pilot_metrics())
            info = ENGINE.operator_info()
            info["lanUrl"] = "http://%s:%d" % (lan_ip(), self.server.server_address[1])
            return self._json(info)
        if path.startswith("/api/"):
            return self._json({"ok": False, "error": "Not found."}, 404)
        return self._static(path)

    def do_POST(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        path = url.path.rstrip("/")
        data = self._body()
        if path.startswith("/api/operator/"):
            if not self._operator_ok(query):
                return self._json({"ok": False, "error": "Operator key required."}, 403)
            action = path.rsplit("/", 1)[1]
            if action == "start":
                return self._json(ENGINE.start())
            if action == "fire":
                return self._json(ENGINE.fire_next())
            if action == "close":
                return self._json(ENGINE.close_open())
            if action == "resolve":
                return self._json(ENGINE.resolve(str(data.get("momentId", "")), str(data.get("option", ""))))
            if action == "config":
                return self._json(ENGINE.set_config(data))
            if action == "reset":
                ENGINE.reset()
                return self._json({"ok": True})
            return self._json({"ok": False, "error": "Unknown action."}, 404)
        if path in ("/api/vote", "/api/rate"):
            device, persona = self._fan(data)
            if not device:
                return self._json({"ok": False, "error": "Missing fan id."}, 400)
            if path == "/api/vote":
                result = ENGINE.vote(device, persona, str(data.get("momentId", "")),
                                     str(data.get("option", "")), data.get("reason", ""))
            else:
                result = ENGINE.rate(device, persona, str(data.get("momentId", "")), bool(data.get("fair")))
            result["me"] = ENGINE.me(device, persona)
            result["state"] = ENGINE.public_state()
            return self._json(result)
        if path == "/api/ask":
            return self._json(ENGINE.ask(data.get("question", "")))
        return self._json({"ok": False, "error": "Not found."}, 404)

    def _pilot_info(self):
        try:
            with open(os.path.join(ROOT, "pilot.json"), encoding="utf-8") as fh:
                return self._json(json.load(fh))
        except (OSError, ValueError):
            return self._json({})

    def _static(self, path):
        name = PAGES.get(path, path.lstrip("/"))
        full = os.path.normpath(os.path.join(PUBLIC, name))
        if not full.startswith(PUBLIC + os.sep) or not os.path.isfile(full):
            return self._send(404, b"Not found", "text/plain; charset=utf-8")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith(("javascript", "json")):
            ctype += "; charset=utf-8"
        with open(full, "rb") as fh:
            self._send(200, fh.read(), ctype)

    def _stream(self, query):
        flat = {k: v[0] for k, v in query.items()}
        device, persona = self._fan(flat)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        last = -1
        try:
            while True:
                version, payload = HUB.wait(last, 15)
                if version == last:
                    self.wfile.write(b": ping\n\n")
                else:
                    last = version
                    me = json.dumps(ENGINE.me(device, persona), ensure_ascii=False) if device else "null"
                    self.wfile.write(('data: {"state":%s,"me":%s}\n\n' % (payload, me)).encode("utf-8"))
                self.wfile.flush()
        except OSError:
            pass  # client went away


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 256


def main():
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("image/svg+xml", ".svg")
    port = int(os.environ.get("PORT", "8000"))
    publish()
    threading.Thread(target=ticker, daemon=True).start()
    server = Server(("0.0.0.0", port), Handler)
    gemini.refresh_status()
    sys.stdout.reconfigure(line_buffering=True)
    print("12th Coach is running")
    print("  This computer : http://localhost:%d" % port)
    print("  Phones (Wi-Fi): http://%s:%d/fan" % (lan_ip(), port))
    print("  Gemini        : %s" % (("on, model " + gemini.model_name()) if gemini.api_key()
                                    else "no GEMINI_API_KEY set -> fallback summaries"))
    if OPERATOR_KEY:
        print("  Operator panel: http://localhost:%d/operator?key=<OPERATOR_KEY>" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
