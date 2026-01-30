/**
 * <sample-library> Web Component
 * 
 * Side panel component to browse and drag-and-drop independent samples.
 * Fetches data from /api/samples.
 */
export class SampleLibrary extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.samples = [];
        this.categories = ['All', 'Kick', 'Snare', 'HiHat', 'Percussion', 'Bass', 'Melodic', 'FX', 'Voice', 'Other'];
        this.currentCategory = 'All';
    }

    connectedCallback() {
        this.render();
        this.loadSamples();
        this.setupEventListeners();
    }

    async loadSamples() {
        try {
            const baseUrl = window.SAMPLER_API_URL;
            const url = this.currentCategory === 'All'
                ? `${baseUrl}/api/samples`
                : `${baseUrl}/api/samples?category=${this.currentCategory}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this.samples = data.data;
                this.renderResults();
            }
        } catch (error) {
            console.error('Failed to load samples:', error);
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: #1f2937;
                    color: white;
                    font-family: system-ui, sans-serif;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }

                .controls {
                    padding: 10px;
                    border-bottom: 1px solid #374151;
                    display: flex;
                    gap: 10px;
                }

                select {
                    background: #111827;
                    color: white;
                    border: 1px solid #4b5563;
                    padding: 6px;
                    border-radius: 4px;
                    width: 100%;
                }

                .results {
                    flex: 1;
                    overflow-y: auto;
                    padding: 5px;
                }

                .sample-item {
                    display: flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-bottom: 1px solid #374151;
                    cursor: grab;
                    background: #111827;
                    margin-bottom: 4px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }

                .sample-item:hover {
                    background: #374151;
                }

                .sample-info {
                    flex: 1;
                    font-size: 13px;
                }
                
                .sample-name {
                    display: block;
                    font-weight: 500;
                }

                .sample-meta {
                    font-size: 10px;
                    color: #9ca3af;
                }

                .btn-preview {
                    background: transparent;
                    border: 1px solid #4b5563;
                    color: #9ca3af;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    margin-right: 10px;
                }

                .btn-preview:hover {
                    border-color: #10b981;
                    color: #10b981;
                }
            </style>

            <div class="controls">
                <select id="category-select">
                    ${this.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <button id="btn-refresh" style="background:none; border:none; cursor:pointer;" title="Refresh">🔄</button>
            </div>

            <div class="results" id="results-container">
                <!-- Items here -->
            </div>
            
            <audio id="preview-player"></audio>
        `;
    }

    renderResults() {
        const container = this.shadowRoot.getElementById('results-container');
        if (!this.samples.length) {
            container.innerHTML = '<div style="padding:10px; text-align:center; opacity:0.6; font-size:12px;">No samples found</div>';
            return;
        }

        const baseUrl = 'http://localhost:3000';
        container.innerHTML = this.samples.map(sample => {
            // If sample.path starts with /, prepend backend url
            // If sample.url is present, use it directly (Freesound)
            let url = sample.url;
            if (!url && sample.path) {
                // Remove /api prefix if present in path logic, but here backend serves at /uploads
                // Sample.js in backend saves path as `/uploads/filename`
                url = `${baseUrl}${sample.path}`;
            }

            return `
                <div class="sample-item" draggable="true" data-url="${url}" data-name="${sample.name}">
                    <button class="btn-preview" data-url="${url}">▶</button>
                    <div class="sample-info">
                        <span class="sample-name">${sample.name}</span>
                        <span class="sample-meta">${sample.category}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add dynamic listeners for lists
        container.querySelectorAll('.btn-preview').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                this.playPreview(url, e.currentTarget);
            });
        });

        container.querySelectorAll('.sample-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'sample',
                    url: item.dataset.url,
                    label: item.dataset.name
                }));
                // Also set plain text for generic drops
                e.dataTransfer.setData('text/plain', item.dataset.url);
            });
        });
    }

    setupEventListeners() {
        this.shadowRoot.getElementById('category-select').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.loadSamples();
        });

        this.shadowRoot.getElementById('btn-refresh').addEventListener('click', () => {
            this.loadSamples();
        });
    }

    playPreview(url, btn) {
        const player = this.shadowRoot.getElementById('preview-player');

        // Check if playing the same URL
        if (this._currentPreviewUrl === url && !player.paused) {
            player.pause();
            player.currentTime = 0;
            this._resetPreviewIcons();
            this._currentPreviewUrl = null;
            return;
        }

        // Stop previous
        this._resetPreviewIcons();

        // Play new
        this._currentPreviewUrl = url;
        player.src = url;
        player.play()
            .then(() => {
                btn.textContent = '■'; // Stop icon
                btn.style.borderColor = '#ef4444'; // Red border
                btn.style.color = '#ef4444';
            })
            .catch(e => console.error(e));

        // Reset on end
        player.onended = () => {
            this._resetPreviewIcons();
            this._currentPreviewUrl = null;
        };
    }

    _resetPreviewIcons() {
        const btns = this.shadowRoot.querySelectorAll('.btn-preview');
        btns.forEach(b => {
            b.textContent = '▶';
            b.style.borderColor = '';
            b.style.color = '';
        });
    }
}

customElements.define('sample-library', SampleLibrary);
