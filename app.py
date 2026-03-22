import os
import json
import requests
from flask import Flask, render_template, request, Response, jsonify

app = Flask(__name__, static_folder='static', template_folder='templates')

EIGEN_URL = os.environ.get('EIGEN_URL', 'https://api-web.eigenai.com/api/v1/generate')
EIGEN_KEY = os.environ.get('EIGEN_API_KEY')
if not EIGEN_KEY:
    raise RuntimeError("Set the EIGEN_API_KEY environment variable before running the app.")

# Server-side mapping: gender -> race -> voice_name -> voice_id
# Replace the placeholder IDs with the real voice_id strings you have.
VOICE_MAP = {
    "female": {
        "indian": {
            "Indian_female_1": "d3d661b8d5e640f69b0c05d12112e41d"
        },
        "african": {
            "African_female_1": "AFRICAN_SMOOTH_ID",
            "African_female_2": "AFRICAN_BRIGHT_ID"
        },
        "hispanic": {
            "Hispanic_rich": "HISPANIC_RICH_ID",
            "Hispanic_soft": "HISPANIC_SOFT_ID"
        },
        "other": {
            "Neutral_female_1": "NEUTRAL_FEMALE_1_ID"
        }
    },
    "male": {
        "indian": {
            "Indian_male_1": "d834344669cf40bfaeac8a21942e6ac8",
            "Indian_male_2": "8b91f852c1894c9aad1bb5ac55d2d128"
        },
        "african": {
            "African_male_1": "95d73fb20eb745f5adec3e02719b9117",
            "African_male_2": "46c9ad8090fa4a8bba95568859b48650"
        },
        "hispanic": {
            "Hispanic_deep": "HISPANIC_DEEP_ID"
        },
        "other": {
            "Neutral_male_1": "NEUTRAL_MALE_1_ID"
        }
    }
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/voices', methods=['POST'])
def voices():
    """
    Client posts JSON: { gender: "male"|"female", race: "indian"|"african"|"hispanic"|"other" }
    Server returns the list of voice names available for that selection.
    """
    data = request.get_json() or {}
    gender = data.get('gender')
    race = data.get('race')
    if not gender or not race:
        return jsonify({"error": "gender and race required"}), 400
    gender_map = VOICE_MAP.get(gender.lower())
    if not gender_map:
        return jsonify({"error": "invalid gender"}), 400
    race_map = gender_map.get(race.lower())
    if not race_map:
        return jsonify({"error": "no voices for that race"}), 404
    # Return list of voice names
    return jsonify({"voices": list(race_map.keys())})

@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Expects JSON: { text: "...", voice_name: "...", stream: false, sampling: {...} }
    Server maps voice_name -> voice_id using VOICE_MAP and calls Eigen API with voice_id.
    """
    payload = request.get_json() or {}
    text = payload.get('text', '').strip()
    voice_name = payload.get('voice_name', '')
    stream_flag = payload.get('stream', False)
    sampling = payload.get('sampling', {"temperature": 0.85, "top_p": 0.95, "top_k": 50})

    if not text:
        return jsonify({"error": "No text provided"}), 400
    if not voice_name:
        return jsonify({"error": "No voice selected"}), 400

    # Find voice_id in VOICE_MAP
    voice_id = None
    for gender_map in VOICE_MAP.values():
        for race_map in gender_map.values():
            if voice_name in race_map:
                voice_id = race_map[voice_name]
                break
        if voice_id:
            break

    if not voice_id:
        return jsonify({"error": "Unknown voice name"}), 400

    headers = {"Authorization": f"Bearer {EIGEN_KEY}"}
    files = {
        "model": (None, "higgs2p5"),
        "text": (None, text),
        # Use voice_id field per your REST example
        "voice_id": (None, voice_id),
        "stream": (None, "true" if stream_flag else "false"),
        "sampling": (None, json.dumps(sampling)),
    }

    try:
        resp = requests.post(EIGEN_URL, headers=headers, files=files, stream=True, timeout=120)
    except requests.RequestException as e:
        return jsonify({"error": f"Request to Eigen failed: {str(e)}"}), 502

    if resp.status_code >= 400:
        try:
            err_text = resp.text
        except Exception:
            err_text = f"Status {resp.status_code}"
        return jsonify({"error": "Eigen API error", "details": err_text}), resp.status_code

    def generate():
        try:
            for chunk in resp.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk
        finally:
            resp.close()

    return Response(generate(), content_type='audio/wav')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)