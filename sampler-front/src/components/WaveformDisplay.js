/**
 * <waveform-display> Web Component
 * 
 * Affiche la forme d'onde d'un AudioBuffer avec :
 * - Stratégie "Double Layer" : Canvas statique + Canvas animé
 * - Trim bar interactive (zone grisée pour les parties non jouées)
 * - Playhead animé en temps réel
 */

class WaveformDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._buffer = null;
    this._sampleLabel = '';
    this._playheadPosition = 0;  // 0 to 1
    this._isPlaying = false;
    this._animationId = null;

    // Trim state (0 to 1)
    this._trimStart = 0;
    this._trimEnd = 1;
    this._isDragging = false;
    this._dragHandle = null; // 'start', 'end', or null
    this._dragStartX = 0;

    // Bind methods
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this._stopAnimation();
    this._removeEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .waveform-wrapper {
          position: relative;
        }

        .waveform-container {
          position: relative;
          width: 100%;
          height: 100px;
          background: linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%);
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          overflow: hidden;
        }

        /* Background canvas (static waveform) */
        canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        #canvas-bg {
          z-index: 1;
        }

        #canvas-fg {
          z-index: 2;
          pointer-events: none;
        }

        /* Trim handles - positioned outside canvas for better clickability */
        .trim-handle {
          position: absolute;
          top: 0;
          width: 12px;
          height: 100%;
          cursor: ew-resize;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .trim-handle::before {
          content: '';
          width: 4px;
          height: 100%;
          background: linear-gradient(180deg, #00d4ff, #0088aa);
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
        }

        .trim-handle:hover::before {
          background: linear-gradient(180deg, #00e5ff, #00d4ff);
          box-shadow: 0 0 12px rgba(0, 212, 255, 0.8);
        }

        .trim-handle.dragging::before {
          background: #fff;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
        }

        .trim-handle-start {
          transform: translateX(-6px);
        }

        .trim-handle-end {
          transform: translateX(-6px);
        }

        /* Placeholder */
        .placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #444;
          font-size: 0.75rem;
          z-index: 5;
          pointer-events: none;
        }

        .placeholder-icon {
          font-size: 1.5rem;
          margin-bottom: 0.25rem;
          opacity: 0.5;
        }

        /* Info bar */
        .info-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
          font-size: 0.6875rem;
          color: #666;
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          border-top: none;
          border-radius: 0 0 8px 8px;
        }

        .time-display {
          font-family: 'SF Mono', 'Monaco', monospace;
          min-width: 60px;
        }

        .time-current {
          color: #ff6b35;
        }

        .sample-name {
          color: #00d4ff;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .time-total {
          text-align: right;
        }

        /* Trim values display */
        .trim-values {
          display: flex;
          justify-content: space-between;
          padding: 4px 10px;
          font-size: 0.625rem;
          color: #555;
          font-family: monospace;
        }
      </style>

      <div class="waveform-wrapper">
        <div class="waveform-container" id="container">
          <canvas id="canvas-bg"></canvas>
          <canvas id="canvas-fg"></canvas>
          ${!this._buffer ? `
            <div class="placeholder">
              <span class="placeholder-icon">🎵</span>
              <span>Click a pad to view waveform</span>
            </div>
          ` : ''}
          <div class="trim-handle trim-handle-start" id="handle-start"></div>
          <div class="trim-handle trim-handle-end" id="handle-end"></div>
        </div>
        <div class="info-bar">
          <span class="time-display time-current" id="time-current">0:00.00</span>
          <span class="sample-name" id="sample-name">${this._sampleLabel || '—'}</span>
          <span class="time-display time-total" id="time-total">0:00.00</span>
        </div>
        <div class="trim-values">
          <span>Trim: <span id="trim-start-val">${(this._trimStart * 100).toFixed(0)}%</span></span>
          <span>→ <span id="trim-end-val">${(this._trimEnd * 100).toFixed(0)}%</span></span>
        </div>
      </div>
    `;

    // Position handles after render
    requestAnimationFrame(() => {
      this._updateHandlePositions();
      if (this._buffer) {
        this._drawWaveform();
      }
      this._addEventListeners();
    });
  }

  _addEventListeners() {
    const handleStart = this.shadowRoot.getElementById('handle-start');
    const handleEnd = this.shadowRoot.getElementById('handle-end');

    handleStart?.addEventListener('mousedown', (e) => this._onMouseDown(e, 'start'));
    handleEnd?.addEventListener('mousedown', (e) => this._onMouseDown(e, 'end'));

    // Touch support
    handleStart?.addEventListener('touchstart', (e) => this._onTouchStart(e, 'start'), { passive: false });
    handleEnd?.addEventListener('touchstart', (e) => this._onTouchStart(e, 'end'), { passive: false });

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('touchmove', this._onMouseMove, { passive: false });
    document.addEventListener('touchend', this._onMouseUp);
  }

  _removeEventListeners() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('touchmove', this._onMouseMove);
    document.removeEventListener('touchend', this._onMouseUp);
  }

  _onMouseDown(e, handle) {
    e.preventDefault();
    e.stopPropagation();
    this._isDragging = true;
    this._dragHandle = handle;
    this._dragStartX = e.clientX;

    const handleEl = this.shadowRoot.getElementById(`handle-${handle}`);
    handleEl?.classList.add('dragging');
  }

  _onTouchStart(e, handle) {
    e.preventDefault();
    this._isDragging = true;
    this._dragHandle = handle;
    this._dragStartX = e.touches[0].clientX;

    const handleEl = this.shadowRoot.getElementById(`handle-${handle}`);
    handleEl?.classList.add('dragging');
  }

  _onMouseMove(e) {
    if (!this._isDragging || !this._dragHandle) return;

    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const container = this.shadowRoot.getElementById('container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let position = (clientX - rect.left) / rect.width;
    position = Math.max(0, Math.min(1, position));

    if (this._dragHandle === 'start') {
      // Start cannot go past end - 5%
      this._trimStart = Math.min(position, this._trimEnd - 0.05);
      this._trimStart = Math.max(0, this._trimStart);
    } else if (this._dragHandle === 'end') {
      // End cannot go before start + 5%
      this._trimEnd = Math.max(position, this._trimStart + 0.05);
      this._trimEnd = Math.min(1, this._trimEnd);
    }

    this._updateHandlePositions();
    this._drawOverlay();
    this._updateTrimDisplay();
    this._emitTrimChange();
  }

  _onMouseUp() {
    if (this._isDragging) {
      const handleEl = this.shadowRoot.getElementById(`handle-${this._dragHandle}`);
      handleEl?.classList.remove('dragging');
    }
    this._isDragging = false;
    this._dragHandle = null;
  }

  _updateHandlePositions() {
    const container = this.shadowRoot.getElementById('container');
    const handleStart = this.shadowRoot.getElementById('handle-start');
    const handleEnd = this.shadowRoot.getElementById('handle-end');

    if (!container || !handleStart || !handleEnd) return;

    const width = container.offsetWidth;

    handleStart.style.left = `${this._trimStart * width}px`;
    handleEnd.style.left = `${this._trimEnd * width}px`;
  }

  _updateTrimDisplay() {
    const startVal = this.shadowRoot.getElementById('trim-start-val');
    const endVal = this.shadowRoot.getElementById('trim-end-val');

    if (startVal) startVal.textContent = `${(this._trimStart * 100).toFixed(0)}%`;
    if (endVal) endVal.textContent = `${(this._trimEnd * 100).toFixed(0)}%`;
  }

  _emitTrimChange() {
    this.dispatchEvent(new CustomEvent('trim-change', {
      bubbles: true,
      composed: true,
      detail: {
        trimStart: this._trimStart,
        trimEnd: this._trimEnd,
        // Also provide time values if buffer exists
        startTime: this._buffer ? this._trimStart * this._buffer.duration : 0,
        endTime: this._buffer ? this._trimEnd * this._buffer.duration : 0
      }
    }));
  }

  /**
   * Set the audio buffer to display
   */
  setBuffer(buffer, label = '', config = null) {
    this._buffer = buffer;
    this._sampleLabel = label;

    // Initialize trim from config if available, otherwise default to full
    if (config && config.trim) {
      this._trimStart = typeof config.trim.start === 'number' ? config.trim.start : 0;
      this._trimEnd = typeof config.trim.end === 'number' && config.trim.end !== 0 ? config.trim.end : 1;
    } else if (config) {
      // Fallback for legacy flat props
      this._trimStart = typeof config.trimStart === 'number' ? config.trimStart : 0;
      this._trimEnd = typeof config.trimEnd === 'number' && config.trimEnd !== 0 ? config.trimEnd : 1;
    } else {
      this._trimStart = 0;
      this._trimEnd = 1;
    }

    this._playheadPosition = 0;

    this.render();

    if (buffer) {
      requestAnimationFrame(() => {
        this._drawWaveform();
        const totalEl = this.shadowRoot.getElementById('time-total');
        if (totalEl) {
          totalEl.textContent = this._formatTime(buffer.duration);
        }
      });
    }
  }

  /**
   * Draw the static waveform on background canvas
   */
  _drawWaveform() {
    const canvas = this.shadowRoot.getElementById('canvas-bg');
    const container = this.shadowRoot.getElementById('container');
    if (!canvas || !container || !this._buffer) return;

    const ctx = canvas.getContext('2d');
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const data = this._buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, height);

    // Center line
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();

    // Waveform with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#00d4ff');
    gradient.addColorStop(0.5, '#006688');
    gradient.addColorStop(1, '#00d4ff');
    ctx.fillStyle = gradient;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum !== undefined) {
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }

      const y1 = (1 + min) * amp;
      const y2 = (1 + max) * amp;

      ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }

    // Draw initial overlay
    this._drawOverlay();
  }

  /**
   * Draw the overlay (trim zones + playhead) on foreground canvas
   */
  _drawOverlay() {
    const canvas = this.shadowRoot.getElementById('canvas-fg');
    const container = this.shadowRoot.getElementById('container');
    if (!canvas || !container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw trim zones (grayed out areas)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';

    // Left trim zone
    if (this._trimStart > 0) {
      ctx.fillRect(0, 0, this._trimStart * width, height);
    }

    // Right trim zone
    if (this._trimEnd < 1) {
      ctx.fillRect(this._trimEnd * width, 0, (1 - this._trimEnd) * width, height);
    }

    // Draw playhead (show even at position 0)
    if (this._playheadPosition >= 0 && this._buffer) {
      const x = this._playheadPosition * width;

      // Playhead glow
      const glowGradient = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
      glowGradient.addColorStop(0, 'rgba(255, 107, 53, 0)');
      glowGradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.3)');
      glowGradient.addColorStop(1, 'rgba(255, 107, 53, 0)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(x - 10, 0, 20, height);

      // Playhead line
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Playhead top marker
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 6);
      ctx.closePath();
      ctx.fill();

      // Playhead bottom marker
      ctx.beginPath();
      ctx.moveTo(x - 5, height);
      ctx.lineTo(x + 5, height);
      ctx.lineTo(x, height - 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Update playhead position (0 to 1)
   */
  setPlayheadPosition(position) {
    this._playheadPosition = Math.max(0, Math.min(1, position));
    this._drawOverlay();

    // Update time display
    if (this._buffer) {
      const currentTime = this._playheadPosition * this._buffer.duration;
      const timeEl = this.shadowRoot.getElementById('time-current');
      if (timeEl) {
        timeEl.textContent = this._formatTime(currentTime);
      }
    }
  }

  /**
   * Start playhead animation from AudioEngine events
   */
  startPlayback(duration) {
    this._isPlaying = true;
    const startTime = performance.now();
    const startPosition = this._trimStart;
    const endPosition = this._trimEnd;
    const playDuration = duration * 1000; // Convert to ms

    const animatePlayhead = () => {
      if (!this._isPlaying) return;

      const elapsed = performance.now() - startTime;
      const progress = elapsed / playDuration;

      if (progress >= 1) {
        this.setPlayheadPosition(endPosition);
        this._isPlaying = false;
        return;
      }

      const position = startPosition + (endPosition - startPosition) * progress;
      this.setPlayheadPosition(position);

      this._animationId = requestAnimationFrame(animatePlayhead);
    };

    animatePlayhead();
  }

  /**
   * Stop playhead animation
   */
  stopPlayback() {
    this._isPlaying = false;
    this._stopAnimation();
  }

  _stopAnimation() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * Get current trim values
   */
  getTrimValues() {
    return {
      start: this._trimStart,
      end: this._trimEnd
    };
  }

  /**
   * Set trim values programmatically
   */
  setTrimValues(start, end) {
    this._trimStart = Math.max(0, Math.min(1, start));
    this._trimEnd = Math.max(0, Math.min(1, end));
    this._updateHandlePositions();
    this._updateTrimDisplay();
    this._drawOverlay();
  }

  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
}

customElements.define('waveform-display', WaveformDisplay);

export default WaveformDisplay;
