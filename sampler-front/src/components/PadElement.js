/**
 * <pad-element> Web Component
 * 
 * Représente un pad individuel du sampler (16 pads au total).
 * Style "Dark Mode Hardware" avec effet LED lumineux.
 * 
 * Attributs:
 *   - pad-id: Index du pad (0-15)
 *   - label: Nom affiché sur le pad
 *   - color: Couleur du pad (hex)
 *   - active: État actif (booléen)
 * 
 * Événements émis:
 *   - pad-triggered: { padId, velocity }
 *   - pad-file-drop: { padId, file }
 */

const PAD_COLORS = [
    '#ff6b6b', '#ffa06b', '#ffd56b', '#d5ff6b',
    '#6bff8e', '#6bffd5', '#6bd5ff', '#6b8eff',
    '#8e6bff', '#d56bff', '#ff6bd5', '#ff6b8e',
    '#ff8e6b', '#ffb86b', '#ffe06b', '#c4ff6b'
];

class PadElement extends HTMLElement {
    static get observedAttributes() {
        return ['pad-id', 'label', 'color', 'active', 'loaded'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._padId = 0;
        this._isPressed = false;
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    get padId() {
        return parseInt(this.getAttribute('pad-id')) || 0;
    }

    set padId(value) {
        this.setAttribute('pad-id', value);
    }

    get label() {
        return this.getAttribute('label') || `Pad ${this.padId}`;
    }

    set label(value) {
        this.setAttribute('label', value);
    }

    get color() {
        return this.getAttribute('color') || PAD_COLORS[this.padId % PAD_COLORS.length];
    }

    set color(value) {
        this.setAttribute('color', value);
    }

    get loaded() {
        return this.hasAttribute('loaded');
    }

    set loaded(value) {
        if (value) {
            this.setAttribute('loaded', '');
        } else {
            this.removeAttribute('loaded');
        }
    }

    render() {
        const color = this.color;

        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
        }

        .pad {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          background: linear-gradient(145deg, #1a1a1a, #0d0d0d);
          border: 2px solid #2a2a2a;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          overflow: hidden;
          transition: transform 0.05s ease, box-shadow 0.1s ease;
          box-shadow: 
            0 4px 8px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        /* LED indicator */
        .pad::before {
          content: '';
          position: absolute;
          top: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${this.loaded ? color : '#333'};
          box-shadow: ${this.loaded ? `0 0 8px ${color}` : 'none'};
          transition: all 0.15s ease;
        }

        /* Glow effect overlay */
        .pad::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, ${color}40, transparent 70%);
          opacity: 0;
          transition: opacity 0.1s ease;
          pointer-events: none;
        }

        .pad:hover {
          border-color: ${color}80;
        }

        .pad:hover::after {
          opacity: 0.3;
        }

        .pad.active {
          transform: scale(0.95);
          border-color: ${color};
          box-shadow: 
            0 0 20px ${color}60,
            inset 0 0 20px ${color}20;
        }

        .pad.active::after {
          opacity: 0.6;
        }

        .pad.active::before {
          background: ${color};
          box-shadow: 0 0 12px ${color};
        }

        .pad.dragover {
          border-color: #00ff88;
          border-style: dashed;
        }

        .pad-index {
          font-size: 1.5rem;
          font-weight: 700;
          color: ${color};
          text-shadow: 0 0 10px ${color}40;
          z-index: 1;
        }

        .pad-label {
          font-size: 0.625rem;
          color: #888;
          max-width: 90%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
          z-index: 1;
        }

        .pad.loaded .pad-label {
          color: #bbb;
        }

        /* Keyboard hint */
        .key-hint {
          position: absolute;
          bottom: 6px;
          left: 6px;
          font-size: 0.5rem;
          color: #444;
          font-family: monospace;
          text-transform: uppercase;
        }
        /* Progress Bar */
        .progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 4px;
          background: #00d4ff;
          width: 0%;
          z-index: 2;
          pointer-events: none;
        }

        .pad.active .progress-bar {
          /* Optional: change color when pressed */
        }
      </style>

      <div class="pad ${this.loaded ? 'loaded' : ''}" 
           role="button" 
           tabindex="0"
           aria-label="Pad ${this.padId}: ${this.label}">
        <div class="progress-bar"></div>
        <span class="pad-index">${this.padId}</span>
        <span class="pad-label">${this.label}</span>
        <span class="key-hint">${this.getKeyHint()}</span>
      </div>
    `;
        this.setupEventListeners();
    }

    /**
     * Start loading animation (indeterminate/slow fill)
     */
    startLoading() {
        const bar = this.shadowRoot.querySelector('.progress-bar');
        if (!bar) return;

        // Reset
        bar.style.transition = 'none';
        bar.style.width = '0%';
        bar.style.opacity = '1';
        bar.offsetHeight; // Force reflow

        // Animate slowly to 90%
        bar.style.transition = 'width 2s ease-out';
        bar.style.width = '90%';
    }

    /**
     * Finish loading animation (complete and fade out)
     */
    finishLoading() {
        const bar = this.shadowRoot.querySelector('.progress-bar');
        if (!bar) return;

        // Complete to 100% quickly
        bar.style.transition = 'width 0.2s ease-out';
        bar.style.width = '100%';

        // Fade out after completion
        setTimeout(() => {
            bar.style.transition = 'opacity 0.5s ease';
            bar.style.opacity = '0';
            // Reset width after fade
            setTimeout(() => { bar.style.width = '0%'; }, 500);
        }, 300);
    }

    /**
     * Start progress animation (linear duration)
     * @param {number} duration - Duration in seconds
     */
    startProgress(duration) {
        const bar = this.shadowRoot.querySelector('.progress-bar');
        if (!bar) return;

        // Reset
        bar.style.transition = 'none';
        bar.style.width = '0%';
        bar.style.opacity = '1'; // Ensure visible if it was faded out

        // Force reflow
        bar.offsetHeight;

        // Animate
        // Use linear transition
        bar.style.transition = `width ${duration}s linear`;
        bar.style.width = '100%';
    }

    /**
     * Stop progress animation
     */
    stopProgress() {
        const bar = this.shadowRoot.querySelector('.progress-bar');
        if (!bar) return;

        // Finish quickly and fade out (reuse logic if desired, or just reset)
        // User asked for "disappear alone".
        // Let's make stopProgress behave like finishLoading for consistency
        // or just reset immediately if it's a stop.
        // Given the requirement "disappear", fading out is better.

        bar.style.transition = 'opacity 0.2s ease';
        bar.style.opacity = '0';
        setTimeout(() => {
            bar.style.width = '0%';
            bar.style.transition = 'none';
        }, 200);
    }

    getKeyHint() {
        // AZERTY Mapping
        const keyMap = {
            0: 'W', 1: 'X', 2: 'C', 3: 'V',
            4: 'Q', 5: 'S', 6: 'D', 7: 'F',
            8: 'A', 9: 'Z', 10: 'E', 11: 'R',
            12: '&', 13: 'é', 14: '"', 15: "'"
        };
        return keyMap[this.padId] || '';
    }

    setupEventListeners() {
        const pad = this.shadowRoot.querySelector('.pad');
        if (!pad) return;

        // Mouse events
        pad.addEventListener('mousedown', (e) => this.handlePress(e));
        pad.addEventListener('mouseup', () => this.handleRelease());
        pad.addEventListener('mouseleave', () => this.handleRelease());

        // Touch events
        pad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePress(e);
        }, { passive: false });
        pad.addEventListener('touchend', () => this.handleRelease());
        pad.addEventListener('touchcancel', () => this.handleRelease());

        // Keyboard
        pad.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handlePress(e);
            }
        });
        pad.addEventListener('keyup', () => this.handleRelease());

        // Drag & Drop
        pad.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            pad.classList.add('dragover');
        });

        pad.addEventListener('dragleave', () => {
            pad.classList.remove('dragover');
        });

        pad.addEventListener('drop', (e) => {
            e.preventDefault();
            pad.classList.remove('dragover');
            this.handleFileDrop(e);
        });
    }

    handlePress(event) {
        if (this._isPressed) return;
        this._isPressed = true;

        const pad = this.shadowRoot.querySelector('.pad');
        pad.classList.add('active');

        // Emit event
        this.dispatchEvent(new CustomEvent('pad-triggered', {
            bubbles: true,
            composed: true,
            detail: {
                padId: this.padId,
                velocity: 1.0
            }
        }));
    }

    handleRelease() {
        if (!this._isPressed) return;
        this._isPressed = false;

        const pad = this.shadowRoot.querySelector('.pad');
        pad.classList.remove('active');
    }

    handleFileDrop(event) {
        // 1. Check for Internal Sample Drop (JSON)
        try {
            const jsonData = event.dataTransfer.getData('application/json');
            if (jsonData) {
                const data = JSON.parse(jsonData);
                if (data.type === 'sample' && data.url) {
                    this.dispatchEvent(new CustomEvent('assign-to-pad', {
                        bubbles: true,
                        composed: true,
                        detail: {
                            padIndex: this.padId,
                            url: data.url,
                            name: data.label
                        }
                    }));
                    return;
                }

                // Handle Slice Drag from Recorder
                if (data.type === 'slice-drag') {
                    this.dispatchEvent(new CustomEvent('slice-drop', {
                        bubbles: true,
                        composed: true,
                        detail: {
                            padIndex: this.padId,
                            sliceIndex: data.index,
                            sourceId: data.sourceId,
                            label: data.label
                        }
                    }));
                    return;
                }
            }
        } catch (e) { /* Ignore JSON parse errors */ }

        // 2. Check for File Drop
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/')) {
                this.dispatchEvent(new CustomEvent('pad-file-drop', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        padId: this.padId,
                        file: file
                    }
                }));
            }
        }
    }

    // Public method to trigger visual feedback from external sources (MIDI, keyboard)
    triggerVisual() {
        const pad = this.shadowRoot.querySelector('.pad');
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    }
}

customElements.define('pad-element', PadElement);

export default PadElement;
