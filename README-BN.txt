# Sheba no-ENV patch (cPanel Python 3.12)

## What this patch changes
- `app.py` no longer requires `FLASK_SECRET_KEY` in Environment Variables. It creates and reuses a private `.flask_secret_key` file automatically.
- `COOKIE_SECURE` is optional; HTTPS is assumed by default. If testing on plain HTTP only, set it to `0` in the shell/config or change the default in app.py.
- `passenger_wsgi.py` imports the Flask app correctly.
- Existing HTML/JS/PDF parsing code is included without redesign.

## Important limitations
- This does NOT repair a missing cPanel virtual environment by itself. If cPanel says `Unable to find app venv folder`, the hosting Python app/venv path must be repaired by the host or cPanel Python App setup.
- The existing balance/payment/request features in the supplied HTML/JS use browser `localStorage`; they are NOT moved to server-side storage by this patch.
- The supplied frontend's user/admin login functions and hardcoded admin login are not converted to secure server-side authentication in this patch. Do not treat this as a fully secured production login system.
- Back up your current files before replacing anything.

## Upload
Upload/extract these files into the actual application root only after confirming that root is `/home/shebaco1/public_html/websait`.
Keep the existing app data and any `.flask_secret_key` file once created. Do not upload the secret file publicly or share it.
Restart the Python app after upload. If cPanel cannot save/restart due to missing venv, contact hosting support and provide the exact error.
