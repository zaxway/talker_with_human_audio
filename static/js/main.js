// Words to show as buttons
const WORDS = ["I","What","How","are","is","am","doing","you","today","please","thank","yes","no"];

const FEMALE_VOICES = ["Linda","Margeret","Bella"];
const MALE_VOICES = ["Bob","Smith","Tom"];

document.addEventListener('DOMContentLoaded', () => {
  const wordGrid = document.getElementById('wordGrid');
  const sentenceEl = document.getElementById('sentence');
  const clearBtn = document.getElementById('clearBtn');
  const backspaceBtn = document.getElementById('backspaceBtn');
  const playBtn = document.getElementById('playBtn');
  const voiceSelect = document.getElementById('voiceSelect');
  const status = document.getElementById('status');

  // Build word buttons
  WORDS.forEach(w => {
    const b = document.createElement('button');
    b.className = 'word-btn';
    b.textContent = w;
    b.addEventListener('click', () => {
      appendWord(w);
    });
    wordGrid.appendChild(b);
  });

  function appendWord(w) {
    let text = sentenceEl.dataset.text || '';
    if (text.length === 0) text = w;
    else text = text + ' ' + w;
    sentenceEl.dataset.text = text;
    sentenceEl.textContent = text;
  }

  clearBtn.addEventListener('click', () => {
    sentenceEl.dataset.text = '';
    sentenceEl.textContent = 'Click words to build a sentence';
  });

  backspaceBtn.addEventListener('click', () => {
    let text = sentenceEl.dataset.text || '';
    if (!text) return;
    const parts = text.split(' ');
    parts.pop();
    const newText = parts.join(' ');
    sentenceEl.dataset.text = newText;
    sentenceEl.textContent = newText || 'Click words to build a sentence';
  });

  // Populate voices based on gender
  function populateVoices(gender) {
    voiceSelect.innerHTML = '';
    const list = gender === 'male' ? MALE_VOICES : FEMALE_VOICES;
    list.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      voiceSelect.appendChild(opt);
    });
  }

  // Initialize voices
  populateVoices('female');

  // Gender radio change
  document.querySelectorAll('input[name="gender"]').forEach(r => {
    r.addEventListener('change', (e) => {
      populateVoices(e.target.value);
    });
  });

  // Play button: call /synthesize and play returned audio blob
  playBtn.addEventListener('click', async () => {
    const text = sentenceEl.dataset.text || '';
    if (!text) {
      alert('Build a sentence first by clicking words.');
      return;
    }
    const voice = voiceSelect.value;
    status.textContent = 'Synthesizing...';
    playBtn.disabled = true;

    try {
      const payload = {
        text: text,
        voice: voice,
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