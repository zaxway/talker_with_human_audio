const WORDS = ["I", "we", "they", "them", "He", "She", "What","How", "Could", "Why", "that", "are","is","am","doing","you","today","please","thank","yes","no", "to", "blank", "help", "stop", "wait a minute", "!", ".", "?"];
// Keep UNDO_LIMIT and other helpers from previous version
const UNDO_LIMIT = 20;

document.addEventListener('DOMContentLoaded', () => {
  const onboardModal = document.getElementById('onboardModal');
  const onContinue = document.getElementById('on_continue');
  const appRoot = document.getElementById('appRoot');
  const selectedGenderEl = document.getElementById('selectedGender');
  const selectedRaceEl = document.getElementById('selectedRace');
  const voiceSelect = document.getElementById('voiceSelect');

  // Phrase builder elements
  const wordGrid = document.getElementById('wordGrid');
  const sentenceEl = document.getElementById('sentence');
  const clearBtn = document.getElementById('clearBtn');
  const backspaceBtn = document.getElementById('backspaceBtn');
  const undoBtn = document.getElementById('undoBtn');
  const playBtn = document.getElementById('playBtn');
  const status = document.getElementById('status');

  const undoStack = [];
  function pushUndo() {
    const cur = sentenceEl.dataset.text || '';
    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== cur) {
      undoStack.push(cur);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }
  }

  function setSentence(text) {
    sentenceEl.dataset.text = text;
    sentenceEl.textContent = text || 'Click words to build a sentence';
  }

  // Build word buttons
  WORDS.forEach(w => {
    const b = document.createElement('button');
    b.className = 'word-btn';
    b.textContent = w;
    b.addEventListener('click', () => {
      pushUndo();
      appendWord(w);
    });
    wordGrid.appendChild(b);
  });

  function appendWord(w) {
    let text = sentenceEl.dataset.text || '';
    if (text.length === 0) text = w;
    else text = text + ' ' + w;
    setSentence(text);
  }

  clearBtn.addEventListener('click', () => {
    pushUndo();
    setSentence('');
  });

  backspaceBtn.addEventListener('click', () => {
    const text = sentenceEl.dataset.text || '';
    if (!text) return;
    pushUndo();
    let newText = text.slice(0, -1).replace(/\s+$/,'');
    setSentence(newText);
  });

  undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    setSentence(prev);
  });

  // Onboarding continue: fetch voices for selection
  onContinue.addEventListener('click', async () => {
    const gender = document.querySelector('input[name="on_gender"]:checked').value;
    const race = document.getElementById('on_race').value;

    // Save selection in UI
    selectedGenderEl.textContent = gender;
    selectedRaceEl.textContent = race;

    // Request voice list from server
    try {
      const res = await fetch('/voices', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ gender: gender, race: race })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>null);
        alert('Failed to load voices: ' + (err?.error || res.statusText));
        return;
      }
      const data = await res.json();
      voiceSelect.innerHTML = '';
      data.voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        voiceSelect.appendChild(opt);
      });

      // Hide onboarding and show app
      onboardModal.style.display = 'none';
      appRoot.style.display = 'block';
    } catch (err) {
      alert('Error fetching voices: ' + err.message);
    }
  });

  // Play button: send voice_name (not voice_id) to server
  playBtn.addEventListener('click', async () => {
    const text = sentenceEl.dataset.text || '';
    if (!text) {
      alert('Build a sentence first by clicking words.');
      return;
    }
    const voice_name = voiceSelect.value;
    status.textContent = 'Synthesizing...';
    playBtn.disabled = true;

    try {
      const payload = {
        text: text,
        voice_name: voice_name,
        stream: false,
        sampling: { temperature: 0.85, top_p: 0.95, top_k: 50 }
      };
      const res = await fetch('/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(()=>null);
        status.textContent = 'Synthesis failed: ' + (err?.error || res.statusText);
        playBtn.disabled = false;
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
      status.textContent = 'Playing';
      audio.onended = () => {
        status.textContent = '';
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    } finally {
      playBtn.disabled = false;
    }
  });
});