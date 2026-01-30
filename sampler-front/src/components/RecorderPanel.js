/**
 * <recorder-panel> Web Component
 * 
 * Enregistrement audio via le microphone avec :
 * - Bouton Rec/Stop
 * - Visualisation en temps réel (oscilloscope)
 * - Mode "Auto-Slice" qui analyse les silences
 * - Mapping vers les pads vides (règle prof: bas à droite inversé)
 * 
 * Événements émis :
 *   - recording-complete: { audioBuffer, slices }
 *   - slice-to-pad: { padIndex, buffer }
 */
import { API_URL } from '../config/api-config.js';
import audioEngine from '../audio/AudioEngine.js';

class RecorderPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._isRecording = false;
    this._mediaRecorder = null;
    this._audioContext = null;
    this._analyser = null;
    this._recordedChunks = [];
    this._recordedBuffer = null;
    this._slices = [];
    this._animationId = null;

    // Auto-slice settings
    this._silenceThreshold = 0.02;  // RMS threshold for silence
    this._minSilenceDuration = 0.15; // 150ms minimum silence
    this._minSliceDuration = 0.1;    // 100ms minimum slice

    // Bind methods
    this._animate = this._animate.bind(this);
  }

  connectedCallback() {
    this._renderStatic();
    this._setupEventListeners();
    this._setupCanvas(); // Initial setup for oscilloscope
    this._updateUIState(false); // Initial UI state
  }

  disconnectedCallback() {
    this._stopAnimation();
    this._stopRecording();
    this._stopPlayback();
  }

  // Render static structure ONCE
  _renderStatic() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .recorder-container {
          background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          padding: 15px;
          position: relative; /* For save modal positioning */
        }

        .recorder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .recorder-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.6875rem;
          color: #ff4444;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .recording-indicator.active {
          opacity: 1;
        }

        .recording-dot {
          width: 8px;
          height: 8px;
          background: #ff4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Oscilloscope */
        .oscilloscope {
          width: 100%;
          height: 60px;
          background: #0d0d0d;
          border-radius: 6px;
          border: 1px solid #1a1a1a;
          margin-bottom: 12px;
        }

        .oscilloscope canvas {
          width: 100%;
          height: 100%;
        }

        /* Controls */
        .controls {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap; /* Fix overflow */
        }

        .btn {
          flex: 1;
          padding: 10px 16px;
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn:hover {
          border-color: #00d4ff;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-rec {
          background: linear-gradient(180deg, #ff4444, #cc0000);
          border-color: #ff4444;
        }

        .btn-rec:hover {
          background: linear-gradient(180deg, #ff6666, #ff4444);
        }

        .btn-rec.recording {
          animation: rec-pulse 1s infinite;
        }

        @keyframes rec-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(255, 68, 68, 0); }
        }

        .btn-slice {
          background: linear-gradient(180deg, #ff6b35, #cc4400);
          border-color: #ff6b35;
        }

        /* Slices preview */
        .slices-preview {
          display: none;
        }

        .slices-preview.active {
          display: block;
        }

        .slices-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .slices-title {
          font-size: 0.6875rem;
          color: #666;
        }

        .slice-count {
          font-size: 0.625rem;
          color: #00d4ff;
          background: rgba(0, 212, 255, 0.1);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .slices-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          max-height: 80px;
          overflow-y: auto;
        }

        .slice-item {
          padding: 4px 8px;
          background: linear-gradient(180deg, #1a1a1a, #0d0d0d);
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          font-size: 0.625rem;
          color: #888;
          cursor: pointer;
          transition: all 0.1s;
          user-select: none; /* Improve drag */
        }

        .slice-item:hover {
          border-color: #00d4ff;
          color: #00d4ff;
        }

        .slice-duration {
          color: #555;
          margin-left: 4px;
        }

        /* Settings */
        .settings-toggle {
          font-size: 0.625rem;
          color: #555;
          cursor: pointer;
          text-align: center;
          padding: 8px;
          margin-top: 8px;
        }

        .settings-toggle:hover {
          color: #888;
        }

        .settings-panel {
          display: none;
          padding-top: 12px;
          border-top: 1px solid #1a1a1a;
          margin-top: 12px;
        }

        .settings-panel.open {
          display: block;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.625rem;
          color: #666;
        }

        .setting-row input {
          width: 60px;
          padding: 4px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          color: #fff;
          font-size: 0.625rem;
          text-align: center;
        }

        /* Assign button */
        .btn-assign {
          width: 100%;
          margin-top: 12px;
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-color: #00d4ff;
          color: #000;
        }

        .btn-assign:hover {
          background: linear-gradient(180deg, #00e5ff, #00d4ff);
        }

        /* SAVE MODAL */
        .save-modal {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.95);
            backdrop-filter: blur(5px);
            z-index: 100;
            padding: 20px;
            display: none;
            flex-direction: column;
            border-radius: 8px;
        }
        .save-modal.open { display: flex; }
        .save-header { font-size: 1rem; color: #fff; margin-bottom: 20px; font-weight: bold; }
        .save-options { flex: 1; overflow-y: auto; margin-bottom: 20px; }
        .save-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px; background: #111; border: 1px solid #333; border-radius: 4px; }
        .save-row input[type="text"] { background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 4px; flex: 1; }
        .save-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #00d4ff; }
        .save-actions { display: flex; gap: 10px; }
        .save-btn { flex: 1; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; border: none; }
        .save-btn.cancel { background: #333; color: #aaa; }
        .save-btn.confirm { background: #00d4ff; color: #000; }
        
        .section-label { color: #666; font-size: 0.7rem; margin-bottom: 8px; text-transform: uppercase; }
      </style>

      <div class="recorder-container">
        <!-- SAVE MODAL START -->
        <div class="save-modal" id="save-modal">
            <div class="save-header">Save Recording</div>
            
            <div class="save-options">
                <!-- Option 1: Full Recording -->
                <div class="section-label">Master Recording</div>
                <div class="save-row">
                    <input type="checkbox" id="save-full" checked>
                    <input type="text" id="name-full" placeholder="Master Name">
                    <span style="font-size:0.7rem; color:#666">Full</span>
                </div>

                <!-- Option 2: Slices -->
                <div id="save-slices-container" style="display:none">
                    <div class="section-label" style="margin-top:20px">Slices</div>
                    <div id="save-slices-list"></div>
                </div>
            </div>

            <div class="save-actions">
                <button class="save-btn cancel" id="btn-cancel-save">Cancel</button>
                <button class="save-btn confirm" id="btn-confirm-save">Save Selected</button>
            </div>
        </div>
        <!-- SAVE MODAL END -->

        <div class="recorder-header">
          <span class="recorder-title">Microphone Recorder</span>
          <div class="recording-indicator" id="recording-indicator">
            <span class="recording-dot"></span>
            <span>REC</span>
          </div>
        </div>

        <!-- Oscilloscope (Live) -->
        <div class="oscilloscope" id="oscilloscope-container">
          <canvas id="oscilloscope"></canvas>
        </div>

        <!-- Waveform Review (Post-Record) -->
        <div class="waveform-review" id="waveform-review" style="display:none">
             <waveform-display id="record-waveform"></waveform-display>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button class="btn btn-rec" id="btn-rec">Record</button>
          
          <!-- Play Button (Review) -->
           <button class="btn" id="btn-play-review" disabled>
            Play
          </button>

          <button class="btn btn-slice" id="btn-slice" disabled>
            Auto-Slice
          </button>
          <button class="btn" id="btn-save" disabled style="background:linear-gradient(180deg, #10b981, #059669); border-color:#10b981;">
            Save
          </button>
           <button class="btn" id="btn-reset" disabled>
            New
          </button>
        </div>

        <!-- Slices Preview -->
        <div class="slices-preview" id="slices-preview">
          <div class="slices-header">
            <span class="slices-title">Detected slices (Drag to Pad)</span>
            <span class="slice-count" id="slice-count">0 slices</span>
          </div>
          <div class="slices-list" id="slices-list"></div>
          <button class="btn btn-assign" id="btn-assign" disabled>
            Fill Empty Pads
          </button>
        </div>

        <!-- Settings Toggle -->
        <div class="settings-toggle" id="settings-toggle">
          Slice Settings
        </div>

        <!-- Settings Panel -->
        <div class="settings-panel" id="settings-panel">
          <div class="setting-row">
            <span>Silence Threshold</span>
            <input type="number" id="threshold" value="${this._silenceThreshold}" step="0.01" min="0.01" max="0.2">
          </div>
          <div class="setting-row">
            <span>Min Silence (s)</span>
            <input type="number" id="min-silence" value="${this._minSilenceDuration}" step="0.05" min="0.05" max="1">
          </div>
          <div class="setting-row">
            <span>Min Slice (s)</span>
            <input type="number" id="min-slice" value="${this._minSliceDuration}" step="0.05" min="0.05" max="1">
          </div>
        </div>
      </div>
    `;
  }

  _setupEventListeners() {
    // Record button
    this.shadowRoot.getElementById('btn-rec')?.addEventListener('click', () => {
      if (this._isRecording) {
        this._stopRecording();
      } else {
        this._startRecording();
      }
    });

    // Auto-slice button
    this.shadowRoot.getElementById('btn-slice')?.addEventListener('click', () => {
      this._autoSlice();
    });

    // Assign button
    this.shadowRoot.getElementById('btn-assign')?.addEventListener('click', () => {
      this._assignToEmptyPads();
    });

    // Save button
    this.shadowRoot.getElementById('btn-save')?.addEventListener('click', () => {
      this._openSaveModal();
    });

    // Slice items (play preview)
    this.shadowRoot.getElementById('slices-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.slice-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this._playSlice(index);
      }
    });

    // Slice items (Drag Start)
    this.shadowRoot.getElementById('slices-list')?.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.slice-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        const slice = this._slices[index];

        // We can't drag a raw AudioBuffer easily via DataTransfer.
        // Efficient way: Encode to WAV Blob URL on the fly or just pass internal ID if same page.
        // Since Sampler and Recorder are same app/page, we can use a custom event or a global registry?
        // No, dragstart needs to set dataTransfer.

        // Hack: attach buffer to window temporarily or use Custom Event? 
        // Drag&Drop API is strict.
        // Let's create a WAV blob for it. (Expensive but standard).
        // Or simpler: Pass a "slice-id" and let PadGrid ask for it? Too complex.

        // Let's use `application/json` with { type: 'buffer-slice', index: ... }
        // And we need to expose a way to get that buffer from RecorderPanel to MySampler.

        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'slice-drag',
          sourceId: 'recorder-panel', // to identify source component
          index: index, // slice index
          label: `Slice ${index + 1}`
        }));
      }
    });

    // Play Review button
    this.shadowRoot.getElementById('btn-play-review')?.addEventListener('click', () => {
      this._togglePlayback();
    });

    // Reset button
    this.shadowRoot.getElementById('btn-reset')?.addEventListener('click', () => {
      this._resetRecording();
    });

    // Settings toggle
    this.shadowRoot.getElementById('settings-toggle')?.addEventListener('click', () => {
      const panel = this.shadowRoot.getElementById('settings-panel');
      panel?.classList.toggle('open');
    });

    // Settings inputs
    ['threshold', 'min-silence', 'min-slice'].forEach(id => {
      this.shadowRoot.getElementById(id)?.addEventListener('change', (e) => {
        if (id === 'threshold') this._silenceThreshold = parseFloat(e.target.value);
        if (id === 'min-silence') this._minSilenceDuration = parseFloat(e.target.value);
        if (id === 'min-slice') this._minSliceDuration = parseFloat(e.target.value);
      });
    });

    // Save Modal buttons
    this.shadowRoot.getElementById('btn-cancel-save')?.addEventListener('click', () => {
      this.shadowRoot.getElementById('save-modal')?.classList.remove('open');
    });
    this.shadowRoot.getElementById('btn-confirm-save')?.addEventListener('click', () => {
      this._saveToLibrary();
    });
  }

  // UPDATED: No more innerHTML replacement
  _updateUIState(hasRecording) {
    const indicator = this.shadowRoot.getElementById('recording-indicator');
    const oscContainer = this.shadowRoot.getElementById('oscilloscope-container');
    const waveReview = this.shadowRoot.getElementById('waveform-review');
    const btnRec = this.shadowRoot.getElementById('btn-rec');
    const btnPlay = this.shadowRoot.getElementById('btn-play-review');
    const btnSlice = this.shadowRoot.getElementById('btn-slice');
    const btnSave = this.shadowRoot.getElementById('btn-save');
    const btnReset = this.shadowRoot.getElementById('btn-reset');
    const slicesPreview = this.shadowRoot.getElementById('slices-preview');
    const sliceCount = this.shadowRoot.getElementById('slice-count');
    const slicesList = this.shadowRoot.getElementById('slices-list');
    const btnAssign = this.shadowRoot.getElementById('btn-assign');

    if (this._isRecording) {
      indicator.classList.add('active');
      btnRec.classList.add('recording');
      btnRec.textContent = '■ Stop';
    } else {
      indicator.classList.remove('active');
      btnRec.classList.remove('recording');
      btnRec.textContent = '● Rec';
    }

    if (hasRecording) {
      oscContainer.style.display = 'none';
      waveReview.style.display = 'block';

      btnPlay.disabled = false;
      btnSlice.disabled = false;
      btnSave.disabled = false;
      btnReset.disabled = false;

      // Update slices preview
      if (this._slices.length > 0) {
        slicesPreview.classList.add('active');
        sliceCount.textContent = `${this._slices.length} slices`;
        slicesList.innerHTML = this._slices.map((slice, i) => `
              <div class="slice-item" data-index="${i}" draggable="true">
                 <span class="slice-icon">✂️</span> Slice ${i + 1} <span class="slice-duration">(${slice.duration.toFixed(2)}s)</span>
              </div>
            `).join('');
        btnAssign.disabled = false;
      } else {
        slicesPreview.classList.remove('active');
        sliceCount.textContent = `0 slices`;
        slicesList.innerHTML = '';
        btnAssign.disabled = true;
      }

      // Update waveform display
      const waveform = this.shadowRoot.getElementById('record-waveform');
      if (waveform && this._recordedBuffer) {
        waveform.setBuffer(this._recordedBuffer);
      }

    } else { // No recording or recording reset
      oscContainer.style.display = 'block';
      waveReview.style.display = 'none';

      btnPlay.disabled = true;
      btnSlice.disabled = true;
      btnSave.disabled = true;
      btnReset.disabled = true;

      slicesPreview.classList.remove('active');
      sliceCount.textContent = `0 slices`;
      slicesList.innerHTML = '';
      btnAssign.disabled = true;

      // Clear Waveform
      const w = this.shadowRoot.getElementById('record-waveform');
      if (w) w.setBuffer(null);
    }
  }

  _setupCanvas() {
    const canvas = this.shadowRoot.getElementById('oscilloscope');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Draw initial flat line
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, container.offsetWidth, container.offsetHeight);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, container.offsetHeight / 2);
    ctx.lineTo(container.offsetWidth, container.offsetHeight / 2);
    ctx.stroke();
  }

  async _startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this._audioContext.createMediaStreamSource(stream);

      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 2048;
      source.connect(this._analyser);

      // MediaRecorder
      this._mediaRecorder = new MediaRecorder(stream);
      this._recordedChunks = [];

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this._recordedChunks.push(e.data);
        }
      };

      this._mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        await this._processRecording();
      };

      this._mediaRecorder.start();
      this._isRecording = true;
      this._updateUIState(false);
      this._setupCanvas(); /* Fix Invisible Live Wave */
      this._animate();

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  _stopRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }
    this._stopAnimation();
    this._isRecording = false;
    this._updateUIState(false);
  }

  _stopAnimation() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  _animate() {
    if (!this._isRecording || !this._analyser) return;

    const canvas = this.shadowRoot.getElementById('oscilloscope');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    const bufferLength = this._analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this._analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00d4ff';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();

    this._animationId = requestAnimationFrame(this._animate);
  }

  // --- Public API for MySampler ---
  getSliceBuffer(index) {
    if (this._slices[index]) {
      return this._slices[index].buffer;
    }
    return null;
  }

  // --- Interaction Methods ---

  _playSlice(index) {
    if (!this._slices[index]) return;

    const slice = this._slices[index];
    if (this._audioContext && slice.buffer) {
      const source = this._audioContext.createBufferSource();
      source.buffer = slice.buffer;
      source.connect(this._audioContext.destination);
      source.start();
    }
  }

  _assignToEmptyPads() {
    if (this._slices.length === 0) return;

    this.dispatchEvent(new CustomEvent('assign-slices-to-pads', {
      bubbles: true,
      composed: true,
      detail: { slices: this._slices }
    }));
  }

  // --- SAVE MODAL LOGIC ---

  _openSaveModal() {
    const modal = this.shadowRoot.getElementById('save-modal');
    const slicesContainer = this.shadowRoot.getElementById('save-slices-container');
    const slicesList = this.shadowRoot.getElementById('save-slices-list');

    // Clear previous list to avoid duplicates if called multiple times
    slicesList.innerHTML = '';

    if (this._slices.length > 0) {
      slicesContainer.style.display = 'block';
      slicesList.innerHTML = this._slices.map((slice, i) => `
            <div class="save-row">
                <input type="checkbox" class="save-slice-check" data-index="${i}" checked>
                <input type="text" class="save-slice-name" data-index="${i}" value="Slice ${i + 1}">
                <span style="font-size:0.7rem; color:#666">${slice.duration.toFixed(2)}s</span>
            </div>
          `).join('');
    } else {
      slicesContainer.style.display = 'none';
    }

    modal.classList.add('open');

    // We rely on static listeners for Cancel/Confirm.
  }

  async _confirmSave() {
    const saveFull = this.shadowRoot.querySelector('#save-full').checked;
    const fullPrefix = this.shadowRoot.querySelector('#name-full').value || 'MyRecording';
    const category = 'Voice';

    let totalSaved = 0;

    // 1. Save Full
    if (saveFull) {
      const blob = new Blob(this._recordedChunks, { type: 'audio/webm' });
      await this._uploadFile(blob, `${fullPrefix}.webm`, category);
      totalSaved++;
    }

    // 2. Save Slices
    // Correct selection: query inside shadowRoot, looking for elements with specific classes.
    // Note: Depending on browser/framework, querySelectorAll might return stale elements if DOM recently updated? 
    // No, shadowRoot.querySelectorAll is live-ish for standard DOM.
    const sliceChecks = Array.from(this.shadowRoot.querySelectorAll('.save-slice-check'));
    const sliceNames = Array.from(this.shadowRoot.querySelectorAll('.save-slice-name'));

    if (sliceChecks.length > 0) {
      for (let i = 0; i < sliceChecks.length; i++) {
        const checkbox = sliceChecks[i];
        // Find corresponding name input. They share order if generated together.
        // Better: find closest row or use index matching.
        const idx = parseInt(checkbox.dataset.index);

        // Find name input with same index to be safe
        const nameInput = sliceNames.find(el => parseInt(el.dataset.index) === idx);
        const name = nameInput ? nameInput.value : `Slice ${idx + 1}`;

        if (checkbox.checked) {
          const slice = this._slices[idx];
          if (slice) {
            const blob = await this._bufferToBlob(slice.buffer);
            await this._uploadFile(blob, `${name}.wav`, category);
            totalSaved++;
          }
        }
      }
    }

    if (totalSaved > 0) alert(`Saved ${totalSaved} items to Library!`);
    this.shadowRoot.getElementById('save-modal').classList.remove('open');
  }

  /* _saveToLibrary shim to route correctly if called directly */
  async _saveToLibrary() {
    this._confirmSave();
  }

  async _uploadFile(blob, name, category) {
    const formData = new FormData();
    formData.append('file', blob, name);
    formData.append('name', name);
    formData.append('category', category);

    const res = await fetch(`${API_URL}/api/samples`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }

  // Helper to convert AudioBuffer to Wav Blob (Reuse AudioEngine or implementation)
  async _bufferToBlob(buffer) {
    // Simple WAV encoder
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while (pos < buffer.length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true);
        offset += 2;
      }
      pos++;
    }

    return new Blob([bufferArr], { type: 'audio/wav' });

    function setUint16(models) { view.setUint16(pos, models, true); pos += 2; }
    function setUint32(models) { view.setUint32(pos, models, true); pos += 4; }
  }

  _processRecording() {
    const blob = new Blob(this._recordedChunks, { type: 'audio/webm' });

    // Decode and show waveform
    blob.arrayBuffer().then(arrayBuffer => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return audioContext.decodeAudioData(arrayBuffer);
    }).then(decodedBuffer => {
      this._recordedBuffer = decodedBuffer;
      console.log(`Recording processed: ${this._recordedBuffer.duration.toFixed(2)}s`);

      // Update UI View
      this._updateUIState(true);

      const waveform = this.shadowRoot.getElementById('record-waveform');
      if (waveform) {
        waveform.setBuffer(this._recordedBuffer, 'Recording');
      }
    }).catch(err => console.error("Processing failed", err));
  }

  _updateUIState(hasRecording) {
    const indicator = this.shadowRoot.getElementById('recording-indicator');
    const oscContainer = this.shadowRoot.getElementById('oscilloscope-container');
    const waveReview = this.shadowRoot.getElementById('waveform-review');
    const btnRec = this.shadowRoot.getElementById('btn-rec');
    const btnPlay = this.shadowRoot.getElementById('btn-play-review');
    const btnSlice = this.shadowRoot.getElementById('btn-slice');
    const btnSave = this.shadowRoot.getElementById('btn-save');
    const btnReset = this.shadowRoot.getElementById('btn-reset');
    const slicesPreview = this.shadowRoot.getElementById('slices-preview');
    const sliceCount = this.shadowRoot.getElementById('slice-count');
    const slicesList = this.shadowRoot.getElementById('slices-list');
    const btnAssign = this.shadowRoot.getElementById('btn-assign');

    if (this._isRecording) {
      indicator.classList.add('active');
      btnRec.classList.add('recording');
      btnRec.textContent = '■ Stop';
    } else {
      indicator.classList.remove('active');
      btnRec.classList.remove('recording');
      btnRec.textContent = '● Rec';
    }

    if (hasRecording) {
      oscContainer.style.display = 'none';
      waveReview.style.display = 'block';

      btnPlay.disabled = false;
      btnSlice.disabled = false;
      btnSave.disabled = false;
      btnReset.disabled = false;

      // Update slices preview
      if (this._slices.length > 0) {
        slicesPreview.classList.add('active');
        sliceCount.textContent = `${this._slices.length} slices`;
        slicesList.innerHTML = this._slices.map((slice, i) => `
              <div class="slice-item" data-index="${i}" draggable="true">
                 <span class="slice-icon">✂️</span> Slice ${i + 1} <span class="slice-duration">(${slice.duration.toFixed(2)}s)</span>
              </div>
            `).join('');
        btnAssign.disabled = false;
      } else {
        slicesPreview.classList.remove('active');
        sliceCount.textContent = `0 slices`;
        slicesList.innerHTML = '';
        btnAssign.disabled = true;
      }

      // Update waveform display
      const waveform = this.shadowRoot.getElementById('record-waveform');
      if (waveform && this._recordedBuffer) {
        waveform.setBuffer(this._recordedBuffer);
      }

    } else { // No recording or recording reset
      oscContainer.style.display = 'block';
      waveReview.style.display = 'none';

      btnPlay.disabled = true;
      btnSlice.disabled = true;
      btnSave.disabled = true;
      btnReset.disabled = true;

      slicesPreview.classList.remove('active');
      sliceCount.textContent = `0 slices`;
      slicesList.innerHTML = '';
      btnAssign.disabled = true;

      // Clear Waveform
      const w = this.shadowRoot.getElementById('record-waveform');
      if (w) w.setBuffer(null);
    }
  }

  // --- Playback Logic ---
  _togglePlayback() {
    const waveform = this.shadowRoot.getElementById('record-waveform');
    if (waveform && this._recordedBuffer) {
      this._playReviewAudio();
    }
  }

  _stopPlayback() {
    // If we had a persistent source, we'd stop it here. 
    // Currently _playReviewAudio creates a one-shot source.
    // We could track it if we wanted to support stop.
  }

  _playReviewAudio() {
    if (!this._audioContext || !this._recordedBuffer) return;

    const source = this._audioContext.createBufferSource();
    source.buffer = this._recordedBuffer;
    source.connect(this._audioContext.destination);
    source.start();

    const waveform = this.shadowRoot.getElementById('record-waveform');
    if (waveform) waveform.startPlayback(this._recordedBuffer.duration);
  }

  _resetRecording() {
    this._recordedChunks = [];
    this._recordedBuffer = null;
    this._slices = [];
    this._updateUIState(false);
    this._setupCanvas();
  }

  _autoSlice() {
    if (!this._recordedBuffer) return;

    const channelData = this._recordedBuffer.getChannelData(0);
    const sampleRate = this._recordedBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows

    const slicePoints = [0];
    let inSilence = false;
    let silenceStart = 0;

    for (let i = 0; i < channelData.length; i += windowSize) {
      // Calculate RMS for window
      let sum = 0;
      for (let j = 0; j < windowSize && (i + j) < channelData.length; j++) {
        sum += channelData[i + j] * channelData[i + j];
      }
      const rms = Math.sqrt(sum / windowSize);

      const isSilent = rms < this._silenceThreshold;
      const currentTime = i / sampleRate;

      if (isSilent && !inSilence) {
        silenceStart = currentTime;
        inSilence = true;
      } else if (!isSilent && inSilence) {
        const silenceDuration = currentTime - silenceStart;
        if (silenceDuration >= this._minSilenceDuration) {
          // Add slice point at the middle of the silence
          slicePoints.push(silenceStart + silenceDuration / 2);
        }
        inSilence = false;
      }
    }

    slicePoints.push(this._recordedBuffer.duration);

    // Create slices
    this._slices = [];
    for (let i = 0; i < slicePoints.length - 1; i++) {
      const startTime = slicePoints[i];
      const endTime = slicePoints[i + 1];
      const duration = endTime - startTime;

      if (duration >= this._minSliceDuration) {
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const sliceLength = endSample - startSample;

        const sliceBuffer = this._audioContext.createBuffer(
          this._recordedBuffer.numberOfChannels,
          sliceLength,
          sampleRate
        );

        let totalSum = 0;
        let sampleCount = 0;

        for (let ch = 0; ch < this._recordedBuffer.numberOfChannels; ch++) {
          const sourceData = this._recordedBuffer.getChannelData(ch);
          const sliceData = sliceBuffer.getChannelData(ch);
          for (let j = 0; j < sliceLength; j++) {
            const val = sourceData[startSample + j];
            sliceData[j] = val;
            if (ch === 0) {
              totalSum += val * val;
              sampleCount++;
            }
          }
        }

        // GHOST SLICE FIX: Check if slice actually has sound
        const avgRms = Math.sqrt(totalSum / sampleCount);
        if (avgRms > this._silenceThreshold * 0.25) {
          this._slices.push({
            buffer: sliceBuffer,
            startTime,
            endTime,
            duration
          });
        }
      }
    }

    console.log(`Auto-slice: ${this._slices.length} slices detected`);
    this._renderSlices();
  }

  _renderSlices() {
    const list = this.shadowRoot.getElementById('slices-list');
    const count = this.shadowRoot.getElementById('slice-count');
    const preview = this.shadowRoot.getElementById('slices-preview');
    const btnAssign = this.shadowRoot.getElementById('btn-assign');

    if (list) {
      list.innerHTML = this._slices.map((slice, i) => `
              <div class="slice-item" data-index="${i}" draggable="true">
                 <span class="slice-icon">✂️</span> Slice ${i + 1} <span class="slice-duration">(${slice.duration.toFixed(2)}s)</span>
              </div>
            `).join('');
    }
    if (count) count.textContent = `${this._slices.length} slices`;
    if (preview) {
      if (this._slices.length > 0) preview.classList.add('active');
      else preview.classList.remove('active');
    }
    if (btnAssign) btnAssign.disabled = this._slices.length === 0;
  }

  // --- SAVE MODAL LOGIC ---

  _saveToLibrary() {
    if (!this._recordedChunks.length && !this._recordedBuffer) return;
    this._openSaveModal();
  }

  _openSaveModal() {
    const modal = this.shadowRoot.getElementById('save-modal');
    const slicesContainer = this.shadowRoot.getElementById('save-slices-container');
    const slicesList = this.shadowRoot.getElementById('save-slices-list');

    if (this._slices.length > 0) {
      slicesContainer.style.display = 'block';
      slicesList.innerHTML = this._slices.map((slice, i) => `
            <div class="save-row">
                <input type="checkbox" class="save-slice-check" data-index="${i}" checked>
                <input type="text" class="save-slice-name" data-index="${i}" value="Slice ${i + 1}">
                <span style="font-size:0.7rem; color:#666">${slice.duration.toFixed(2)}s</span>
            </div>
          `).join('');
    } else {
      slicesContainer.style.display = 'none';
    }

    modal.classList.add('open');

    // One-time listener setup for modal buttons (remove first to avoid duplicates)
    const btnCancel = this.shadowRoot.getElementById('btn-cancel-save');
    const btnConfirm = this.shadowRoot.getElementById('btn-confirm-save');

    const close = () => modal.classList.remove('open');

    // Cloning nodes is a lazy way to remove listeners, but better to use named references if possible.
    // For now, simpler:
    btnCancel.onclick = close;

    btnConfirm.onclick = async () => {
      await this._confirmSave();
      close();
    };
  }

  async _confirmSave() {
    const saveFull = this.shadowRoot.querySelector('#save-full').checked;
    const fullPrefix = this.shadowRoot.querySelector('#name-full').value || 'MyRecording';
    const category = 'Voice';

    let totalSaved = 0;

    // 1. Save Full
    if (saveFull) {
      const blob = new Blob(this._recordedChunks, { type: 'audio/webm' });
      await this._uploadFile(blob, `${fullPrefix}.webm`, category);
      totalSaved++;
    }

    // 2. Save Slices - Reliable Row Traversal
    const rows = Array.from(this.shadowRoot.querySelectorAll('#save-slices-list .save-row'));

    for (const row of rows) {
      const checkbox = row.querySelector('.save-slice-check');
      const nameInput = row.querySelector('.save-slice-name');

      if (checkbox && checkbox.checked) {
        // Use data-index from checkbox
        const index = parseInt(checkbox.getAttribute('data-index'));
        const name = nameInput ? nameInput.value : `Slice ${index + 1}`;

        const slice = this._slices[index];
        if (slice) {
          const blob = await this._bufferToBlob(slice.buffer);
          await this._uploadFile(blob, `${name}.wav`, category);
          totalSaved++;
        }
      }
    }

    if (totalSaved > 0) alert(`Saved ${totalSaved} items to Library!`);
    this.shadowRoot.getElementById('save-modal').classList.remove('open');
  }


}

customElements.define('recorder-panel', RecorderPanel);

export default RecorderPanel;
