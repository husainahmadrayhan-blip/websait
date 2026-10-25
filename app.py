import os
import re
import unicodedata
import secrets
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import fitz  # PyMuPDF

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=BASE_DIR, static_folder=BASE_DIR, static_url_path='')
CORS(app)

# Secure session defaults. Set FLASK_SECRET_KEY in the host dashboard for production;
# if absent, generate a stable local key file so the app can start without ENV variables.
def _get_secret_key():
    configured = os.environ.get('FLASK_SECRET_KEY', '').strip()
    if configured:
        return configured
    key_path = os.path.join(BASE_DIR, '.flask_secret_key')
    try:
        with open(key_path, 'r', encoding='utf-8') as key_file:
            key = key_file.read().strip()
        if len(key) >= 32:
            return key
    except OSError:
        pass
    key = secrets.token_urlsafe(48)
    try:
        fd = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as key_file:
            key_file.write(key)
        return key
    except FileExistsError:
        try:
            with open(key_path, 'r', encoding='utf-8') as key_file:
                return key_file.read().strip()
        except OSError:
            return key

app.secret_key = _get_secret_key()
app.config.update(
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('COOKIE_SECURE', '1').lower() not in {'0', 'false'},
)

@app.route('/health')
def health():
    return {'status': 'ok'}, 200


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/home')
def home_page():
    return render_template('home.html')

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

@app.route('/parse-pdf', methods=['POST'])
def parse_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    try:
        file_bytes = file.read()
        doc = fitz.open(stream=file_bytes, filetype='pdf')
        full_text = ''.join(page.get_text('text') + '\n' for page in doc)
        doc.close()
        full_text = unicodedata.normalize('NFKC', full_text)
        lines = [line.strip() for line in full_text.split('\n') if line.strip()]
        extracted_holding = ''
        for i, line in enumerate(lines):
            if re.search(r'Home\s*/?\s*Holding|Holding|বাসা\s*/?\s*হোল্ডিং', line, re.IGNORECASE):
                parts = re.split(r'[:|]', line, maxsplit=1)
                if len(parts) > 1 and parts[1].strip() and parts[1].strip() not in ['No', 'No.', '']:
                    val = parts[1].strip()
                    if val.upper() not in ['NA', 'N/A', 'NONE', '-']:
                        extracted_holding = val
                        break
                for k in range(1, 4):
                    if i + k < len(lines):
                        next_val = lines[i + k].strip()
                        if next_val and next_val not in ['|', 'No', 'Postal Code', 'District', 'Village/Road'] and not re.search(r'Village|Road|Post|District|Upozila|Mouza|Moholla|gram|গ্রাম|ডাকঘর|জেলা', next_val, re.IGNORECASE):
                            if next_val.upper() not in ['NA', 'N/A', 'NONE', '-']:
                                extracted_holding = next_val
                                break
                if extracted_holding:
                    break
        nid_match = re.search(r'National\s*ID\s*[|:]?\s*(\d{10,17})', full_text, re.IGNORECASE)
        pin_match = re.search(r'Pin\s*[|:]?\s*(\d{13,18})', full_text, re.IGNORECASE)
        dob_match = re.search(r'Date\s*of\s*Birth\s*[|:]?\s*(\d{4}-\d{2}-\d{2})', full_text, re.IGNORECASE)
        return jsonify({'success': True, 'full_text': full_text, 'extracted_holding': extracted_holding,
                        'nid': nid_match.group(1) if nid_match else '',
                        'pin': pin_match.group(1) if pin_match else '',
                        'dob': dob_match.group(1) if dob_match else ''})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
