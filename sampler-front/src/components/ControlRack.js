/**
 * <control-rack> Web Component
 * 
 * Panneau de contrôle pour éditer les paramètres du pad sélectionné :
 * - Volume (0-100%)
 * - Pitch / PlaybackRate (0.5x - 2x)
 * - Pan (Left - Right)
 * - Reverse toggle
 * 
 * Événements émis :
 *   - control-change: { padIndex, param, value }
 */

class ControlRack extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._padIndex = null;
    this._volume = 100;
    this._pitch = 1.0;
    this._pan = 0;
    this._reverse = false;
    this._label = '';
  }

  connectedCallback() {
    this.render();
    this._setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .rack-container {
          background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          padding: 15px;
        }

        .rack-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #222;
        }

        .rack-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pad-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pad-badge {
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          padding: 4px 10px;
          font-size: 0.75rem;
          color: #00d4ff;
          font-weight: 600;
        }

        .pad-label {
          font-size: 0.75rem;
          color: #888;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .no-selection {
          text-align: center;
          padding: 20px;
          color: #444;
          font-size: 0.75rem;
        }

        /* Control grid */
        .controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .control-group.full-width {
          grid-column: 1 / -1;
        }

        .control-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.625rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .control-value {
          font-family: 'SF Mono', monospace;
          color: #00d4ff;
          font-size: 0.6875rem;
        }

        /* Sliders */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          background: #1a1a1a;
          border-radius: 3px;
          outline: none;
          cursor: pointer;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 212, 255, 0.3);
          transition: transform 0.1s, box-shadow 0.1s;
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 10px rgba(0, 212, 255, 0.5);
        }

        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }

        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }

        /* Pan slider special styling */
        .pan-slider {
          background: linear-gradient(to right, 
            #1a1a1a 0%, 
            #1a1a1a 48%, 
            #333 48%, 
            #333 52%, 
            #1a1a1a 52%, 
            #1a1a1a 100%
          );
        }

        /* Toggle button */
        .toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          background: linear-gradient(180deg, #1a1a1a, #0d0d0d);
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #666;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:hover {
          border-color: #3a3a3a;
          color: #888;
        }

        .toggle-btn.active {
          background: linear-gradient(180deg, #ff6b35, #cc4400);
          border-color: #ff6b35;
          color: #fff;
          box-shadow: 0 0 10px rgba(255, 107, 53, 0.3);
        }

        .toggle-icon {
          font-size: 1rem;
        }

        /* Action buttons row */
        .actions-row {
          display: flex;
          gap: 8px;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #222;
        }

        .action-btn {
          flex: 1;
          padding: 8px 12px;
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          color: #888;
          font-size: 0.6875rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          border-color: #00d4ff;
          color: #00d4ff;
        }

        .action-btn.reset {
          color: #ff4444;
        }

        .action-btn.reset:hover {
          border-color: #ff4444;
        }

        .action-btn.stop {
          color: #ff6b35;
        }

        .action-btn.stop:hover {
          border-color: #ff6b35;
        }
      </style>

      <div class="rack-container">
        <div class="rack-header">
          <span class="rack-title">Pad Controls</span>
          ${this._padIndex !== null ? `
            <div class="pad-indicator">
              <span class="pad-badge">PAD ${this._padIndex}</span>
              <span class="pad-label">${this._label}</span>
            </div>
          ` : ''}
        </div>

        ${this._padIndex === null ? `
          <div class="no-selection">
            Click a pad to edit its parameters
          </div>
        ` : `
          <div class="controls-grid">
            <!-- Volume -->
            <div class="control-group">
              <div class="control-label">
                <span>Volume</span>
                <span class="control-value" id="vol-value">${this._volume}%</span>
              </div>
              <input type="range" id="volume-slider" 
                     min="0" max="100" value="${this._volume}">
            </div>

            <!-- Pitch -->
            <div class="control-group">
              <div class="control-label">
                <span>Pitch</span>
                <span class="control-value" id="pitch-value">${this._pitch.toFixed(2)}x</span>
              </div>
              <input type="range" id="pitch-slider" 
                     min="50" max="200" value="${this._pitch * 100}">
            </div>

            <!-- Pan -->
            <div class="control-group full-width">
              <div class="control-label">
                <span>L</span>
                <span>Pan</span>
                <span>R</span>
              </div>
              <input type="range" id="pan-slider" class="pan-slider"
                     min="-100" max="100" value="${this._pan * 100}">
            </div>

            <!-- Reverse Toggle -->
            <div class="control-group full-width" style="flex-direction: row; justify-content: center;">
              <button class="toggle-btn ${this._reverse ? 'active' : ''}" id="reverse-btn">
                <span>Reverse</span>
              </button>
            </div>
          </div>

          <div class="actions-row">
            <button class="action-btn reset" id="reset-btn">Reset to Default</button>
            <button class="action-btn" id="play-btn">Play</button>
            <button class="action-btn stop" id="stop-btn">Stop</button>
          </div>
        `}
      </div>
    `;
  }

  _setupEventListeners() {
    // Volume
    const volumeSlider = this.shadowRoot.getElementById('volume-slider');
    volumeSlider?.addEventListener('input', (e) => {
      this._volume = parseInt(e.target.value);
      this._updateDisplay('vol-value', `${this._volume}%`);
      this._emitChange('volume', this._volume / 100);
    });

    // Pitch
    const pitchSlider = this.shadowRoot.getElementById('pitch-slider');
    pitchSlider?.addEventListener('input', (e) => {
      this._pitch = parseInt(e.target.value) / 100;
      this._updateDisplay('pitch-value', `${this._pitch.toFixed(2)}x`);
      this._emitChange('pitch', this._pitch);
    });

    // Pan
    const panSlider = this.shadowRoot.getElementById('pan-slider');
    panSlider?.addEventListener('input', (e) => {
      this._pan = parseInt(e.target.value) / 100;
      this._emitChange('pan', this._pan);
    });

    // Reverse
    const reverseBtn = this.shadowRoot.getElementById('reverse-btn');
    reverseBtn?.addEventListener('click', () => {
      this._reverse = !this._reverse;
      reverseBtn.classList.toggle('active', this._reverse);
      this._emitChange('reverse', this._reverse);
    });

    // Reset
    const resetBtn = this.shadowRoot.getElementById('reset-btn');
    resetBtn?.addEventListener('click', () => {
      this._resetToDefault();
    });

    // Play
    const playBtn = this.shadowRoot.getElementById('play-btn');
    playBtn?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('play-pad', {
        bubbles: true,
        composed: true,
        detail: { padIndex: this._padIndex }
      }));
    });

    // Stop
    const stopBtn = this.shadowRoot.getElementById('stop-btn');
    stopBtn?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('stop-pad', {
        bubbles: true,
        composed: true,
        detail: { padIndex: this._padIndex }
      }));
    });
  }

  _updateDisplay(id, value) {
    const el = this.shadowRoot.getElementById(id);
    if (el) el.textContent = value;
  }

  _emitChange(param, value) {
    this.dispatchEvent(new CustomEvent('control-change', {
      bubbles: true,
      composed: true,
      detail: {
        padIndex: this._padIndex,
        param,
        value
      }
    }));
  }

  _resetToDefault() {
    this._volume = 100;
    this._pitch = 1.0;
    this._pan = 0;
    this._reverse = false;

    this.render();
    this._setupEventListeners();

    // Emit all reset values
    this._emitChange('volume', 1);
    this._emitChange('pitch', 1);
    this._emitChange('pan', 0);
    this._emitChange('reverse', false);
  }

  /**
   * Set the pad to edit
   */
  setPad(padIndex, sample = {}) {
    this._padIndex = padIndex;
    this._label = sample.label || `Pad ${padIndex}`;
    this._volume = (sample.volume || 1) * 100;
    this._pitch = sample.playbackRate || 1.0;
    this._pan = sample.pan || 0;
    this._reverse = sample.reverse || false;

    this.render();
    this._setupEventListeners();
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this._padIndex = null;
    this.render();
  }
}

customElements.define('control-rack', ControlRack);

export default ControlRack;
