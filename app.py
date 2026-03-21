import os
import json
import requests
from flask import Flask, render_template, request, Response, jsonify

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configure the Eigen endpoint and API key via environment
EIGEN_URL = os.environ.get('EIGEN_URL', 'https://api-web.eigenai.com/api/v1/generate')
EIGEN_KEY = os.environ.get('EIGEN_API_KEY')  # must be set

if not EIGEN_KEY:
    raise RuntimeError("Set the EIGEN_API_KEY environment variable before running the app.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Expects JSON: { text: "...", voice: "Linda", stream: false }
    Uses multipart/form-data (files=) to match the working client you provided.
    Streams the audio bytes back to the browser with content-type audio/wav.
    """
    payload = request.get_json() or {}
    text = payload.get('text', '').strip()
    voice = payload.get('voice', '')
    stream_flag = payload.get('stream', False)
    sampling = payload.get('sampling', {"temperature": 0.85, "top_p": 0.95, "top_k": 50})

    if not text:
        return jsonify({"error": "No text provided"}), 400
    if not voice:
        return jsonify({"error": "No voice selected"}), 400

    headers = {
        "Authorization": f"Bearer {EIGEN_KEY}"
    }

    # Build multipart/form-data payload using files= to force form encoding
    files = {
        "model": (None, "higgs2p5"),
        "text": (None, text),
        "voice": (None, voice),
        "stream": (None, "true" if stream_flag else "false"),
        "sampling": (None, json.dumps(sampling)),
    }

    try:
        # Stream=True so we can forward bytes as they arrive
        resp = requests.post(EIGEN_URL, headers=headers, files=files, stream=True, timeout=120)
    except requests.RequestException as e:
        return jsonify({"error": f"Request to Eigen failed: {str(e)}"}), 502

    # If the remote returned an error, capture and forward the message
    if resp.status_code >= 400:
        # Try to read text body for diagnostics
        try:
            err_text = resp.text
        except Exception:
            err_text = f"Status {resp.status_code}"
        return jsonify({"error": "Eigen API error", "details": err_text}), resp.status_code

    # Forward the audio stream to the browser
    def generate():
        try:
            for chunk in resp.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk
        finally:
            resp.close()

    # The Eigen endpoint returns WAV bytes in your tests; set audio/wav
    return Response(generate(), content_type='audio/wav')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)