import { API_URL } from '../config/api-config.js';

/**
 * LOUNISampler - Core Audio Engine
 * Independent headless audio engine.
 * @author Elies LOUNIS
 */
export const AudioEvents = {
    ENGINE_READY: 'engine:ready',
    SAMPLE_LOADED: 'sample:loaded',
    SAMPLE_ERROR: 'sample:error',
    PRESET_LOADED: 'preset:loaded',
    PAD_TRIGGERED: 'pad:triggered',
    STEP_PLAYED: 'step:played',
    SEQUENCER_START: 'sequencer:start',
    SEQUENCER_STOP: 'sequencer:stop',
    SEQUENCER_TICK: 'sequencer:tick',
    MIDI_CONNECTED: 'midi:connected',
    MIDI_NOTE: 'midi:note',
    RECORDING_START: 'recording:start',
    RECORDING_STOP: 'recording:stop',
    RECORDING_DATA: 'recording:data'
};

// ============================================
// AUDIO ENGINE CLASS (Singleton)
// ============================================
class AudioEngine extends EventTarget {
    static #instance = null;

    // Audio Context & Nodes
    #audioContext = null;
    #masterGain = null;
    #analyser = null;
    #convolver = null;
    #delayNode = null;
    #reverbGain = null;
    #delayGain = null;
    #dryGain = null;

    // State
    #isInitialized = false;
    #buffers = new Map();        // Map<padIndex, AudioBuffer>
    #padGains = new Map();       // Map<padIndex, GainNode>
    #activeSources = new Map();  // Map<padIndex, AudioBufferSourceNode[]>
    #presetData = null;

    // Sequencer State
    #isPlaying = false;
    #bpm = 120;
    #currentStep = 0;
    #nextStepTime = 0;
    #scheduleAheadTime = 0.1;    // Schedule 100ms ahead
    #lookAhead = 25;             // Check every 25ms
    #schedulerTimerId = null;
    #sequences = new Map();      // Map<padIndex, boolean[16]>

    // MIDI State
    #midiAccess = null;
    #midiInputs = [];

    // Recorder State
    #mediaRecorder = null;
    #recordedChunks = [];
    #mediaStreamDest = null;

    // ============================================
    // CONSTRUCTOR (Private via Singleton)
    // ============================================
    constructor() {
        super();
        if (AudioEngine.#instance) {
            return AudioEngine.#instance;
        }
        AudioEngine.#instance = this;
    }

    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!AudioEngine.#instance) {
            AudioEngine.#instance = new AudioEngine();
        }
        return AudioEngine.#instance;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the AudioContext (MUST be called on user gesture)
     * @returns {Promise<boolean>}
     */
    async init() {
        if (this.#isInitialized) {
            console.warn('AudioEngine already initialized');
            return true;
        }

        try {
            // Create AudioContext
            this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create Master Gain
            this.#masterGain = this.#audioContext.createGain();
            this.#masterGain.gain.value = 0.8;

            // Create Analyser for visualization
            this.#analyser = this.#audioContext.createAnalyser();
            this.#analyser.fftSize = 2048;
            this.#analyser.smoothingTimeConstant = 0.8;

            // Create Dry Gain (direct signal)
            this.#dryGain = this.#audioContext.createGain();
            this.#dryGain.gain.value = 1.0;

            // Create Reverb (Convolver)
            this.#convolver = this.#audioContext.createConvolver();
            this.#reverbGain = this.#audioContext.createGain();
            this.#reverbGain.gain.value = 0;
            await this.#loadReverbImpulse();

            // Create Delay
            this.#delayNode = this.#audioContext.createDelay(1.0);
            this.#delayNode.delayTime.value = 0.3;
            this.#delayGain = this.#audioContext.createGain();
            this.#delayGain.gain.value = 0;
            const delayFeedback = this.#audioContext.createGain();
            delayFeedback.gain.value = 0.4;

            // Connect Graph:
            // MasterGain → DryGain → Analyser → Destination
            //           → Convolver → ReverbGain → Analyser
            //           → DelayNode → DelayGain → Analyser
            //                      ↺ Feedback
            this.#masterGain.connect(this.#dryGain);
            this.#dryGain.connect(this.#analyser);

            this.#masterGain.connect(this.#convolver);
            this.#convolver.connect(this.#reverbGain);
            this.#reverbGain.connect(this.#analyser);

            this.#masterGain.connect(this.#delayNode);
            this.#delayNode.connect(this.#delayGain);
            this.#delayNode.connect(delayFeedback);
            delayFeedback.connect(this.#delayNode);
            this.#delayGain.connect(this.#analyser);

            this.#analyser.connect(this.#audioContext.destination);

            // Create MediaStreamDestination for recording
            this.#mediaStreamDest = this.#audioContext.createMediaStreamDestination();
            this.#masterGain.connect(this.#mediaStreamDest);

            this.#isInitialized = true;
            this.#emit(AudioEvents.ENGINE_READY, { sampleRate: this.#audioContext.sampleRate });

            console.log('🎛️ AudioEngine initialized', {
                sampleRate: this.#audioContext.sampleRate,
                state: this.#audioContext.state
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize AudioEngine:', error);
            return false;
        }
    }

    /**
     * Load reverb impulse response
     */
    async #loadReverbImpulse() {
        // Generate a simple synthetic impulse response
        const duration = 2;
        const sampleRate = this.#audioContext.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.#audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay with noise
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        this.#convolver.buffer = impulse;
    }

    // ============================================
    // PRESET LOADING
    // ============================================

    /**
     * Load a preset and decode all audio buffers
     * @param {Object} preset - Preset JSON from API
     * @returns {Promise<boolean>}
     */
    async loadPreset(preset) {
        if (!this.#isInitialized) {
            console.error('AudioEngine not initialized. Call init() first.');
            return false;
        }

        try {
            this.#presetData = preset;
            this.#bpm = preset.bpm || 120;

            // Clear existing buffers
            this.#buffers.clear();
            this.#sequences.clear();
            this.#padGains.clear();

            // Update effects
            if (preset.fx) {
                this.updateEffect('reverb', preset.fx.reverbAmount || 0);
                this.updateEffect('delay', preset.fx.delayAmount || 0);
            }

            // Pre-initialize sequences for all samples so the sequencer is ready immediately
            preset.samples.forEach(sample => {
                this.#sequences.set(sample.padIndex, sample.sequence || Array(16).fill(false));
            });

            // Load each sample
            const loadPromises = preset.samples.map(async (sample) => {
                // Support both 'path' (recommended) and 'url' (legacy) fields
                const samplePath = sample.path || sample.url;
                if (!samplePath) return;

                try {
                    // Build full URL from base URL + partial path
                    // MongoDB stores only the path (e.g., /uploads/kick.mp3)
                    // Frontend reconstructs: API_URL + /uploads/kick.mp3
                    const baseUrl = API_URL;
                    const url = samplePath.startsWith('http') ? samplePath : `${baseUrl}${samplePath}`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);

                    // Store buffer
                    const idx = Number(sample.padIndex);
                    this.#buffers.set(idx, {
                        buffer: audioBuffer,
                        config: sample
                    });

                    // Create pad gain node
                    const padGain = this.#audioContext.createGain();
                    padGain.gain.value = sample.volume || 1.0;
                    padGain.connect(this.#masterGain);
                    this.#padGains.set(idx, padGain);

                    this.#emit(AudioEvents.SAMPLE_LOADED, {
                        padIndex: idx,
                        label: sample.label,
                        duration: audioBuffer.duration
                    });

                } catch (error) {
                    console.error(`Failed to load sample ${sample.padIndex}:`, error);
                    this.#emit(AudioEvents.SAMPLE_ERROR, {
                        padIndex: sample.padIndex,
                        error: error.message
                    });
                }
            });

            await Promise.all(loadPromises);

            this.#emit(AudioEvents.PRESET_LOADED, {
                name: preset.name,
                bpm: this.#bpm,
                sampleCount: this.#buffers.size
            });

            console.log(`✅ Preset "${preset.name}" loaded with ${this.#buffers.size} samples`);
            return true;

        } catch (error) {
            console.error('Failed to load preset:', error);
            return false;
        }
    }

    /**
     * Load a sample directly from an AudioBuffer (used by Recorder)
     * @param {number} padIndex
     * @param {AudioBuffer} buffer
     * @param {string} label
     */
    async loadSampleFromBuffer(padIndex, buffer, label) {
        if (!this.#isInitialized) return;

        // Create pad gain node if not exists
        if (!this.#padGains.has(padIndex)) {
            const padGain = this.#audioContext.createGain();
            padGain.gain.value = 1.0;
            padGain.connect(this.#masterGain);
            this.#padGains.set(padIndex, padGain);
        }

        // Store buffer
        this.#buffers.set(padIndex, {
            buffer: buffer,
            config: {
                padIndex,
                label,
                volume: 1.0,
                playbackRate: 1.0,
                pan: 0,
                // trimStart/trimEnd are in SECONDS - 0 means "no trim" (play full buffer)
                trimStart: 0,
                trimEnd: 0,
                reverse: false
            }
        });

        // Initialize sequence if empty
        if (!this.#sequences.has(padIndex)) {
            this.#sequences.set(padIndex, Array(16).fill(false));
        }

        this.#emit(AudioEvents.SAMPLE_LOADED, {
            padIndex,
            label,
            duration: buffer.duration
        });

        console.log(`🎤 Loaded recording to Pad ${padIndex} (${label})`);
    }

    /**
     * Load a sample from a URL (used by Freesound)
     * @param {number} padIndex
     * @param {string} url
     * @param {string} label
     */
    async loadSampleFromUrl(padIndex, url, label) {
        if (!this.#isInitialized) return;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);

            await this.loadSampleFromBuffer(padIndex, audioBuffer, label);

            console.log(`⬇️ Loaded sample from URL to Pad ${padIndex}: ${url}`);

        } catch (error) {
            console.error(`Failed to load sample from URL ${url}:`, error);
            this.#emit(AudioEvents.SAMPLE_ERROR, {
                padIndex,
                error: error.message
            });
        }
    }

    // ============================================
    // PLAYBACK
    // ============================================

    /**
     * Play a pad
     * @param {number} padIndex - Pad index (0-15)
     * @param {number} velocity - Velocity (0-1), default 1
     * @param {number} time - Scheduled time (audioContext.currentTime), default now
     */
    playPad(padIndex, velocity = 1, time = null) {
        const bufferData = this.#buffers.get(padIndex);
        if (!bufferData) {
            console.warn(`No buffer loaded for pad ${padIndex}`);
            return;
        }

        const { buffer, config } = bufferData;
        const startTime = time || this.#audioContext.currentTime;

        console.log(`▶️ PlayPad ${padIndex} triggered. Velocity: ${velocity}, Time: ${startTime}`);

        // Create source
        const source = this.#audioContext.createBufferSource();

        // Handle reverse with caching - determine which buffer to use BEFORE setting
        let playBuffer = buffer;
        if (config.reverse) {
            if (!bufferData.reversedBuffer) {
                bufferData.reversedBuffer = this.#reverseBuffer(buffer);
            }
            playBuffer = bufferData.reversedBuffer;
        }

        source.buffer = playBuffer;
        source.playbackRate.value = config.playbackRate || 1.0;

        // Create velocity gain
        const velocityGain = this.#audioContext.createGain();
        velocityGain.gain.value = velocity;

        // Connect: Source → VelocityGain → Panner → PadGain → MasterGain
        const padGain = this.#padGains.get(padIndex) || this.#masterGain;

        // Create Panner
        const panner = this.#audioContext.createStereoPanner();
        panner.pan.value = config.pan || 0;

        source.connect(velocityGain);
        velocityGain.connect(panner);
        panner.connect(padGain);

        // Handle trim
        // Support nested trim object (Mongoose schema / new runtime) OR flat properties (legacy)
        const trimConfig = config.trim || {};
        const startOffset = typeof trimConfig.start === 'number' ? trimConfig.start : (config.trimStart || 0);
        const endOffset = typeof trimConfig.end === 'number' && trimConfig.end !== 0 ? trimConfig.end : (config.trimEnd || 0);

        let duration = undefined;
        // If endOffset is defined and > 0, calculate duration. 
        // If endOffset is 0 or undefined, play until end of buffer (default).
        if (endOffset > 0 && endOffset > startOffset) {
            duration = endOffset - startOffset;
        }

        // Start playback
        source.start(startTime, startOffset, duration);

        // Track active sources for stopping
        if (!this.#activeSources.has(padIndex)) {
            this.#activeSources.set(padIndex, []);
        }
        this.#activeSources.get(padIndex).push(source);

        // Cleanup when finished
        source.onended = () => {
            const sources = this.#activeSources.get(padIndex);
            if (sources) {
                const idx = sources.indexOf(source);
                if (idx > -1) sources.splice(idx, 1);
            }
        };

        this.#emit(AudioEvents.PAD_TRIGGERED, {
            padIndex,
            velocity,
            time: startTime
        });
    }

    /**
     * Stop a pad (all active sources)
     * @param {number} padIndex
     */
    stopPad(padIndex) {
        const sources = this.#activeSources.get(padIndex);
        if (sources) {
            sources.forEach(source => {
                try {
                    source.stop();
                } catch (e) { /* Already stopped */ }
            });
            this.#activeSources.set(padIndex, []);
        }
    }

    /**
     * Stop all pads
     */
    stopAll() {
        this.#activeSources.forEach((sources, padIndex) => {
            this.stopPad(padIndex);
        });
    }

    /**
     * Reverse an AudioBuffer
     */
    #reverseBuffer(buffer) {
        const reversed = this.#audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const source = buffer.getChannelData(channel);
            const dest = reversed.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                dest[i] = source[buffer.length - 1 - i];
            }
        }

        return reversed;
    }

    // ============================================
    // VOLUME CONTROLS
    // ============================================

    /**
     * Set pad volume
     * @param {number} padIndex
     * @param {number} value - 0 to 1
     */
    setVolume(padIndex, value) {
        const padGain = this.#padGains.get(padIndex);
        if (padGain) {
            padGain.gain.setValueAtTime(value, this.#audioContext.currentTime);
        }
    }

    /**
     * Set master volume
     * @param {number} value - 0 to 1
     */
    setMasterVolume(value) {
        if (this.#masterGain) {
            this.#masterGain.gain.setValueAtTime(value, this.#audioContext.currentTime);
        }
    }

    /**
     * Alias for setVolume - used by ControlRack
     */
    setPadVolume(padIndex, value) {
        this.setVolume(padIndex, value);
    }

    /**
     * Set pad pan (stereo position)
     * @param {number} padIndex
     * @param {number} value - -1 (left) to 1 (right)
     */
    setPadPan(padIndex, value) {
        // 1. Update active runtime config
        const bufferData = this.#buffers.get(padIndex);
        if (bufferData?.config) {
            bufferData.config.pan = value;
        }

        // 2. Update preset data
        if (this.#presetData?.samples) {
            const sample = this.#presetData.samples.find(s => s.padIndex === padIndex);
            if (sample) {
                sample.pan = value;
            }
        }
        // Note: Pan is applied during playPad() - we'd need a panner node per pad for live changes
        // For now, store the value to be used on next play
    }

    /**
     * Set pad playback rate (pitch)
     * @param {number} padIndex
     * @param {number} value - 0.5 to 2.0
     */
    setPadPlaybackRate(padIndex, value) {
        // 1. Update active runtime config
        const bufferData = this.#buffers.get(padIndex);
        if (bufferData?.config) {
            bufferData.config.playbackRate = value;
        }

        // 2. Update preset data
        if (this.#presetData?.samples) {
            const sample = this.#presetData.samples.find(s => s.padIndex === padIndex);
            if (sample) {
                sample.playbackRate = value;
            }
        }
    }

    /**
     * Set pad trim (start/end points)
     * @param {number} padIndex
     * @param {number} trimStart - 0 to 1
     * @param {number} trimEnd - 0 to 1
     */
    setPadTrim(padIndex, trimStart, trimEnd) {
        // 1. Update active runtime config
        const bufferData = this.#buffers.get(padIndex);
        if (bufferData?.config) {
            // Ensure config.trim exists
            if (!bufferData.config.trim) bufferData.config.trim = {};
            bufferData.config.trim.start = trimStart;
            bufferData.config.trim.end = trimEnd;
            // Legacy/Root level support if needed (depending on how it was loaded)
            bufferData.config.trimStart = trimStart;
            bufferData.config.trimEnd = trimEnd;
        }

        // 2. Update toggle preset data (for saving)
        if (this.#presetData?.samples) {
            const sample = this.#presetData.samples.find(s => s.padIndex === padIndex);
            if (sample) {
                // Mongoose structure use nested trim object
                if (!sample.trim) sample.trim = {};
                sample.trim.start = trimStart;
                sample.trim.end = trimEnd;
            }
        }
    }

    /**
     * Set pad reverse
     * @param {number} padIndex
     * @param {boolean} reverse
     */
    setPadReverse(padIndex, reverse) {
        // 1. Update active runtime config
        const bufferData = this.#buffers.get(padIndex);
        if (bufferData?.config) {
            bufferData.config.reverse = reverse;
            // Invalidate cached reversed buffer when toggling off
            // so it gets recomputed fresh if toggled on again later
            if (!reverse) {
                delete bufferData.reversedBuffer;
            }
        }

        // 2. Update preset data
        if (this.#presetData?.samples) {
            const sample = this.#presetData.samples.find(s => s.padIndex === padIndex);
            if (sample) {
                sample.reverse = reverse;
            }
        }
    }

    // ============================================
    // EFFECTS
    // ============================================

    /**
     * Update effect wet/dry mix
     * @param {string} type - 'reverb' or 'delay'
     * @param {number} value - 0 to 1
     */
    updateEffect(type, value) {
        const clampedValue = Math.max(0, Math.min(1, value));

        switch (type) {
            case 'reverb':
                if (this.#reverbGain) {
                    this.#reverbGain.gain.setValueAtTime(clampedValue, this.#audioContext.currentTime);
                    // Reduce dry signal as reverb increases
                    this.#dryGain.gain.setValueAtTime(1 - clampedValue * 0.5, this.#audioContext.currentTime);
                }
                break;
            case 'delay':
                if (this.#delayGain) {
                    this.#delayGain.gain.setValueAtTime(clampedValue, this.#audioContext.currentTime);
                }
                break;
        }
    }

    /**
     * Set delay time
     * @param {number} seconds - 0 to 1
     */
    setDelayTime(seconds) {
        if (this.#delayNode) {
            this.#delayNode.delayTime.setValueAtTime(seconds, this.#audioContext.currentTime);
        }
    }

    // ============================================
    // SEQUENCER (Chris Wilson Lookahead Pattern)
    // ============================================

    /**
     * Start the sequencer
     */
    startSequencer() {
        if (this.#isPlaying) return;

        this.#isPlaying = true;
        this.#currentStep = 0;
        this.#nextStepTime = this.#audioContext.currentTime;

        this.#emit(AudioEvents.SEQUENCER_START, { bpm: this.#bpm });
        this.#scheduleLoop();
    }

    /**
     * Stop the sequencer
     */
    stopSequencer() {
        this.#isPlaying = false;
        if (this.#schedulerTimerId) {
            clearTimeout(this.#schedulerTimerId);
            this.#schedulerTimerId = null;
        }
        this.#emit(AudioEvents.SEQUENCER_STOP, { step: this.#currentStep });
    }

    /**
     * Set BPM
     * @param {number} bpm - 60 to 240
     */
    setBPM(bpm) {
        this.#bpm = Math.max(60, Math.min(240, bpm));
    }

    /**
     * Get current BPM
     */
    getBPM() {
        return this.#bpm;
    }

    /**
     * Update sequence for a pad
     * @param {number} padIndex
     * @param {boolean[]} sequence - Array of 16 booleans
     */
    setSequence(padIndex, sequence) {
        this.#sequences.set(Number(padIndex), [...sequence]);
    }

    /**
     * Set a specific step for a pad
     * @param {number} padIndex
     * @param {number} stepIndex
     * @param {boolean} active
     */
    setStep(padIndex, stepIndex, active) {
        const idx = Number(padIndex);
        const sequence = this.#sequences.get(idx) || Array(16).fill(false);
        sequence[stepIndex] = !!active;
        this.#sequences.set(idx, sequence);
    }

    /**
     * Toggle a step in a sequence (Legacy, prefer setStep)
     * @param {number} padIndex
     * @param {number} stepIndex
     */
    toggleStep(padIndex, stepIndex) {
        const idx = Number(padIndex);
        const sequence = this.#sequences.get(idx) || Array(16).fill(false);
        sequence[stepIndex] = !sequence[stepIndex];
        this.#sequences.set(idx, sequence);
        return sequence[stepIndex];
    }

    /**
     * Main scheduler loop (Lookahead pattern)
     */
    #scheduleLoop() {
        if (!this.#isPlaying) return;

        const secondsPerBeat = 60.0 / this.#bpm;
        const secondsPerStep = secondsPerBeat / 4; // 16th notes

        while (this.#nextStepTime < this.#audioContext.currentTime + this.#scheduleAheadTime) {
            this.#scheduleStep(this.#currentStep, this.#nextStepTime);
            this.#nextStepTime += secondsPerStep;
            this.#currentStep = (this.#currentStep + 1) % 16;
        }

        this.#schedulerTimerId = setTimeout(() => this.#scheduleLoop(), this.#lookAhead);
    }

    /**
     * Schedule notes for a step
     */
    #scheduleStep(stepIndex, time) {
        this.#emit(AudioEvents.SEQUENCER_TICK, { step: stepIndex, time });

        this.#sequences.forEach((sequence, padIndex) => {
            if (sequence[stepIndex]) {
                this.playPad(padIndex, 1, time);
                this.#emit(AudioEvents.STEP_PLAYED, { padIndex, step: stepIndex, time });
            }
        });
    }

    // ============================================
    // MIDI INPUT
    // ============================================

    /**
     * Initialize MIDI access
     */
    async initMIDI() {
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI API not supported');
            return false;
        }

        try {
            this.#midiAccess = await navigator.requestMIDIAccess();
            this.#midiAccess.inputs.forEach(input => {
                input.onmidimessage = this.#handleMIDIMessage.bind(this);
                this.#midiInputs.push(input);
            });

            this.#emit(AudioEvents.MIDI_CONNECTED, {
                inputs: this.#midiInputs.map(i => i.name)
            });

            console.log('🎹 MIDI initialized with', this.#midiInputs.length, 'inputs');
            return true;
        } catch (error) {
            console.error('Failed to initialize MIDI:', error);
            return false;
        }
    }

    /**
     * Handle incoming MIDI message
     */
    #handleMIDIMessage(event) {
        const [status, note, velocity] = event.data;
        const command = status & 0xF0;

        if (command === 0x90 && velocity > 0) { // Note On
            // Map MIDI note to Pad (simple mod 16)
            const padIndex = note % 16;
            const normalizedVelocity = velocity / 127;
            this.playPad(padIndex, normalizedVelocity);

            this.#emit(AudioEvents.MIDI_NOTE, { padIndex, note, velocity: normalizedVelocity });
        }
    }

    // ============================================
    // RECORDING
    // ============================================

    /**
     * Start recording output
     */
    startRecording() {
        if (!this.#isInitialized || !this.#mediaStreamDest) return;

        this.#recordedChunks = [];
        this.#mediaRecorder = new MediaRecorder(this.#mediaStreamDest.stream);

        this.#mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.#recordedChunks.push(event.data);
            }
        };

        this.#mediaRecorder.onstop = () => {
            const blob = new Blob(this.#recordedChunks, { type: 'audio/webm' });
            this.#emit(AudioEvents.RECORDING_DATA, { blob });
        };

        this.#mediaRecorder.start();
        this.#emit(AudioEvents.RECORDING_START);
    }

    /**
     * Stop recording
     */
    stopRecording() {
        if (this.#mediaRecorder && this.#mediaRecorder.state === 'recording') {
            this.#mediaRecorder.stop();
            this.#emit(AudioEvents.RECORDING_STOP);
        }
    }

    // ============================================
    // UTILS
    // ============================================

    /**
     * Emit custom event
     */
    #emit(type, detail = {}) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    /**
     * Get buffer for a pad
     * @param {number} padIndex
     * @returns {Object} { buffer, config }
     */
    getBuffer(padIndex) {
        return this.#buffers.get(Number(padIndex));
    }

    /**
     * Get current analyser data
     */
    getAnalyserData() {
        if (!this.#analyser) return null;
        const bufferLength = this.#analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.#analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }

    /**
     * Get frequency data
     */
    getFrequencyData() {
        if (!this.#analyser) return null;
        const bufferLength = this.#analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.#analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }
}

// Export singleton instance
const audioEngine = AudioEngine.getInstance();
export default audioEngine;
