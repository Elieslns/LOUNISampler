/**
 * Audio Constants & Utilities
 * 
 * Configuration et constantes pour le moteur audio.
 */

// ============================================
// MIDI NOTE MAPPING
// ============================================

/**
 * MIDI note to pad index mapping
 * C3 (48) → Pad 0
 * D#4 (63) → Pad 15
 */
export const MIDI_NOTE_TO_PAD = {
    48: 0,   // C3
    49: 1,   // C#3
    50: 2,   // D3
    51: 3,   // D#3
    52: 4,   // E3
    53: 5,   // F3
    54: 6,   // F#3
    55: 7,   // G3
    56: 8,   // G#3
    57: 9,   // A3
    58: 10,  // A#3
    59: 11,  // B3
    60: 12,  // C4
    61: 13,  // C#4
    62: 14,  // D4
    63: 15   // D#4
};

/**
 * Pad index to MIDI note
 */
export const PAD_TO_MIDI_NOTE = Object.fromEntries(
    Object.entries(MIDI_NOTE_TO_PAD).map(([k, v]) => [v, parseInt(k)])
);

// ============================================
// KEYBOARD MAPPING
// ============================================

/**
 * Computer keyboard to pad mapping
 * Uses standard MPC-style layout
 */
export const KEY_TO_PAD = {
    // Row 1 (top pads 12-15) - AZERTY: & é " '
    '&': 12, 'é': 13, '"': 14, '\'': 15,
    // Row 2 (pads 8-11) - AZERTY: a z e r
    'a': 8, 'z': 9, 'e': 10, 'r': 11,
    // Row 3 (pads 4-7) - AZERTY: q s d f
    'q': 4, 's': 5, 'd': 6, 'f': 7,
    // Row 4 (bottom pads 0-3) - AZERTY: w x c v
    'w': 0, 'x': 1, 'c': 2, 'v': 3
};

// ============================================
// AUDIO DEFAULTS
// ============================================

export const AUDIO_DEFAULTS = {
    // Master
    masterVolume: 0.8,

    // Sample defaults
    sampleVolume: 1.0,
    samplePlaybackRate: 1.0,
    sampleReverse: false,

    // Sequencer
    defaultBPM: 120,
    minBPM: 60,
    maxBPM: 240,
    stepsPerBeat: 4,  // 16th notes
    totalSteps: 16,

    // Effects
    reverbAmount: 0,
    delayAmount: 0,
    delayTime: 0.3,
    delayFeedback: 0.4,

    // Scheduler (Chris Wilson pattern)
    scheduleAheadTime: 0.1,  // seconds
    lookAheadInterval: 25,   // milliseconds

    // Slicer
    sliceThreshold: 0.01,
    sliceMinDuration: 0.05,
    sliceWindowSize: 0.01,

    // Recorder
    maxRecordDuration: 30  // seconds
};

// ============================================
// PAD COLORS
// ============================================

export const PAD_COLORS = [
    '#ff6b6b', '#ffa06b', '#ffd56b', '#d5ff6b',
    '#6bff8e', '#6bffd5', '#6bd5ff', '#6b8eff',
    '#8e6bff', '#d56bff', '#ff6bd5', '#ff6b8e',
    '#ff8e6b', '#ffb86b', '#ffe06b', '#c4ff6b'
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert BPM to milliseconds per step (16th note)
 */
export function bpmToStepMs(bpm) {
    return (60000 / bpm) / 4;
}

/**
 * Convert BPM to seconds per step
 */
export function bpmToStepSeconds(bpm) {
    return (60 / bpm) / 4;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Convert linear volume (0-1) to decibels
 */
export function linearToDb(value) {
    if (value <= 0) return -Infinity;
    return 20 * Math.log10(value);
}

/**
 * Convert decibels to linear volume (0-1)
 */
export function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

/**
 * Format time in seconds to MM:SS.ms
 */
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Generate a unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
