/**
 * <pad-grid> Web Component
 * 
 * Grille de 16 pads (4x4) avec disposition spéciale :
 * - Pad 0 en BAS À GAUCHE
 * - Pad 15 en HAUT À DROITE
 * 
 * C'est l'inverse de l'ordre naturel HTML (qui va de haut en bas).
 * On utilise CSS Grid avec direction: column-reverse pour y parvenir.
 * 
 * Layout final :
 *   [12] [13] [14] [15]  <- Rangée du haut (pads 12-15)
 *   [ 8] [ 9] [10] [11]
 *   [ 4] [ 5] [ 6] [ 7]
 *   [ 0] [ 1] [ 2] [ 3]  <- Rangée du bas (pads 0-3)
 */

import './PadElement.js';

class PadGrid extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._samples = new Map(); // Map<padId, sampleInfo>
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .grid-container {
          display: grid;
          /*
           * ASTUCE CSS pour avoir Pad 0 en bas à gauche :
           * On utilise grid-auto-flow: column avec 4 rangées.
           * Les éléments sont placés colonne par colonne.
           * Combiné avec flex-direction: column-reverse sur les rangées,
           * on obtient l'ordre souhaité.
           * 
           * Mais plus simple : on génère les pads dans l'ordre
           * [12,13,14,15, 8,9,10,11, 4,5,6,7, 0,1,2,3]
           * pour que le HTML naturel donne le bon affichage !
           */
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(4, 1fr);
          gap: 10px;
          max-width: 500px;
          margin: 0 auto;
          padding: 15px;
          background: linear-gradient(180deg, #0a0a0a 0%, #151515 100%);
          border-radius: 12px;
          border: 1px solid #2a2a2a;
          box-shadow: 
            0 10px 40px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }

        /* Effet de "machine" */
        .grid-container::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 20%;
          right: 20%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #333, transparent);
        }
      </style>

      <div class="grid-container">
        ${this.generatePads()}
      </div>
    `;
    }

    generatePads() {
        // Ordre d'affichage pour que Pad 0 soit en bas à gauche
        // Rangée 1 (haut) : 12, 13, 14, 15
        // Rangée 2       :  8,  9, 10, 11
        // Rangée 3       :  4,  5,  6,  7
        // Rangée 4 (bas) :  0,  1,  2,  3
        const displayOrder = [
            12, 13, 14, 15,
            8, 9, 10, 11,
            4, 5, 6, 7,
            0, 1, 2, 3
        ];

        return displayOrder.map(padId => {
            const sample = this._samples.get(padId);
            const label = sample?.label || 'Empty';
            const loaded = sample ? 'loaded' : '';

            return `<pad-element pad-id="${padId}" label="${label}" ${loaded}></pad-element>`;
        }).join('');
    }

    /**
     * Update samples info (called when preset is loaded)
     * @param {Array} samples - Array of sample objects with padIndex, label, etc.
     */
    updateSamples(samples) {
        this._samples.clear();

        if (samples && Array.isArray(samples)) {
            samples.forEach(sample => {
                this._samples.set(sample.padIndex, sample);
            });
        }

        this.render();
    }

    /**
     * Get a specific pad element
     * @param {number} padId 
     * @returns {PadElement}
     */
    getPad(padId) {
        return this.shadowRoot.querySelector(`pad-element[pad-id="${padId}"]`);
    }

    /**
     * Set a pad as loaded with a specific label
     * @param {number} padId 
     * @param {string} label 
     */
    setPadLoaded(padId, label) {
        // Update internal map
        const sample = this._samples.get(padId) || { padIndex: padId };
        sample.label = label;
        this._samples.set(padId, sample);

        // Update UI directly
        const pad = this.getPad(padId);
        if (pad) {
            pad.setAttribute('label', label);
            pad.setAttribute('loaded', '');
        }
    }

    triggerPadVisual(padId) {
        const pad = this.getPad(padId);
        if (pad) {
            pad.triggerVisual();
        }
    }

    /**
     * Start progress animation on a pad
     * @param {number} padId 
     * @param {number} duration 
     */
    triggerPadProgress(padId, duration) {
        const pad = this.getPad(padId);
        if (pad) {
            pad.startProgress(duration);
        }
    }

    /**
     * Stop progress animation on a pad
     * @param {number} padId 
     */
    stopPadProgress(padId) {
        const pad = this.getPad(padId);
        if (pad) {
            pad.stopProgress();
        }
    }
    /**
     * Start loading animation on a pad
     * @param {number} padId 
     */
    triggerPadLoading(padId) {
        const pad = this.getPad(padId);
        if (pad) {
            pad.startLoading();
        }
    }

    /**
     * Finish loading animation on a pad
     * @param {number} padId 
     */
    finishPadLoading(padId) {
        const pad = this.getPad(padId);
        if (pad) {
            pad.finishLoading();
        }
    }
}

customElements.define('pad-grid', PadGrid);

export default PadGrid;
