#!/usr/bin/env python3
"""
GK TikTok Desktop - GK Legend Studio's own TikTok connection (no Buffer needed).

Uses TikTok's official Login Kit + Content Posting API (video.upload):
videos are sent to your TikTok inbox as drafts; you finish and post them in the TikTok app.

Pure Python 3 standard library - nothing to install.

  python3 gk_tiktok.py setup            # one time: paste Client key + Client secret
  python3 gk_tiktok.py                  # opens the GK studio page at http://localhost:8765
  python3 gk_tiktok.py login            # connect your TikTok account
  python3 gk_tiktok.py me               # show which account is connected
  python3 gk_tiktok.py upload FILE.mp4  # send a video to TikTok drafts (for scripts/automation)
  python3 gk_tiktok.py status PUBLISH_ID

(c) 2026 GK Legend Studio. All rights reserved. https://www.youtube.com/@PathFoundGK
"""
import html, json, os, secrets, sys, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = 8765
REDIRECT_URI = "https://legal.lekkerglobally.com/tiktok/callback/"  # forwards to localhost
SCOPES = "user.info.basic,video.upload"
HOME = Path.home() / ".gk_tiktok"
CONFIG = HOME / "config.json"
TOKEN = HOME / "token.json"
OUTBOX = Path.home() / "GK_TikTok_Outbox"
API = "https://open.tiktokapis.com/v2"
MB = 1024 * 1024


# ---------- storage ----------
def _save(path, data):
    HOME.mkdir(mode=0o700, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    os.chmod(path, 0o600)


def _load(path):
    return json.loads(path.read_text()) if path.exists() else None


def config():
    c = _load(CONFIG)
    if not c:
        sys.exit("Not set up yet. Run:  python3 gk_tiktok.py setup")
    return c


# ---------- http ----------
def _req(method, url, data=None, headers=None, form=False):
    headers = dict(headers or {})
    body = None
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json; charset=UTF-8"
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        raw = e.read()
    try:
        return json.loads(raw or b"{}")
    except ValueError:
        return {"raw": raw.decode(errors="replace")}


def _check(resp, what):
    err = resp.get("error")
    if isinstance(err, dict) and err.get("code") not in (None, "ok"):
        raise RuntimeError(f"{what} failed: {err.get('code')} - {err.get('message')}")
    if isinstance(err, str) and err:
        raise RuntimeError(f"{what} failed: {err} - {resp.get('error_description')}")
    return resp


# ---------- oauth ----------
def auth_url(state):
    c = config()
    q = {"client_key": c["client_key"], "scope": SCOPES, "response_type": "code",
         "redirect_uri": REDIRECT_URI, "state": state}
    return "https://www.tiktok.com/v2/auth/authorize/?" + urllib.parse.urlencode(q)


def exchange_code(code):
    c = config()
    t = _check(_req("POST", f"{API}/oauth/token/", {
        "client_key": c["client_key"], "client_secret": c["client_secret"], "code": code,
        "grant_type": "authorization_code", "redirect_uri": REDIRECT_URI}, form=True), "Token exchange")
    t["obtained_at"] = int(time.time())
    _save(TOKEN, t)
    return t


def access_token():
    t = _load(TOKEN)
    if not t:
        raise RuntimeError("TikTok not connected yet. Run:  python3 gk_tiktok.py login")
    if time.time() > t["obtained_at"] + t.get("expires_in", 0) - 300:
        c = config()
        n = _check(_req("POST", f"{API}/oauth/token/", {
            "client_key": c["client_key"], "client_secret": c["client_secret"],
            "grant_type": "refresh_token", "refresh_token": t["refresh_token"]}, form=True), "Token refresh")
        n["obtained_at"] = int(time.time())
        _save(TOKEN, n)
        t = n
    return t["access_token"]


def me():
    r = _check(_req("GET", f"{API}/user/info/?fields=open_id,avatar_url,display_name",
                    headers={"Authorization": f"Bearer {access_token()}"}), "User info")
    return r.get("data", {}).get("user", {})


# ---------- content posting (inbox / drafts) ----------
def upload(path, log=print):
    path = Path(path).expanduser()
    size = path.stat().st_size
    if size <= 64 * MB:
        chunk, count = size, 1
    else:
        chunk = 10 * MB
        count = size // chunk  # last chunk absorbs the remainder (TikTok rule)
    tok = access_token()
    init = _check(_req("POST", f"{API}/post/publish/inbox/video/init/", {
        "source_info": {"source": "FILE_UPLOAD", "video_size": size,
                        "chunk_size": chunk, "total_chunk_count": count}},
        headers={"Authorization": f"Bearer {tok}"}), "Upload init")["data"]
    pid, url = init["publish_id"], init["upload_url"]
    log(f"Uploading {path.name} ({size / MB:.1f} MB) in {count} part(s)...")
    with open(path, "rb") as f:
        for i in range(count):
            start = i * chunk
            end = size - 1 if i == count - 1 else start + chunk - 1
            f.seek(start)
            part = f.read(end - start + 1)
            r = urllib.request.Request(url, data=part, method="PUT", headers={
                "Content-Type": "video/quicktime" if path.suffix.lower() == ".mov" else "video/mp4",
                "Content-Length": str(len(part)),
                "Content-Range": f"bytes {start}-{end}/{size}"})
            with urllib.request.urlopen(r, timeout=600) as resp:
                log(f"  part {i + 1}/{count}: HTTP {resp.status}")
    log(f"Sent. publish_id = {pid}")
    return pid


def status(pid):
    return _check(_req("POST", f"{API}/post/publish/status/fetch/", {"publish_id": pid},
                       headers={"Authorization": f"Bearer {access_token()}"}), "Status").get("data", {})


# ---------- local studio page ----------
STATE = {"value": None, "done": threading.Event(), "msg": ""}

PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>GK TikTok Desktop</title>
<style>body{{margin:0;background:#0B0B0C;color:#F5F5F7;font:16px/1.6 system-ui,sans-serif}}
header{{background:#1E2333;border-bottom:2px solid #C9A84C;padding:22px;text-align:center}}
h1{{margin:0;color:#C9A84C;letter-spacing:.12em;font-size:28px}}main{{max-width:760px;margin:0 auto;padding:30px 20px}}
.card{{background:#141416;border:1px solid #2a2a30;border-radius:10px;padding:20px;margin-bottom:20px}}
.btn{{display:inline-block;background:#C9A84C;color:#0B0B0C;border:0;border-radius:6px;padding:10px 18px;font-weight:700;text-decoration:none;cursor:pointer}}
.acct{{display:flex;align-items:center;gap:14px}}.acct img{{width:56px;height:56px;border-radius:50%;border:2px solid #C9A84C}}
li{{margin:8px 0}}.muted{{color:#a9a9b3;font-size:14px}}.msg{{background:#1E2333;border-left:4px solid #C9A84C;padding:10px 14px}}
footer{{text-align:center;color:#a9a9b3;font-size:13px;padding:20px}}a{{color:#C9A84C}}</style></head><body>
<header><h1>GK GLOBAL STUDIO</h1><div class="muted">GK Legend Studio &middot; TikTok publishing desk</div></header><main>
{msg}<div class="card"><h2>1. TikTok account</h2>{account}</div>
<div class="card"><h2>2. Send a video to TikTok drafts</h2>
<p class="muted">Videos in <b>{outbox}</b>. Each one is uploaded to your TikTok inbox as a draft; open TikTok to add the final touches and post.</p>{videos}</div>
</main><footer>&copy; 2026 GK Legend Studio. All rights reserved. &middot; <a href="https://www.youtube.com/@PathFoundGK">youtube.com/@PathFoundGK</a></footer></body></html>"""


def render(msg=""):
    try:
        u = me()
        account = (f'<div class="acct"><img src="{html.escape(u.get("avatar_url", ""))}" alt="">'
                   f'<div><b>{html.escape(u.get("display_name", ""))}</b><br><span class="muted">Connected with TikTok Login Kit</span>'
                   f'</div></div><p><a class="btn" href="/login">Reconnect</a></p>')
    except Exception as e:  # not connected yet
        account = (f'<p>No account connected.</p><p><a class="btn" href="/login">Connect TikTok</a></p>'
                   f'<p class="muted">{html.escape(str(e))}</p>')
    OUTBOX.mkdir(exist_ok=True)
    files = sorted(p for p in OUTBOX.iterdir() if p.suffix.lower() in (".mp4", ".mov"))
    if files:
        videos = "<ul>" + "".join(
            f'<li>{html.escape(p.name)} <span class="muted">({p.stat().st_size / MB:.1f} MB)</span> '
            f'<form method="post" action="/upload" style="display:inline"><input type="hidden" name="f" value="{html.escape(p.name)}">'
            f'<button class="btn">Send to TikTok</button></form></li>' for p in files) + "</ul>"
    else:
        videos = '<p class="muted">The outbox is empty. Drop an .mp4 or .mov in the folder and refresh.</p>'
    m = f'<div class="msg">{msg}</div>' if msg else ""
    return PAGE.format(msg=m, account=account, outbox=html.escape(str(OUTBOX)), videos=videos)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _html(self, body, code=200):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _redirect(self, to):
        self.send_response(302)
        self.send_header("Location", to)
        self.end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == "/login":
            STATE["value"] = "gkdesk_" + secrets.token_urlsafe(16)
            return self._redirect(auth_url(STATE["value"]))
        if u.path == "/callback":
            if q.get("state", [""])[0] != STATE["value"]:
                return self._html(render("Sign-in rejected: state did not match. Please try Connect TikTok again."))
            if "code" not in q:
                return self._html(render("TikTok sign-in cancelled: " + html.escape(q.get("error_description", q.get("error", ["unknown"]))[0])))
            try:
                exchange_code(q["code"][0])
                STATE["msg"] = "TikTok connected."
            except Exception as e:
                STATE["msg"] = html.escape(str(e))
            STATE["done"].set()
            return self._redirect("/?m=" + urllib.parse.quote(STATE["msg"]))
        if u.path == "/":
            return self._html(render(html.escape(q.get("m", [""])[0])))
        self._html("Not found", 404)

    def do_POST(self):
        if self.path != "/upload":
            return self._html("Not found", 404)
        n = int(self.headers.get("Content-Length", 0))
        name = urllib.parse.parse_qs(self.rfile.read(n).decode()).get("f", [""])[0]
        p = (OUTBOX / Path(name).name)
        try:
            lines = []
            pid = upload(p, log=lines.append)
            time.sleep(3)
            st = status(pid).get("status", "PROCESSING")
            msg = (f"<b>{html.escape(p.name)}</b> sent to your TikTok inbox (status: {html.escape(st)}). "
                   f"Open TikTok &rarr; notifications/inbox to finish and post it.<br><span class='muted'>publish_id {html.escape(pid)}</span>")
        except Exception as e:
            msg = "Upload failed: " + html.escape(str(e))
        self._html(render(msg))


def serve(open_page=True):
    srv = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"GK TikTok Desktop running at http://localhost:{PORT}  (Ctrl+C to stop)")
    if open_page:
        webbrowser.open(f"http://localhost:{PORT}/")
    return srv


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "ui"
    if cmd == "setup":
        # Clipboard setup (Mac): copy the value on developers.tiktok.com, come back
        # here and press Enter. Nothing is typed or pasted, and the secret is never
        # shown on screen. The clipboard is emptied at the end.
        import subprocess
        print("Find these in developers.tiktok.com -> your app -> Credentials (use the Sandbox ones while testing).")

        def from_clipboard(label):
            input(f"\nCopy the {label} (click the copy icon on the TikTok page), then come back here and press Enter... ")
            try:
                v = subprocess.run(["pbpaste"], capture_output=True, text=True, timeout=5).stdout.strip()
            except Exception as e:
                sys.exit(f"Could not read the clipboard: {e}")
            if not v or any(ch.isspace() for ch in v) or len(v) < 10:
                sys.exit(f"The clipboard does not look like a {label} (empty, has spaces or is too short). Copy it again and re-run setup.")
            print(f"  got the {label}: {len(v)} characters, starts with {v[:3]}...")
            return v

        key = from_clipboard("Client key")
        sec = from_clipboard("Client secret")
        if key == sec:
            sys.exit("The key and the secret are the same text. Copy the secret (not the key again) and re-run setup.")
        _save(CONFIG, {"client_key": key, "client_secret": sec})
        try:
            subprocess.run(["pbcopy"], input=b"", timeout=5)  # clear the secret from the clipboard
        except Exception:
            pass
        TOKEN.unlink(missing_ok=True)
        OUTBOX.mkdir(exist_ok=True)
        print(f"\nSaved to {CONFIG} (only on this Mac). Clipboard cleared. Next:  python3 gk_tiktok.py login")
    elif cmd == "ui":
        config()
        serve().serve_forever()
    elif cmd == "login":
        config()
        srv = serve(open_page=False)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        webbrowser.open(f"http://localhost:{PORT}/login")
        print("Approve the app in the browser window...")
        STATE["done"].wait(600)
        print(STATE["msg"] or "Timed out.")
        srv.shutdown()
    elif cmd == "me":
        print(json.dumps(me(), indent=2))
    elif cmd == "upload" and len(sys.argv) > 2:
        pid = upload(sys.argv[2])
        for _ in range(20):
            time.sleep(5)
            st = status(pid)
            print("status:", st.get("status"), st.get("fail_reason", ""))
            if st.get("status") in ("SEND_TO_USER_INBOX", "PUBLISH_COMPLETE", "FAILED"):
                break
    elif cmd == "status" and len(sys.argv) > 2:
        print(json.dumps(status(sys.argv[2]), indent=2))
    else:
        print(__doc__)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except RuntimeError as e:
        sys.exit(str(e))
