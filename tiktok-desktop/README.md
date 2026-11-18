# GK TikTok Desktop — GK Legend Studio's own TikTok API

Your own connection to TikTok's official API, running on your Mac. No Buffer needed.
Videos go to your TikTok inbox as drafts. You open TikTok, add the final touches and post.

## 1. Install (one time)
1. Download `gk_tiktok.py` and put it in your home folder (`/Users/<you>/`).
2. Open **Terminal** and run:
   ```
   python3 ~/gk_tiktok.py setup
   ```
3. Setup asks for the **Sandbox** Client key, then the Client secret. On developers.tiktok.com → GK Global Studio → **Sandbox** → Credentials, click the copy icon for the key, come back to Terminal and press Enter; then do the same for the secret. Nothing is pasted or typed, the secret is never shown, it is saved only on your Mac in `~/.gk_tiktok/`, and the clipboard is emptied afterwards.

## 2. Connect your TikTok account
```
python3 ~/gk_tiktok.py
```
The GK studio page opens at http://localhost:8765. Click **Connect TikTok** and approve with @kamaldii1. That account is already a Sandbox test user. You are sent back to the page, which now shows your TikTok name and avatar.

## 3. Send a video
Drop an `.mp4` or `.mov` file into the **GK_TikTok_Outbox** folder in your home folder. Refresh the page and click **Send to TikTok**. Then open the TikTok app, find the draft in your notifications or inbox, and post it.

For your automation script, use this instead of Buffer:
```
python3 ~/gk_tiktok.py upload "/path/to/video.mp4"
```

## 4. Record the demo video for TikTok review
Record your screen with **Cmd+Shift+5** → Record Entire Screen, then:
1. Show the GK studio page at localhost:8765 and click **Connect TikTok**.
2. Show the TikTok login and permission screen, then approve. Your account name and avatar now appear on the page (this demonstrates user.info.basic).
3. Click **Send to TikTok** on a video. The success message appears (this demonstrates video.upload).
4. Open TikTok on your phone or on the web, show the draft in the inbox, and post it.

Save it as an MP4 or MOV under 50 MB.

## 5. Submit (Production)
1. developers.tiktok.com → GK Global Studio → **Production** → **Import** → import from **GK Sandbox Test**.
2. Remove the `video.publish` scope if it was imported. The tool only needs `user.info.basic` and `video.upload`, and extra scopes slow down review.
3. Under App review, upload your demo video and paste the explanation below.
4. Click **Save**, then **Submit for review**.
5. Once TikTok approves the app, run `python3 ~/gk_tiktok.py setup` again with the **Production** keys, then run `login` again.

### Review explanation (paste this)
GK Global Studio is the in-house desktop publishing tool of GK Legend Studio, a Somali-heritage music and film studio (lekkerglobally.com). It publishes the studio's own finished videos to its TikTok account.

Login Kit (user.info.basic): in the GK Global Studio desktop page, the creator clicks "Connect TikTok" and authorises the app on TikTok's official login screen. The redirect URI https://legal.lekkerglobally.com/tiktok/callback/ returns the sign-in to the desktop tool. We read only the open ID, display name and avatar, to show which account is connected.

Content Posting API (video.upload): the creator picks a finished studio video and clicks "Send to TikTok". The file is uploaded with FILE_UPLOAD to the creator's TikTok inbox as a draft. The creator then reviews, edits and posts it inside TikTok.

Nothing is posted without the creator's action. Data is never sold, and users can disconnect at any time. Our Terms and Privacy Policy are linked above.

---
© 2026 GK Legend Studio. All rights reserved. Our heritage is our legacy; our innovation is our future. https://www.youtube.com/@PathFoundGK


## Direct posting (no drafts)
```
python3 ~/gk_tiktok.py post "/path/to/video.mp4" "Caption text"
```
This posts straight to the profile with the `video.publish` scope. In the TikTok developer portal, open the app, add **Direct Post** under Content Posting API, add the `video.publish` scope, then run `python3 ~/gk_tiktok.py login` again so the new permission is granted. TikTok only lets an app post PUBLICLY after it has passed TikTok's audit; until then every direct post is PRIVATE (only you see it). The tool picks the most public option TikTok allows for the app, so nothing needs to change in the code once the app is approved.
