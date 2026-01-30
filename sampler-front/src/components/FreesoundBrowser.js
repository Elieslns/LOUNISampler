import { API_URL } from '../config/api-config.js';

/**
 * <freesound-browser> Web Component
 * @author Elies LOUNIS
 */
class FreesoundBrowser extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._searchQuery = '';
    this._results = [];
    this._isLoading = false;
    this._selectedSound = null;
    this._selectedPadIndex = null;
    this._previewAudio = null;
    this._currentlyPlaying = null;

    // API base URL
    this._apiBaseUrl = `${API_URL}/api`;
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

        .browser-container {
          background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          padding: 15px;
        }

        .browser-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .browser-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .freesound-logo {
          font-size: 1rem;
        }

        /* Search */
        .search-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .search-input {
          flex: 1;
          padding: 10px 12px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          font-size: 0.875rem;
        }

        .search-input:focus {
          outline: none;
          border-color: #00d4ff;
        }

        .search-input::placeholder {
          color: #555;
        }

        .btn {
          padding: 10px 16px;
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn:hover {
          border-color: #00d4ff;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-search {
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-color: #00d4ff;
          color: #000;
        }

        /* Results */
        .results-container {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 12px;
        }

        .results-empty {
          text-align: center;
          padding: 20px;
          color: #444;
          font-size: 0.75rem;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #00d4ff;
          font-size: 0.75rem;
        }

        .loading::after {
          content: '...';
          animation: dots 1s infinite;
        }

        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }

        /* Result item */
        .result-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: linear-gradient(180deg, #1a1a1a, #0d0d0d);
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: all 0.1s;
        }

        .result-item:hover {
          border-color: #3a3a3a;
        }

        .result-item.selected {
          border-color: #00d4ff;
          background: linear-gradient(180deg, rgba(0, 212, 255, 0.1), rgba(0, 212, 255, 0.05));
        }

        .result-play {
          width: 32px;
          height: 32px;
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #3a3a3a;
          border-radius: 50%;
          color: #00d4ff;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s;
          flex-shrink: 0;
        }

        .result-play:hover {
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-color: #00d4ff;
          color: #000;
        }

        .result-play.playing {
          background: linear-gradient(180deg, #ff6b35, #cc4400);
          border-color: #ff6b35;
          color: #fff;
        }

        .result-info {
          flex: 1;
          min-width: 0;
        }

        .result-name {
          font-size: 0.75rem;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .result-meta {
          font-size: 0.625rem;
          color: #555;
          margin-top: 2px;
        }

        .result-duration {
          color: #888;
        }

        /* Selected pad info */
        .pad-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(0, 212, 255, 0.05);
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .pad-info-label {
          font-size: 0.6875rem;
          color: #666;
        }

        .pad-info-value {
          font-size: 0.75rem;
          color: #00d4ff;
          font-weight: 600;
        }

        .no-pad {
          color: #ff4444;
        }

        /* Assign button */
        .btn-assign {
          width: 100%;
          background: linear-gradient(180deg, #00d4ff, #0099cc);
          border-color: #00d4ff;
          color: #000;
          padding: 12px;
        }

        .btn-assign:hover {
          background: linear-gradient(180deg, #00e5ff, #00d4ff);
        }

        .btn-save {
          background: linear-gradient(180deg, #00cc66, #009944);
          border-color: #00cc66;
          color: #fff;
          padding: 12px;
          margin-top: 8px;
        }

        .btn-save:hover {
          background: linear-gradient(180deg, #00dd77, #00cc66);
        }

        .btn-row {
          display: flex;
          gap: 8px;
        }

        .btn-row .btn {
          flex: 1;
        }

        /* Attribution */
        .attribution {
          text-align: center;
          font-size: 0.5rem;
          color: #444;
          margin-top: 10px;
        }

        .attribution a {
          color: #555;
        }
      </style>

      <div class="browser-container">
        <div class="browser-header">
          <span class="freesound-logo">🔊</span>
          <span class="browser-title">Freesound Browser</span>
        </div>

        <!-- Search -->
        <div class="search-row">
          <input type="text" class="search-input" id="search-input" 
                 placeholder="Search sounds..." 
                 value="${this._searchQuery}">
          <button class="btn btn-search" id="btn-search" ${this._isLoading ? 'disabled' : ''}>
            🔍
          </button>
        </div>

        <!-- Selected Pad -->
        <div class="pad-info">
          <span class="pad-info-label">Target Pad</span>
          <span class="pad-info-value ${this._selectedPadIndex === null ? 'no-pad' : ''}" id="target-pad">
            ${this._selectedPadIndex !== null ? `PAD ${this._selectedPadIndex}` : 'Click a pad first'}
          </span>
        </div>

        <!-- Results -->
        <div class="results-container" id="results">
          ${this._isLoading ? `
            <div class="loading">Searching</div>
          ` : this._results.length === 0 ? `
            <div class="results-empty">
              ${this._searchQuery ? 'No results found' : 'Search for sounds on Freesound'}
            </div>
          ` : this._results.map(sound => `
            <div class="result-item ${this._selectedSound?.id === sound.id ? 'selected' : ''}" 
                 data-id="${sound.id}">
              <button class="result-play ${this._currentlyPlaying === sound.id ? 'playing' : ''}" 
                       data-preview="${sound.previews?.mp3 || sound.previews?.lq_mp3 || sound.previews?.['preview-hq-mp3'] || ''}"
                      data-id="${sound.id}">
                ${this._currentlyPlaying === sound.id ? '■' : '▶'}
              </button>
              <div class="result-info">
                <div class="result-name">${sound.name}</div>
                <div class="result-meta">
                  <span class="result-duration">${sound.duration?.toFixed(1) || '?'}s</span>
                  · ${sound.username || 'Unknown'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Action Buttons -->
        <div class="btn-row">
          <button class="btn btn-assign" id="btn-assign" 
                  ${!this._selectedSound || this._selectedPadIndex === null ? 'disabled' : ''}>
            📥 Assign to Pad
          </button>
          <button class="btn btn-save" id="btn-save" 
                  ${!this._selectedSound ? 'disabled' : ''}>
            💾 Save to Library
          </button>
        </div>

        <div class="attribution">
          Powered by <a href="https://freesound.org" target="_blank">Freesound.org</a>
        </div>
      </div>
    `;
  }

  _setupEventListeners() {
    // Search input
    const searchInput = this.shadowRoot.getElementById('search-input');
    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this._search();
      }
    });

    // Search button
    this.shadowRoot.getElementById('btn-search')?.addEventListener('click', () => {
      this._search();
    });

    // Results - play and select
    this.shadowRoot.getElementById('results')?.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.result-play');
      const resultItem = e.target.closest('.result-item');

      if (playBtn) {
        e.stopPropagation();
        this._togglePreview(playBtn.dataset.id, playBtn.dataset.preview);
      } else if (resultItem) {
        this._selectSound(parseInt(resultItem.dataset.id));
      }
    });

    // Assign button
    this.shadowRoot.getElementById('btn-assign')?.addEventListener('click', () => {
      this._assignToPad();
    });

    // Save to Library button
    this.shadowRoot.getElementById('btn-save')?.addEventListener('click', () => {
      this._saveToLibrary();
    });
  }

  async _search() {
    const input = this.shadowRoot.getElementById('search-input');
    this._searchQuery = input?.value?.trim() || '';

    if (!this._searchQuery) return;

    this._isLoading = true;
    this._results = [];
    this._selectedSound = null;
    this.render();
    this._setupEventListeners();

    try {
      const baseUrl = API_URL;
      const response = await fetch(`${baseUrl}/api/freesound/search?query=${encodeURIComponent(this._searchQuery)}`);
      const data = await response.json();
      console.log('Freesound API response:', data);

      // Backend returns { success, data: [...] } where data is the array of results
      if (data.success && Array.isArray(data.data)) {
        this._results = data.data.slice(0, 15); // Limit to 15 results
      } else {
        this._results = [];
      }
    } catch (error) {
      console.error('Freesound search failed:', error);
      this._results = [];
    }

    this._isLoading = false;
    this.render();
    this._setupEventListeners();
  }

  _togglePreview(soundId, previewUrl) {
    soundId = parseInt(soundId);

    if (this._currentlyPlaying === soundId) {
      // Stop
      this._previewAudio?.pause();
      this._previewAudio = null;
      this._currentlyPlaying = null;
    } else {
      // Stop previous
      this._previewAudio?.pause();

      // Play new
      if (previewUrl) {
        this._previewAudio = new Audio(previewUrl);
        this._previewAudio.play().catch(console.error);
        this._previewAudio.onended = () => {
          this._currentlyPlaying = null;
          this.render();
          this._setupEventListeners();
        };
        this._currentlyPlaying = soundId;
      }
    }

    this.render();
    this._setupEventListeners();
  }

  _selectSound(soundId) {
    this._selectedSound = this._results.find(s => s.id === soundId) || null;
    this.render();
    this._setupEventListeners();

    this.dispatchEvent(new CustomEvent('sound-selected', {
      bubbles: true,
      composed: true,
      detail: this._selectedSound
    }));
  }

  async _assignToPad() {
    if (!this._selectedSound || this._selectedPadIndex === null) return;

    // Backend returns { mp3, ogg, lq_mp3, lq_ogg } - use those keys
    const previewUrl = this._selectedSound.previews?.mp3 ||
      this._selectedSound.previews?.lq_mp3 ||
      this._selectedSound.previews?.['preview-hq-mp3'] ||  // Fallback for raw API
      this._selectedSound.previews?.['preview-lq-mp3'];

    if (!previewUrl) {
      console.error('No preview URL available for this sound', this._selectedSound.previews);
      return;
    }

    this.dispatchEvent(new CustomEvent('assign-to-pad', {
      bubbles: true,
      composed: true,
      detail: {
        padIndex: this._selectedPadIndex,
        soundId: this._selectedSound.id,
        name: this._selectedSound.name,
        url: previewUrl,
        username: this._selectedSound.username,
        duration: this._selectedSound.duration
      }
    }));

    // Reset selection
    this._selectedSound = null;
    this.render();
    this._setupEventListeners();
  }

  /**
   * Set the target pad index (called from parent)
   */
  setTargetPad(padIndex) {
    this._selectedPadIndex = padIndex;
    const padInfo = this.shadowRoot.getElementById('target-pad');
    if (padInfo) {
      padInfo.textContent = `PAD ${padIndex}`;
      padInfo.classList.remove('no-pad');
    }

    // Update assign button
    const assignBtn = this.shadowRoot.getElementById('btn-assign');
    if (assignBtn && this._selectedSound) {
      assignBtn.disabled = false;
    }
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this._selectedPadIndex = null;
    this._selectedSound = null;
    this._previewAudio?.pause();
    this._previewAudio = null;
    this._currentlyPlaying = null;
    this.render();
    this._setupEventListeners();
  }

  /**
   * Save selected sound to library
   */
  async _saveToLibrary() {
    if (!this._selectedSound) return;

    const previewUrl = this._selectedSound.previews?.mp3 ||
      this._selectedSound.previews?.lq_mp3 ||
      this._selectedSound.previews?.['preview-hq-mp3'];

    if (!previewUrl) {
      alert('No preview URL available for this sound');
      return;
    }

    const category = prompt('Category for this sample:', 'freesound');
    if (!category) return;

    try {
      // Use /api/samples/url endpoint for external URLs
      const response = await fetch(`${this._apiBaseUrl}/samples/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this._selectedSound.name, // Backend expects 'name', not 'label'
          category: category || 'Other',  // Ensure valid category or fallback
          url: previewUrl,
          duration: this._selectedSound.duration
        })
      });

      if (response.ok) {
        alert(`✅ "${this._selectedSound.name}" saved to library!`);
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.error || 'Failed to save'}`);
      }
    } catch (error) {
      console.error('Save to library failed:', error);
      alert('❌ Failed to save to library');
    }
  }
}

customElements.define('freesound-browser', FreesoundBrowser);

export default FreesoundBrowser;
