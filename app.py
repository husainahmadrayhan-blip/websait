import os
import re
import unicodedata

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# Preferred current PyMuPDF import; fallback supports older installations.
try:
    import pymupdf as fitz
except ImportError:
    import fitz

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- Environment-free configuration ---
# A stable secret is created once in this app folder if no FLASK_SECRET_KEY is set.
# For production, keep this file private and outside public downloads.
def _load_secret_key():
    key = os.environ.get("FLASK_SECRET_KEY", "").strip()
    if key:
        return key
    key_file = os.path.join(BASE_DIR, ".flask_secret_key")
    try:
        with open(key_file, "r", encoding="utf-8") as f:
            key = f.read().strip()
        if len(key) >= 32:
            return key
    except OSError:
        pass
    key = secrets.token_urlsafe(48)
    try:
        fd = os.open(key_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(key)
        return key
    except FileExistsError:
        try:
            with open(key_file, "r", encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            return key

app = Flask(
    __name__,
    template_folder=BASE_DIR,
    static_folder=BASE_DIR,
    static_url_path=""
)
CORS(app)
app.secret_key = _load_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "1").strip() not in {"0", "false", "False"},
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/home")
def home_page():
    return render_template("home.html")


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


@app.route("/parse-pdf", methods=["POST"])
def parse_pdf():
    if "pdf" not in request.files:
        return jsonify({"success": False, "error": "No file part named 'pdf'"}), 400

    uploaded_file = request.files["pdf"]
    if not uploaded_file.filename:
        return jsonify({"success": False, "error": "No selected file"}), 400

    try:
        file_bytes = uploaded_file.read()
        if not file_bytes:
            return jsonify({"success": False, "error": "Uploaded PDF is empty"}), 400

        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            full_text = "\n".join(page.get_text("text") for page in doc)

        full_text = unicodedata.normalize("NFKC", full_text)
        lines = [line.strip() for line in full_text.splitlines() if line.strip()]
        extracted_holding = ""

        for i, line in enumerate(lines):
            if not re.search(
                r"Home\s*/?\s*Holding|Holding|বাসা\s*/?\s*হোল্ডিং",
                line,
                re.IGNORECASE
            ):
                continue

            parts = re.split(r"[:|]", line, maxsplit=1)
            if len(parts) > 1:
                value = parts[1].strip()
                if value and value.upper() not in {"NO", "NO.", "NA", "N/A", "NONE", "-"}:
                    extracted_holding = value
                    break

            for k in range(1, 4):
                if i + k >= len(lines):
                    continue
                next_value = lines[i + k].strip()
                excluded = (
                    next_value in {"|", "No", "Postal Code", "District", "Village/Road"}
                    or re.search(
                        r"Village|Road|Post|District|Upozila|Mouza|Moholla|gram|গ্রাম|ডাকঘর|জেলা",
                        next_value,
                        re.IGNORECASE
                    )
                )
                if next_value and not excluded and next_value.upper() not in {
                    "NA", "N/A", "NONE", "-"
                }:
                    extracted_holding = next_value
                    break

            if extracted_holding:
                break

        nid_match = re.search(
            r"National\s*ID\s*[|:]?\s*(\d{10,17})", full_text, re.IGNORECASE
        )
        pin_match = re.search(
            r"Pin\s*[|:]?\s*(\d{13,18})", full_text, re.IGNORECASE
        )
        dob_match = re.search(
            r"Date\s*of\s*Birth\s*[|:]?\s*(\d{4}-\d{2}-\d{2})",
            full_text,
            re.IGNORECASE
        )

        return jsonify({
            "success": True,
            "full_text": full_text,
            "extracted_holding": extracted_holding,
            "nid": nid_match.group(1) if nid_match else "",
            "pin": pin_match.group(1) if pin_match else "",
            "dob": dob_match.group(1) if dob_match else ""
        })

    except Exception:
        app.logger.exception("PDF parsing failed")
        return jsonify({
            "success": False,
            "error": "PDF processing failed. Check the cPanel error log for details."
        }), 500


if __name__ == "__main__":
    # Local testing only. cPanel Passenger imports `application`.
    app.run(host="127.0.0.1", port=5000, debug=False)

# cPanel Passenger WSGI entry point
application = app
