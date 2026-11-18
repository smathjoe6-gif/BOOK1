#!/usr/bin/env python3
"""
GK TikTok Desktop - GK Legend Studio's own TikTok connection (no Buffer needed).

Uses TikTok's official Login Kit + Content Posting API:
  * Direct Post (video.publish): posts straight to your TikTok profile from the studio page
  * Upload to drafts (video.upload): sends to your TikTok inbox to finish in the app
Until TikTok approves (audits) the app, Direct Post only allows "Only me" (SELF_ONLY) privacy.

Pure Python 3 standard library - nothing to install.

  python3 gk_tiktok.py setup            # one time: copy Client key, press Enter, copy Client secret, press Enter
  python3 gk_tiktok.py                  # opens the GK studio page at http://localhost:8765
  python3 gk_tiktok.py login            # connect your TikTok account
  python3 gk_tiktok.py me               # show which account is connected
  python3 gk_tiktok.py upload FILE.mp4  # send a video to TikTok drafts (for scripts/automation)
  python3 gk_tiktok.py post FILE.mp4 --caption "..." --privacy PUBLIC_TO_EVERYONE
                                        # Direct Post (privacy must be one your account allows)
  python3 gk_tiktok.py creator          # show posting options TikTok allows for your account
  python3 gk_tiktok.py status PUBLISH_ID

(c) 2026 GK Legend Studio. All rights reserved. https://www.youtube.com/@PathFoundGK
"""
import html, json, os, secrets, sys, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer as HTTPServer
from pathlib import Path

PORT = 8765
REDIRECT_URI = "https://legal.lekkerglobally.com/tiktok/callback/"  # forwards to localhost
SCOPES = "user.info.basic,video.upload,video.publish"
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


FRIENDLY = {
    "unaudited_client_can_only_post_to_private_accounts":
        "TikTok has not approved (audited) this app yet, so it can only post to a PRIVATE account. "
        "In the TikTok app: Profile > menu > Settings and privacy > Privacy > turn on Private account, then try again.",
    "spam_risk_too_many_posts": "TikTok's daily posting limit for this account was reached. Try again tomorrow.",
    "spam_risk_user_banned_from_posting": "TikTok has temporarily blocked posting from this account.",
    "privacy_level_option_mismatch": "That privacy option is not allowed for this account right now. Choose another.",
    "scope_not_authorized": "This permission was not granted. Click Reconnect and approve all permissions.",
    "access_token_invalid": "The TikTok connection expired. Click Reconnect.",
}


def _check(resp, what):
    err = resp.get("error")
    if isinstance(err, dict) and err.get("code") not in (None, "ok"):
        code = err.get("code")
        if code in FRIENDLY:
            raise RuntimeError(f"{what}: {FRIENDLY[code]}")
        raise RuntimeError(f"{what} failed: {code} - {err.get('message')}")
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


# ---------- content posting ----------
def _source(path):
    size = path.stat().st_size
    if size <= 64 * MB:
        chunk, count = size, 1
    else:
        chunk = 10 * MB
        count = size // chunk  # last chunk absorbs the remainder (TikTok rule)
    return {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": chunk, "total_chunk_count": count}


def creator_info():
    """Required before every Direct Post: which privacy options / toggles TikTok allows right now."""
    return _check(_req("POST", f"{API}/post/publish/creator_info/query/", {},
                       headers={"Authorization": f"Bearer {access_token()}"}), "Creator info").get("data", {})


def direct_post(path, caption, privacy, allow_comment=False, allow_duet=False, allow_stitch=False,
                your_brand=False, branded_content=False, log=print):
    """Direct Post (video.publish). privacy must be one of creator_info()['privacy_level_options']."""
    path = Path(path).expanduser()
    info = creator_info()
    opts = info.get("privacy_level_options", [])
    if privacy not in opts:
        raise RuntimeError(f"Privacy '{privacy}' not allowed for this account now. Allowed: {', '.join(opts)}")
    if branded_content and privacy == "SELF_ONLY":
        raise RuntimeError("Branded content cannot be posted as 'Only me'.")
    post_info = {"title": caption, "privacy_level": privacy,
                 "disable_comment": (not allow_comment) or bool(info.get("comment_disabled")),
                 "disable_duet": (not allow_duet) or bool(info.get("duet_disabled")),
                 "disable_stitch": (not allow_stitch) or bool(info.get("stitch_disabled")),
                 "brand_organic_toggle": bool(your_brand), "brand_content_toggle": bool(branded_content)}
    src = _source(path)
    init = _check(_req("POST", f"{API}/post/publish/video/init/", {"post_info": post_info, "source_info": src},
                       headers={"Authorization": f"Bearer {access_token()}"}), "Direct Post init")["data"]
    return _send_chunks(path, src, init["publish_id"], init["upload_url"], log)


def upload(path, log=print):
    """Upload to TikTok inbox as a draft (video.upload)."""
    path = Path(path).expanduser()
    src = _source(path)
    init = _check(_req("POST", f"{API}/post/publish/inbox/video/init/", {"source_info": src},
                       headers={"Authorization": f"Bearer {access_token()}"}), "Upload init")["data"]
    return _send_chunks(path, src, init["publish_id"], init["upload_url"], log)


def _send_chunks(path, src, pid, url, log):
    size, chunk, count = src["video_size"], src["chunk_size"], src["total_chunk_count"]
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
.btn2{{background:transparent;color:#C9A84C;border:1px solid #C9A84C}}label{{display:block;margin:10px 0 4px;font-weight:600}}
select,textarea{{width:100%;background:#0B0B0C;color:#F5F5F7;border:1px solid #3a3a44;border-radius:6px;padding:9px;font:inherit}}
.row{{display:flex;gap:18px;flex-wrap:wrap}}.row label{{font-weight:400}}video{{max-width:100%;max-height:420px;border-radius:8px;background:#000}}
.sub{{margin-left:24px}}
footer{{text-align:center;color:#a9a9b3;font-size:13px;padding:20px}}a{{color:#C9A84C}}</style></head><body>
<header><h1>GK GLOBAL STUDIO</h1><div class="muted">GK Legend Studio &middot; TikTok publishing desk</div></header><main>
{msg}<div class="card"><h2>1. TikTok account</h2>{account}</div>
<div class="card"><h2>2. Videos in your outbox</h2>
<p class="muted">Folder: <b>{outbox}</b>. Choose <b>Post to TikTok</b> to publish directly, or <b>Send to drafts</b> to finish it inside the TikTok app.</p>{videos}</div>
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
            f'<a class="btn" href="/compose?f={urllib.parse.quote(p.name)}">Post to TikTok</a> '
            f'<form method="post" action="/upload" style="display:inline"><input type="hidden" name="f" value="{html.escape(p.name)}">'
            f'<button class="btn btn2">Send to drafts</button></form></li>' for p in files) + "</ul>"
    else:
        videos = '<p class="muted">The outbox is empty. Drop an .mp4 or .mov in the folder and refresh.</p>'
    m = f'<div class="msg">{msg}</div>' if msg else ""
    return PAGE.format(msg=m, account=account, outbox=html.escape(str(OUTBOX)), videos=videos)



PRIVACY_LABELS = {"PUBLIC_TO_EVERYONE": "Everyone", "MUTUAL_FOLLOW_FRIENDS": "Friends",
                  "FOLLOWER_OF_CREATOR": "Followers", "SELF_ONLY": "Only me"}


def render_compose(name, msg=""):
    p = OUTBOX / Path(name).name
    try:
        info = creator_info()
    except Exception as e:
        return render("Cannot post right now: " + html.escape(str(e)))
    if not p.exists():
        return render("Video not found in the outbox.")
    opts = "".join(f'<option value="{o}">{PRIVACY_LABELS.get(o, o)}</option>' for o in info.get("privacy_level_options", []))
    def tog(key, label, disabled_flag):
        if info.get(disabled_flag):
            return f'<label><input type="checkbox" disabled> {label} <span class="muted">(turned off in your TikTok settings)</span></label>'
        return f'<label><input type="checkbox" name="{key}"> {label}</label>'
    maxd = info.get("max_video_post_duration_sec")
    body = f"""{('<div class="msg">' + msg + '</div>') if msg else ''}
<div class="card"><h2>Post to TikTok</h2>
<p>Posting as <b>{html.escape(info.get('creator_nickname', ''))}</b> <span class="muted">@{html.escape(info.get('creator_username', ''))}</span></p>
<video src="/media?f={urllib.parse.quote(p.name)}" controls playsinline></video>
<p class="muted">{html.escape(p.name)}{f' &middot; TikTok allows up to {maxd}s for this account' if maxd else ''}</p>
<form method="post" action="/post" id="pf">
<input type="hidden" name="f" value="{html.escape(p.name)}">
<label for="cap">Caption</label><textarea id="cap" name="caption" rows="3" maxlength="2200" required placeholder="Write your caption"></textarea>
<label for="priv">Who can view this video</label>
<select id="priv" name="privacy" required><option value="" selected disabled>Select privacy</option>{opts}</select>
<label>Allow users to</label><div class="row">
{tog('comment', 'Comment', 'comment_disabled')}{tog('duet', 'Duet', 'duet_disabled')}{tog('stitch', 'Stitch', 'stitch_disabled')}</div>
<label><input type="checkbox" id="cc" name="cc"> Disclose video content (commercial content)</label>
<div id="ccopts" class="sub" style="display:none">
<p class="muted">Turn this on if the video promotes yourself, a third party, or both.</p>
<label><input type="checkbox" id="yb" name="your_brand"> Your brand &mdash; you are promoting yourself or your own business. Labelled "Promotional content".</label>
<label><input type="checkbox" id="bc" name="branded"> Branded content &mdash; you are promoting another brand or a third party. Labelled "Paid partnership".</label>
<p id="ccwarn" class="muted" style="display:none">You need to select at least one option.</p></div>
<p class="muted" id="consent">By posting, you agree to TikTok's <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank">Music Usage Confirmation</a>.</p>
<button class="btn" id="go">Post to TikTok</button> <a class="btn btn2" href="/">Cancel</a>
<p class="muted">After you post, TikTok may take a few minutes to process the video before it appears on your profile.</p>
</form></div>
<script>
var cc=document.getElementById('cc'),yb=document.getElementById('yb'),bc=document.getElementById('bc'),pr=document.getElementById('priv'),
go=document.getElementById('go'),consent=document.getElementById('consent'),warn=document.getElementById('ccwarn');
function upd(){{document.getElementById('ccopts').style.display=cc.checked?'block':'none';
 var so=pr.querySelector('option[value=SELF_ONLY]');
 if(bc.checked){{if(so){{so.disabled=true;if(pr.value==='SELF_ONLY')pr.value='';}}}}else if(so){{so.disabled=false;}}
 var need=cc.checked&&!yb.checked&&!bc.checked;warn.style.display=need?'block':'none';go.disabled=need;
 var tos='<a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank">Music Usage Confirmation</a>';
 consent.innerHTML=(cc.checked&&bc.checked)?"By posting, you agree to TikTok's <a href='https://www.tiktok.com/legal/page/global/bc-policy/en' target='_blank'>Branded Content Policy</a> and "+tos+".":"By posting, you agree to TikTok's "+tos+".";
 go.title=(bc.checked)?'Branded content visibility cannot be set to private.':'';}}
[cc,yb,bc,pr].forEach(function(e){{e.addEventListener('change',upd);}});upd();
document.getElementById('pf').addEventListener('submit',function(){{go.disabled=true;go.textContent='Posting…';}});
</script>"""
    return _wrap(body)


def _wrap(body):
    head, rest = PAGE.split("{msg}", 1)
    tail = rest.split("</main>", 1)[1]
    return head.replace("{{", "{").replace("}}", "}") + body + "</main>" + tail.replace("{{", "{").replace("}}", "}")


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
        if u.path == "/compose":
            return self._html(render_compose(q.get("f", [""])[0]))
        if u.path == "/media":
            p = OUTBOX / Path(q.get("f", [""])[0]).name
            if not p.exists():
                return self._html("Not found", 404)
            data = p.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "video/quicktime" if p.suffix.lower() == ".mov" else "video/mp4")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        if u.path == "/":
            return self._html(render(html.escape(q.get("m", [""])[0])))
        self._html("Not found", 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        form = urllib.parse.parse_qs(self.rfile.read(n).decode())
        g = lambda k: form.get(k, [""])[0]
        if self.path == "/post":
            p = OUTBOX / Path(g("f")).name
            try:
                lines = []
                pid = direct_post(p, g("caption"), g("privacy"), allow_comment=bool(g("comment")),
                                  allow_duet=bool(g("duet")), allow_stitch=bool(g("stitch")),
                                  your_brand=bool(g("cc") and g("your_brand")),
                                  branded_content=bool(g("cc") and g("branded")), log=lines.append)
                st = "PROCESSING"
                for _ in range(6):
                    time.sleep(3)
                    st = status(pid).get("status", st)
                    if st in ("PUBLISH_COMPLETE", "FAILED"):
                        break
                msg = (f"<b>{html.escape(p.name)}</b> posted to TikTok (status: {html.escape(st)}). "
                       f"It may take a few minutes to appear on your profile.<br><span class='muted'>publish_id {html.escape(pid)}</span>")
                return self._html(render(msg))
            except Exception as e:
                return self._html(render_compose(p.name, "Post failed: " + html.escape(str(e))))
        if self.path != "/upload":
            return self._html("Not found", 404)
        name = g("f")
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
    elif cmd == "creator":
        print(json.dumps(creator_info(), indent=2))
    elif cmd == "post" and len(sys.argv) > 2:
        import argparse
        ap = argparse.ArgumentParser(prog="gk_tiktok.py post")
        ap.add_argument("file"); ap.add_argument("--caption", required=True)
        ap.add_argument("--privacy", required=True, help="e.g. SELF_ONLY, PUBLIC_TO_EVERYONE (run 'creator' to see allowed)")
        ap.add_argument("--allow-comment", action="store_true"); ap.add_argument("--allow-duet", action="store_true")
        ap.add_argument("--allow-stitch", action="store_true"); ap.add_argument("--your-brand", action="store_true")
        ap.add_argument("--branded-content", action="store_true")
        a = ap.parse_args(sys.argv[2:])
        pid = direct_post(a.file, a.caption, a.privacy, a.allow_comment, a.allow_duet, a.allow_stitch,
                          a.your_brand, a.branded_content)
        for _ in range(30):
            time.sleep(5)
            st = status(pid)
            print("status:", st.get("status"), st.get("fail_reason", ""))
            if st.get("status") in ("PUBLISH_COMPLETE", "FAILED"):
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
