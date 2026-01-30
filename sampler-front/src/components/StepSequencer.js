/**
 * <step-sequencer> Web Component
 * 
 * Séquenceur 16 steps synchronisé avec le BPM.
 * Chaque ligne représente un pad, chaque colonne un step (1/16 note).
 * 
 * Événements émis :
 *   - step-toggle: { padIndex, stepIndex, active }
 * - Syncs with AudioEngine
 */
import { API_URL } from '../config/api-config.js';

export class StepSequencer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._sequences = new Map();  // Map<padIndex, boolean[16]>
    this._padStatuses = new Map(); // Map<padIndex, { loaded: boolean, label: string }>
    this._currentStep = -1;
    this._isPlaying = false;
    this._visiblePads = [0, 1, 2, 3, 4, 5, 6, 7];  // Show first 8 pads by default
    this._savedPresets = [];  // Array of { name, sequences: Map serialized }
    this._loadSavedPresetsFromStorage();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const padLabels = {
      0: 'Kick', 1: 'Snare', 2: 'Hi-Hat', 3: 'Clap',
      4: 'Tom', 5: 'Rim', 6: 'Perc', 7: 'FX',
      8: 'Pad 8', 9: 'Pad 9', 10: 'Pad 10', 11: 'Pad 11',
      12: 'Pad 12', 13: 'Pad 13', 14: 'Pad 14', 15: 'Pad 15'
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .sequencer-container {
          background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
          border-radius: 12px;
          border: 1px solid #2a2a2a;
          padding: 20px;
          overflow-x: auto;
        }

        .sequencer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #222;
        }

        .header-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-controls {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 6px 12px;
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          color: #fff;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn:hover {
          border-color: #00d4ff;
        }

        .btn.active {
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          color: #000;
        }

        .btn-save {
          background: linear-gradient(180deg, #00cc66, #009944);
          border-color: #00cc66;
          color: #fff;
        }

        .btn-save:hover {
          background: linear-gradient(180deg, #00dd77, #00cc66);
        }

        .preset-select {
          padding: 6px 12px;
          background: #1a1a1a;
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          color: #fff;
          font-size: 0.75rem;
          cursor: pointer;
          min-width: 150px;
        }

        .preset-select:focus {
          outline: none;
          border-color: #00d4ff;
        }

        /* Step numbers row */
        .step-numbers {
          display: flex;
          margin-left: 80px;
          margin-bottom: 5px;
        }

        .step-number {
          width: 38px;
          text-align: center;
          font-size: 0.75rem;
          color: #444;
          font-family: monospace;
        }

        .step-number.beat {
          color: #666;
          font-weight: 600;
        }

        .step-number:nth-child(4n+1) {
          color: #888;
        }

        /* Grid */
        .sequencer-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sequencer-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .row-label {
          width: 90px;
          font-size: 0.75rem;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex-shrink: 0;
          font-weight: 600;
        }

        .sequencer-row.disabled {
          opacity: 0.3;
          pointer-events: none;
          filter: grayscale(100%);
        }

        .sequencer-row.disabled .row-label {
           color: #444;
        }

        .steps-container {
          display: flex;
          gap: 2px;
        }

        /* Individual step button */
        .step {
          width: 36px;
          height: 36px;
          background: linear-gradient(180deg, #1a1a1a, #0d0d0d);
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.1s ease;
          position: relative;
        }

        /* Beat markers (every 4th step) */
        .step:nth-child(4n+1) {
          margin-left: 10px;
        }

        .step:first-child {
          margin-left: 0;
        }

        .step:hover {
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border-color: #3a3a3a;
        }

        .step.active {
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-color: #00d4ff;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
        }

        .step.current {
          box-shadow: 0 0 0 2px #ff6b35;
        }

        .step.active.current {
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.4), 0 0 0 2px #ff6b35;
        }

        /* Velocity indicator */
        .step.active::after {
          content: '';
          position: absolute;
          inset: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }

        /* Page selector */
        .page-selector {
          display: flex;
          gap: 4px;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px solid #222;
        }

        .page-btn {
          padding: 4px 8px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          color: #666;
          font-size: 0.625rem;
          cursor: pointer;
          transition: all 0.1s;
        }

        .page-btn:hover {
          border-color: #00d4ff;
          color: #00d4ff;
        }

        .page-btn.active {
          background: #00d4ff;
          border-color: #00d4ff;
          color: #000;
        }
      </style>

      <div class="sequencer-container">
        <div class="sequencer-header">
          <span class="header-title">Step Sequencer</span>
          <div class="header-controls">
            <select class="preset-select" id="preset-select">
              <option value="">-- Charger Preset --</option>
              ${this._savedPresets.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
            </select>
            <button class="btn btn-save" id="btn-save">💾 Sauvegarder</button>
            <button class="btn" id="btn-clear">🗑️ Clear</button>
          </div>
        </div>

        <!-- Step numbers -->
        <div class="step-numbers">
          ${Array(16).fill(0).map((_, i) => `
            <span class="step-number ${i % 4 === 0 ? 'beat' : ''}">${i + 1}</span>
          `).join('')}
        </div>

        <!-- Sequencer grid -->
        <div class="sequencer-grid" id="grid">
          ${this._visiblePads.map(padIndex => this._renderRow(padIndex, padLabels[padIndex])).join('')}
        </div>

        <!-- Page selector -->
        <div class="page-selector">
          <button class="page-btn active" data-page="0">Pads 0-7</button>
          <button class="page-btn" data-page="1">Pads 8-15</button>
        </div>
      </div>
    `;

    this._setupEventListeners();
  }

  _renderRow(padIndex, label) {
    const sequence = this._sequences.get(padIndex) || Array(16).fill(false);

    // Check if pad is loaded (enabled)
    // Default to enabled if no status set yet (backward compatibility), or use strict checking?
    // User requested "mute empty pads".
    const status = this._padStatuses.get(padIndex);
    const isLoaded = status ? status.loaded : false;

    // Use the dynamic label if available
    const displayLabel = status?.label || label || `Pad ${padIndex}`;

    return `
      <div class="sequencer-row ${isLoaded ? '' : 'disabled'}" data-pad="${padIndex}">
        <span class="row-label">${displayLabel}</span>
        <div class="steps-container">
          ${sequence.map((active, stepIndex) => `
            <button class="step ${active ? 'active' : ''} ${this._currentStep === stepIndex ? 'current' : ''}"
                    data-pad="${padIndex}"
                    data-step="${stepIndex}"
                    ${isLoaded ? '' : 'disabled'}>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  _setupEventListeners() {
    // Step click
    this.shadowRoot.querySelectorAll('.step').forEach(step => {
      step.addEventListener('click', (e) => {
        const padIndex = parseInt(e.target.dataset.pad);
        const stepIndex = parseInt(e.target.dataset.step);
        this._toggleStep(padIndex, stepIndex);
      });
    });

    // Clear button
    this.shadowRoot.getElementById('btn-clear')?.addEventListener('click', () => {
      this._clearAll();
    });

    // Page selector
    this.shadowRoot.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        this._switchPage(page);
      });
    });

    // Save button
    this.shadowRoot.getElementById('btn-save')?.addEventListener('click', () => {
      this._saveCurrentPreset();
    });

    // Load select
    this.shadowRoot.getElementById('preset-select')?.addEventListener('change', (e) => {
      const index = e.target.value;
      if (index !== '') {
        this._loadPreset(parseInt(index));
        e.target.value = '';  // Reset dropdown
      }
    });
  }

  _toggleStep(padIndex, stepIndex) {
    let sequence = this._sequences.get(padIndex) || Array(16).fill(false);
    sequence[stepIndex] = !sequence[stepIndex];
    this._sequences.set(padIndex, sequence);

    // Update UI
    const step = this.shadowRoot.querySelector(`.step[data-pad="${padIndex}"][data-step="${stepIndex}"]`);
    if (step) {
      step.classList.toggle('active', sequence[stepIndex]);
    }

    // Emit events
    this.dispatchEvent(new CustomEvent('step-toggle', {
      bubbles: true,
      composed: true,
      detail: { padIndex, stepIndex, active: sequence[stepIndex] }
    }));

    this.dispatchEvent(new CustomEvent('sequence-change', {
      bubbles: true,
      composed: true,
      detail: { padIndex, sequence: [...sequence] }
    }));
  }

  _clearAll() {
    this._sequences.clear();
    this.shadowRoot.querySelectorAll('.step').forEach(step => {
      step.classList.remove('active');
    });

    this.dispatchEvent(new CustomEvent('sequences-cleared', {
      bubbles: true,
      composed: true
    }));
  }

  _switchPage(page) {
    if (page === 0) {
      this._visiblePads = [0, 1, 2, 3, 4, 5, 6, 7];
    } else {
      this._visiblePads = [8, 9, 10, 11, 12, 13, 14, 15];
    }

    // Update active button
    this.shadowRoot.querySelectorAll('.page-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.page) === page);
    });

    this.render();
  }

  /**
   * Set the current playing step (for visual feedback)
   * @param {number} step - Step index (0-15), or -1 to clear
   */
  setCurrentStep(step) {
    this._currentStep = step;

    // Update UI
    this.shadowRoot.querySelectorAll('.step').forEach(stepEl => {
      const stepIndex = parseInt(stepEl.dataset.step);
      stepEl.classList.toggle('current', stepIndex === step);
    });
  }

  /**
   * Set sequences from preset data
   * @param {Array} samples - Array of sample objects with sequence data
   */
  setSequences(samples) {
    this._sequences.clear();

    if (samples) {
      samples.forEach(sample => {
        if (sample.sequence) {
          this._sequences.set(sample.padIndex, [...sample.sequence]);
        }
      });
    }

    this.render();
  }

  /**
   * Get all sequences
   * @returns {Map<number, boolean[]>}
   */
  getSequences() {
    return new Map(this._sequences);
  }

  /**
   * Update a single pad's label
   */
  updatePadLabel(padIndex, label) {
    const row = this.shadowRoot.querySelector(`.sequencer-row[data-pad="${padIndex}"] .row-label`);
    if (row) {
      row.textContent = label;
    }
  }

  /**
   * Set pad loaded status
   * @param {number} padIndex
   * @param {boolean} isLoaded
   * @param {string} label
   */
  setPadStatus(padIndex, isLoaded, label) {
    this._padStatuses.set(padIndex, { loaded: isLoaded, label });
    this.render();
  }

  // ============================================
  // PRESET SAVE/LOAD (localStorage)
  // ============================================

  /**
   * Load saved presets from Backend
   */
  async _loadSavedPresetsFromStorage() {
    try {
      const res = await fetch(`${API_URL}/api/sequencer-presets`);
      const data = await res.json();
      if (data.success) {
        this._savedPresets = data.data;
      }
    } catch (e) {
      console.warn('Failed to load sequencer presets:', e);
      this._savedPresets = [];
    }
    // Render initially to populate dropdown
    this.render();
  }

  /**
   * Save current sequence as a new preset
   */
  async _saveCurrentPreset() {
    const name = prompt('Nom du preset :', `Pattern ${this._savedPresets.length + 1}`);
    if (!name) return;

    // Convert Map to array of objects { padIndex, steps }
    const sequences = [];
    this._sequences.forEach((steps, padIndex) => {
      sequences.push({ padIndex, steps });
    });

    // Save to Backend
    try {
      const baseUrl = API_URL;
      const res = await fetch(`${baseUrl}/api/sequencer-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sequences,
          bpm: 120 // TODO: Get actual BPM
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Preset sauvegardé !');
        this._loadSavedPresetsFromStorage(); // Refresh list
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (e) {
      console.error('Failed to save preset:', e);
      alert('Erreur lors de la sauvegarde');
    }
  }

  /**
   * Load a preset by index (from _savedPresets array)
   */
  _loadPreset(index) {
    const preset = this._savedPresets[index];
    if (!preset) return;

    // Deserialize
    this._sequences.clear();
    if (preset.sequences) {
      preset.sequences.forEach(item => {
        // item is { padIndex, steps }
        this._sequences.set(item.padIndex, item.steps);
      });
    }

    // Emit events to sync with AudioEngine
    this._sequences.forEach((sequence, padIndex) => {
      this.dispatchEvent(new CustomEvent('sequence-change', {
        bubbles: true,
        composed: true,
        detail: { padIndex, sequence: [...sequence] }
      }));
    });

    // Re-render grid
    this.render();
  }
}

customElements.define('step-sequencer', StepSequencer);

export default StepSequencer;
