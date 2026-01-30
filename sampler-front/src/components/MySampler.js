/**
 * <my-sampler> Web Component - Conteneur Principal
 * 
 * Orchestrateur du sampler. Fait le pont entre :
 * - AudioEngine (Phase 2)
 * - PadGrid (les pads)
 * - WaveformDisplay (visualisation)
 * - ControlRack (contrôles)
 * - StepSequencer (séquenceur)
 * - RecorderPanel (enregistrement)
 * - FreesoundBrowser (recherche samples)
 * 
 * Utilise un système d'onglets pour séparer :
 * - Tab "Pads" : Grille 4x4 + Outils + Waveform + Controls
 * - Tab "Sequencer" : Step sequencer 16 steps
 */

import './PadGrid.js';
import './WaveformDisplay.js';
import './ControlRack.js';
import './StepSequencer.js';
import './RecorderPanel.js';
import './FreesoundBrowser.js';
import './SampleLibrary.js';
import AudioEngine, { AudioEvents } from '../audio/AudioEngine.js';
import { KEY_TO_PAD } from '../audio/AudioConstants.js';
import { API_URL } from '../config/api-config.js';

class MySampler extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._presetData = null;
    this._selectedPadId = null;
    this._isInitialized = false;
    this._activeTab = 'pads';
    this._isSequencerPlaying = false;

    // Bind methods
    this._handlePadTriggered = this._handlePadTriggered.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleEngineReady = this._handleEngineReady.bind(this);
    this._handleSampleLoaded = this._handleSampleLoaded.bind(this);
    this._handlePresetLoaded = this._handlePresetLoaded.bind(this);
    this._handleMidiNote = this._handleMidiNote.bind(this);
    this._handleSequencerTick = this._handleSequencerTick.bind(this);
    this._handleStepToggle = this._handleStepToggle.bind(this);
    this._handleControlChange = this._handleControlChange.bind(this);
  }

  connectedCallback() {
    this.render();
    this._setupEventListeners();
    this._setupAudioEngineListeners();
  }

  disconnectedCallback() {
    this._removeEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0a0a0a;
          color: #fff;
          min-height: 100vh;
        }

        .sampler-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        /* Header */
        .sampler-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: linear-gradient(180deg, #151515 0%, #0a0a0a 100%);
          border-radius: 12px;
          border: 1px solid #2a2a2a;
          margin-bottom: 20px;
        }

        .logo {
          font-size: 1.25rem;
          font-weight: 700;
          background: linear-gradient(135deg, #00d4ff, #ff6b35);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .preset-selector-global {
          display: flex;
          gap: 8px;
          margin-right: 20px;
          padding-right: 20px;
          border-right: 1px solid #333;
        }

        .btn {
          padding: 8px 16px;
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn:hover {
          background: linear-gradient(180deg, #3a3a3a, #2a2a2a);
          border-color: #00d4ff;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-color: #00d4ff;
          color: #000;
        }

        .btn-primary:hover {
          background: linear-gradient(180deg, #00e5ff, #00d4ff);
        }

        .btn-danger {
          background: linear-gradient(180deg, #ff4444, #cc0000);
          border-color: #ff4444;
        }

        .status-led {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #333;
          box-shadow: none;
          transition: all 0.3s ease;
        }

        .status-led.ready {
          background: #00ff88;
          box-shadow: 0 0 10px #00ff88;
        }

        /* Tabs */
        .tabs-container {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: #111;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid #2a2a2a;
        }

        .tab-btn {
          flex: 1;
          padding: 12px 24px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #666;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-btn:hover {
          color: #888;
          background: rgba(255,255,255,0.03);
        }

        .tab-btn.active {
          background: linear-gradient(180deg, #1a1a1a, #0d0d0d);
          color: #00d4ff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        /* Main Layout for Pads Tab */
        .main-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
        }

        @media (max-width: 1000px) {
          .main-layout {
            grid-template-columns: 1fr;
          }
        }

        /* Sections */
        .section {
          background: linear-gradient(180deg, #111, #0a0a0a);
          border-radius: 12px;
          border: 1px solid #2a2a2a;
          padding: 20px;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 15px;
        }

        /* Side Panel */
        .side-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .panel-card {
          background: linear-gradient(180deg, #111, #0a0a0a);
          border-radius: 12px;
          border: 1px solid #2a2a2a;
          padding: 15px;
        }

        /* Transport */
        .sequencer-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sequencer-transport {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px 20px;
          background: linear-gradient(180deg, #151515, #0a0a0a);
          border-radius: 12px;
          border: 1px solid #2a2a2a;
        }

        .transport-time {
          font-family: 'SF Mono', monospace;
          font-size: 1.5rem;
          color: #00d4ff;
          min-width: 80px;
        }

        .transport-step {
          font-size: 0.875rem;
          color: #666;
        }

        .transport-step span {
          color: #ff6b35;
          font-weight: 600;
        }

        .bpm-control {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .bpm-control label {
          font-size: 0.75rem;
          color: #666;
        }

        .bpm-input {
          width: 60px;
          padding: 6px 8px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 4px;
          color: #fff;
          font-size: 1rem;
          font-weight: 600;
          text-align: center;
        }

        /* Preset Selector */
        .preset-selector {
          display: flex;
          gap: 8px;
        }

        .preset-select {
          flex: 1;
          padding: 8px 12px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 6px;
          color: #fff;
          font-size: 0.875rem;
        }

        /* Accordion for Tools */
        .accordion {
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 15px;
        }

        .accordion-header {
          padding: 12px 15px;
          background: #1a1a1a;
          cursor: pointer;
          user-select: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: #aaa;
        }
        
        .accordion-header:hover {
          color: #fff;
          background: #222;
        }

        .accordion-content {
          display: none;
          background: #0a0a0a;
          padding: 10px;
          border-top: 1px solid #2a2a2a;
        }

        .accordion-content.open {
          display: block;
        }

        .keyboard-hint {
          text-align: center;
          font-size: 0.75rem;
          color: #444;
          margin-top: 10px;
        }

        .footer-info {
          text-align: center;
          padding: 15px;
          font-size: 0.75rem;
          color: #444;
          border-top: 1px solid #1a1a1a;
          margin-top: 20px;
        }
      </style>

      <div class="sampler-container">
        <!-- Header -->
        <header class="sampler-header">
          <span class="logo">LOUNISampler</span>
          <div class="header-controls">
            <!-- Global Preset Selector -->
            <div class="preset-selector-global">
               <select class="preset-select" id="preset-select" disabled>
                  <option value="">-- Select Kit --</option>
               </select>
               <button class="btn" id="btn-load" disabled>Load Kit</button>
            </div>

            <!-- Admin Logic -->
             <a href="${API_URL === 'http://localhost:3000' ? 'http://localhost:4200' : 'https://lounis-sampler-admin.onrender.com'}" target="_blank" class="btn" style="text-decoration:none; display:flex; align-items:center; margin-right:12px;">🔧 Admin</a>

            <div class="status-led ${this._isInitialized ? 'ready' : ''}" title="Engine Status"></div>
            <button class="btn btn-primary" id="btn-init" ${this._isInitialized ? 'disabled' : ''}>
              ${this._isInitialized ? '✓ Ready' : '▶ Start'}
            </button>
          </div>
        </header>

        <!-- Tabs -->
        <div class="tabs-container">
          <button class="tab-btn ${this._activeTab === 'pads' ? 'active' : ''}" data-tab="pads">
            Pads
          </button>
          <button class="tab-btn ${this._activeTab === 'sequencer' ? 'active' : ''}" data-tab="sequencer">
            Step Sequencer
          </button>
        </div>

        <!-- Tab: Pads -->
        <div class="tab-content ${this._activeTab === 'pads' ? 'active' : ''}" id="tab-pads">
          <main class="main-layout">
            <!-- Pad Section -->
            <section class="section">
              <div class="section-title">Pads</div>
              <pad-grid id="pad-grid"></pad-grid>
              <p class="keyboard-hint">Keyboard: W X C V / Q S D F / A Z E R / & é " '</p>
            </section>

            <!-- Side Panel -->
            <aside class="side-panel">
              <!-- Preset (MOVED TO HEADER) -->
              <!-- <div class="panel-card"> ... </div> -->

              <!-- Library Accordion -->
              <div class="accordion">
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
                  📂 LIBRARY <span>▼</span>
                </div>
                <div class="accordion-content">
                  <sample-library id="sample-library"></sample-library>
                </div>
              </div>

              <!-- Tools Accordion -->
              <div class="accordion">
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
                  🎙️ RECORDER <span>▼</span>
                </div>
                <div class="accordion-content">
                  <recorder-panel id="recorder-panel"></recorder-panel>
                </div>
              </div>

              <div class="accordion">
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
                  🔊 FREESOUND BROWSER <span>▼</span>
                </div>
                <div class="accordion-content">
                  <freesound-browser id="freesound-browser"></freesound-browser>
                </div>
              </div>

              <!-- Waveform -->
              <div class="panel-card">
                <div class="section-title">Waveform</div>
                <waveform-display id="waveform"></waveform-display>
              </div>

              <!-- Control Rack -->
              <control-rack id="control-rack"></control-rack>
            </aside>
          </main>
        </div>

        <!-- Tab: Sequencer -->
        <div class="tab-content ${this._activeTab === 'sequencer' ? 'active' : ''}" id="tab-sequencer">
          <div class="sequencer-layout">
            <!-- Sequencer Transport -->
            <div class="sequencer-transport">
              <button class="btn ${this._isSequencerPlaying ? 'btn-danger' : 'btn-primary'}" 
                      id="btn-seq-play" disabled>
                ${this._isSequencerPlaying ? '■ Stop' : '▶ Play'}
              </button>
              <div class="transport-time" id="seq-time">00:00</div>
              <div class="transport-step">Step: <span id="seq-step">--</span> / 16</div>
              <div class="bpm-control">
                <label>BPM</label>
                <input type="number" class="bpm-input" id="bpm-input" 
                       value="${this._presetData?.bpm || 120}" 
                       min="60" max="240" disabled>
              </div>
            </div>

            <!-- Step Sequencer Component -->
            <step-sequencer id="step-sequencer"></step-sequencer>
          </div>
        </div>

        <footer class="footer-info">
          Backend: <span id="backend-status">Checking...</span>
        </footer>
      </div>
    `;
  }

  _setupEventListeners() {
    // Tab switching
    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._activeTab = e.target.dataset.tab;
        this._updateTabs();
      });
    });

    // Pad triggered
    this.shadowRoot.addEventListener('pad-triggered', this._handlePadTriggered);

    // Step toggle from sequencer
    this.shadowRoot.addEventListener('step-toggle', this._handleStepToggle);

    // Control changes
    this.shadowRoot.addEventListener('control-change', this._handleControlChange);

    // Recorder: Slice to Pad
    this.shadowRoot.addEventListener('slice-to-pad', (e) => {
      const { padIndex, buffer, label } = e.detail;
      AudioEngine.loadSampleFromBuffer(padIndex, buffer, label);

      // Update Pad UI
      const padGrid = this.shadowRoot.getElementById('pad-grid');
      padGrid?.setPadLoaded(padIndex, label);
    });

    // Freesound: Assign to Pad
    this.shadowRoot.addEventListener('assign-to-pad', async (e) => {
      const { padIndex, url, name } = e.detail;
      console.log('📥 assign-to-pad received:', { padIndex, url, name });

      const padGrid = this.shadowRoot.getElementById('pad-grid');

      // Start loading animation
      padGrid?.triggerPadLoading(padIndex);

      try {
        await AudioEngine.loadSampleFromUrl(padIndex, url, name);

        // Update Pad UI optimistic
        padGrid?.setPadLoaded(padIndex, name);

        // Finish loading animation
        padGrid?.finishPadLoading(padIndex);
      } catch (error) {
        console.error("Load failed", error);
        padGrid?.stopPadProgress(padIndex); // Or stop loading
      }
    });

    // Recorder: Slice Drop Handover
    this.shadowRoot.addEventListener('slice-drop', (e) => {
      const { padIndex, sliceIndex, label } = e.detail;
      const recorder = this.shadowRoot.getElementById('recorder-panel');
      if (recorder) {
        const buffer = recorder.getSliceBuffer(sliceIndex);
        if (buffer) {
          AudioEngine.loadSampleFromBuffer(padIndex, buffer, label);
          const padGrid = this.shadowRoot.getElementById('pad-grid');
          padGrid?.setPadLoaded(padIndex, label);
        }
      }
    });

    // Play from control rack
    this.shadowRoot.addEventListener('play-pad', (e) => {
      if (this._isInitialized && e.detail.padIndex !== null) {
        this._playPadWithWaveform(e.detail.padIndex, 1.0);
      }
    });

    // Stop from control rack
    this.shadowRoot.addEventListener('stop-pad', (e) => {
      if (this._isInitialized && e.detail.padIndex !== null) {
        AudioEngine.stopPad(e.detail.padIndex);
        const waveform = this.shadowRoot.getElementById('waveform');
        waveform?.stopPlayback();

        const padGrid = this.shadowRoot.getElementById('pad-grid');
        padGrid?.stopPadProgress(e.detail.padIndex);
      }
    });

    // Trim change from waveform
    this.shadowRoot.addEventListener('trim-change', (e) => {
      if (this._selectedPadId !== null) {
        AudioEngine.setPadTrim(this._selectedPadId, e.detail.trimStart, e.detail.trimEnd);
      }
    });

    // Keyboard input (on document)
    document.addEventListener('keydown', this._handleKeyDown);

    // Init button
    const btnInit = this.shadowRoot.getElementById('btn-init');
    btnInit?.addEventListener('click', () => this._initAudioEngine());

    // Sequencer play/stop
    const btnSeqPlay = this.shadowRoot.getElementById('btn-seq-play');
    btnSeqPlay?.addEventListener('click', () => this._toggleSequencer());

    // BPM input
    const bpmInput = this.shadowRoot.getElementById('bpm-input');
    bpmInput?.addEventListener('change', (e) => {
      AudioEngine.setBPM(parseInt(e.target.value));
    });

    // Preset selector
    const btnLoad = this.shadowRoot.getElementById('btn-load');
    btnLoad?.addEventListener('click', () => this._loadSelectedPreset());

    // Check backend and fetch presets
    this._checkBackend();
  }

  _removeEventListeners() {
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  _setupAudioEngineListeners() {
    AudioEngine.addEventListener(AudioEvents.ENGINE_READY, this._handleEngineReady);

    // Sample loaded: update Waveform if selected
    AudioEngine.addEventListener(AudioEvents.SAMPLE_LOADED, (e) => {
      this._handleSampleLoaded(e);

      // If the loaded sample corresponds to the currently selected pad, update waveform
      if (this._selectedPadId === e.detail.padIndex) {
        const waveform = this.shadowRoot.getElementById('waveform');
        const bufferData = AudioEngine.getBuffer(e.detail.padIndex);
        if (waveform && bufferData) {
          waveform.setBuffer(bufferData.buffer, e.detail.label);
        }
      }

      // Update Sequencer status
      this._updateSequencerPadStatus(e.detail.padIndex, true, e.detail.label);
    });

    AudioEngine.addEventListener(AudioEvents.PRESET_LOADED, this._handlePresetLoaded);
    AudioEngine.addEventListener(AudioEvents.MIDI_NOTE, this._handleMidiNote);
    AudioEngine.addEventListener(AudioEvents.SEQUENCER_TICK, this._handleSequencerTick);
    AudioEngine.addEventListener(AudioEvents.SEQUENCER_START, () => {
      this._isSequencerPlaying = true;
      this._updateSequencerUI();
    });
    AudioEngine.addEventListener(AudioEvents.SEQUENCER_STOP, () => {
      this._isSequencerPlaying = false;
      this._updateSequencerUI();
      const sequencer = this.shadowRoot.getElementById('step-sequencer');
      if (sequencer) sequencer.setCurrentStep(-1);
    });
  }

  _updateTabs() {
    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this._activeTab);
    });
    this.shadowRoot.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${this._activeTab}`);
    });
  }

  _toggleSequencer() {
    if (this._isSequencerPlaying) {
      AudioEngine.stopSequencer();
    } else {
      AudioEngine.startSequencer();
    }
  }

  _updateSequencerUI() {
    const btnSeqPlay = this.shadowRoot.getElementById('btn-seq-play');
    if (btnSeqPlay) {
      btnSeqPlay.textContent = this._isSequencerPlaying ? '■ Stop' : '▶ Play';
      btnSeqPlay.classList.toggle('btn-danger', this._isSequencerPlaying);
      btnSeqPlay.classList.toggle('btn-primary', !this._isSequencerPlaying);
    }
  }

  async _initAudioEngine() {
    const btnInit = this.shadowRoot.getElementById('btn-init');
    if (btnInit) {
      btnInit.textContent = '...';
      btnInit.disabled = true;
    }
    await AudioEngine.init();
  }

  _handleEngineReady() {
    this._isInitialized = true;
    const statusLed = this.shadowRoot.querySelector('.status-led');
    const btnInit = this.shadowRoot.getElementById('btn-init');
    const btnSeqPlay = this.shadowRoot.getElementById('btn-seq-play');
    const bpmInput = this.shadowRoot.getElementById('bpm-input');
    const presetSelect = this.shadowRoot.getElementById('preset-select');
    const btnLoad = this.shadowRoot.getElementById('btn-load');

    if (statusLed) statusLed.classList.add('ready');
    if (btnInit) {
      btnInit.textContent = '✓ Ready';
      btnInit.disabled = true;
    }
    if (btnSeqPlay) btnSeqPlay.disabled = false;
    if (bpmInput) bpmInput.disabled = false;
    if (presetSelect) presetSelect.disabled = false;
    if (btnLoad) btnLoad.disabled = false;

    console.log('🎛️ Sampler ready!');
  }

  _handlePadTriggered(event) {
    const { padId, velocity } = event.detail;

    if (!this._isInitialized) {
      console.warn('AudioEngine not initialized');
      return;
    }

    this._playPadWithWaveform(padId, velocity);

    // Update selected pad for control rack and freesound
    this._selectedPadId = padId;
    this._updateControlRack();

    // Notify Freesound Browser of selection
    const freesoundBrowser = this.shadowRoot.getElementById('freesound-browser');
    if (freesoundBrowser) {
      freesoundBrowser.setTargetPad(padId);
    }
  }

  _playPadWithWaveform(padId, velocity) {
    AudioEngine.playPad(padId, velocity);
    const waveform = this.shadowRoot.getElementById('waveform');
    const bufferData = AudioEngine.getBuffer(padId);

    // Use stored label or buffer config, or fallback
    let label = `Pad ${padId}`;
    if (this._presetData?.samples) {
      const sample = this._presetData.samples.find(s => s.padIndex === padId);
      if (sample) label = sample.label;
    }
    // Also check buffer config if manual load
    if (bufferData?.config?.label) {
      label = bufferData.config.label;
    }

    if (waveform && bufferData) {
      // Use reversed buffer for display if reverse is active
      const displayBuffer = bufferData.config?.reverse && bufferData.reversedBuffer
        ? bufferData.reversedBuffer
        : bufferData.buffer;
      waveform.setBuffer(displayBuffer, label, bufferData.config);
      waveform.startPlayback(displayBuffer.duration);

      // REMOVED Pad Progress Trigger on playback as requested
      // const padGrid = this.shadowRoot.getElementById('pad-grid');
      // padGrid?.triggerPadProgress(padId, displayBuffer.duration);
    }
  }

  _handleControlChange(event) {
    const { padIndex, param, value } = event.detail;
    if (padIndex === null) return;
    switch (param) {
      case 'volume': AudioEngine.setPadVolume(padIndex, value); break;
      case 'pitch': AudioEngine.setPadPlaybackRate(padIndex, value); break;
      case 'pan': AudioEngine.setPadPan(padIndex, value); break;
      case 'reverse': AudioEngine.setPadReverse(padIndex, value); break;
    }
  }

  _updateControlRack() {
    const controlRack = this.shadowRoot.getElementById('control-rack');
    if (!controlRack) return;

    let sample = this._presetData?.samples?.find(s => s.padIndex === this._selectedPadId);

    // If not in preset, check if loaded manually (buffer)
    if (!sample) {
      const bufferData = AudioEngine.getBuffer(this._selectedPadId);
      if (bufferData?.config) {
        sample = bufferData.config;
      }
    }

    if (sample) {
      controlRack.setPad(this._selectedPadId, sample);
    } else {
      controlRack.setPad(this._selectedPadId, { label: `Pad ${this._selectedPadId}` });
    }
  }

  _updateSequencerPadStatus(padIndex, isLoaded, label) {
    const sequencer = this.shadowRoot.getElementById('step-sequencer');
    if (sequencer && sequencer.setPadStatus) {
      sequencer.setPadStatus(padIndex, isLoaded, label);
    }
  }

  _handleKeyDown(event) {
    if (event.repeat) return;

    // Global Input Guard: Prevent triggering shortcuts when typing in inputs/textareas
    const active = this.shadowRoot.activeElement || document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
    const pathHasInput = event.composedPath().some(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

    if (isInput || pathHasInput) return;

    if (event.code === 'Space' && this._isInitialized) {
      event.preventDefault();
      this._toggleSequencer();
      return;
    }
    const padId = KEY_TO_PAD[event.key.toLowerCase()];
    if (padId !== undefined && this._isInitialized) {
      this._playPadWithWaveform(padId, 1.0);
      // const padGrid = this.shadowRoot.getElementById('pad-grid');
      padGrid?.triggerPadVisual(padId);
      this._selectedPadId = padId;
      this._updateControlRack();

      const freesoundBrowser = this.shadowRoot.getElementById('freesound-browser');
      if (freesoundBrowser) freesoundBrowser.setTargetPad(padId);
    }
  }

  _handleSampleLoaded(event) {
    console.log(`Sample loaded: Pad ${event.detail.padIndex} - ${event.detail.label}`);
    // Update Pad UI immediately whenever a sample loads
    const padGrid = this.shadowRoot.getElementById('pad-grid');
    if (padGrid) {
      // If it's a new load not from preset (e.g. freesoound), we might need to manually update pad visual state if PadGrid doesn't auto-update from engine
      // PadGrid currently only has updateSamples() which takes a full list.
      // We should probably add a method to PadGrid to update a single pad.
      // But for now let's assume updateSamples works or we can re-fetch buffers.
      // Actually PadGrid is dumb, it just keeps buttons. We can just 'add class' loaded?
      // PadElement handles its own class if we tell it to.
    }
  }

  _handlePresetLoaded(event) {
    console.log(`Preset loaded: ${event.detail.name}`);
    const padGrid = this.shadowRoot.getElementById('pad-grid');
    if (padGrid && this._presetData) {
      padGrid.updateSamples(this._presetData.samples);
    }
    const bpmInput = this.shadowRoot.getElementById('bpm-input');
    if (bpmInput && this._presetData) {
      bpmInput.value = this._presetData.bpm || 120;
    }
    const sequencer = this.shadowRoot.getElementById('step-sequencer');
    if (sequencer && this._presetData) {
      sequencer.setSequences(this._presetData.samples);
    }
    const controlRack = this.shadowRoot.getElementById('control-rack');
    if (controlRack) {
      controlRack.clearSelection();
    }
  }

  _handleMidiNote(event) {
    const { padIndex } = event.detail;
    const padGrid = this.shadowRoot.getElementById('pad-grid');
    padGrid?.triggerPadVisual(padIndex);
  }

  _handleSequencerTick(event) {
    const { step } = event.detail;
    const stepDisplay = this.shadowRoot.getElementById('seq-step');
    if (stepDisplay) stepDisplay.textContent = (step + 1).toString().padStart(2, '0');
    const sequencer = this.shadowRoot.getElementById('step-sequencer');
    if (sequencer) sequencer.setCurrentStep(step);
    const padGrid = this.shadowRoot.getElementById('pad-grid');
    if (padGrid && this._presetData) {
      this._presetData.samples.forEach(sample => {
        if (sample.sequence && sample.sequence[step]) {
          padGrid.triggerPadVisual(sample.padIndex);
        }
      });
    }
  }

  _handleStepToggle(event) {
    const { padIndex, stepIndex, active } = event.detail;
    AudioEngine.toggleStep(padIndex, stepIndex);
  }

  async _checkBackend() {
    const statusEl = this.shadowRoot.getElementById('backend-status');
    const baseUrl = API_URL;
    try {
      const resp = await fetch(`${baseUrl}/api/health`);
      const data = await resp.json();
      if (data.status === 'ok') {
        if (statusEl) {
          statusEl.textContent = `✓ Connected (DB: ${data.mongodb})`;
          statusEl.style.color = '#00ff88';
        }
        this._fetchPresets();
      }
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = '✗ Not connected';
        statusEl.style.color = '#ff4444';
      }
    }
  }

  async _fetchPresets() {
    try {
      const response = await fetch(`${API_URL}/api/presets`);
      const result = await response.json();
      const select = this.shadowRoot.getElementById('preset-select');
      if (select && result.data) {
        select.innerHTML = '<option value="">-- Select --</option>';
        result.data.forEach(preset => {
          const option = document.createElement('option');
          option.value = preset._id;
          option.textContent = `${preset.name} (${preset.category})`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  }

  async _loadSelectedPreset() {
    const select = this.shadowRoot.getElementById('preset-select');
    const presetId = select?.value;
    if (!presetId) return;
    try {
      const response = await fetch(`${API_URL}/api/presets/${presetId}`);
      const result = await response.json();
      if (result.success && result.data) {
        this._presetData = result.data;
        await AudioEngine.loadPreset(result.data);
      }
    } catch (error) {
      console.error('Failed to load preset:', error);
    }
  }
}

customElements.define('my-sampler', MySampler);

export default MySampler;
