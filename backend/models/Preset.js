const mongoose = require('mongoose');

/**
 * Sample Schema
 * Represents a single audio sample loaded on a pad
 * Includes all parameters for playback, effects, and sequencing
 */
const SampleSchema = new mongoose.Schema({
    padIndex: {
        type: Number,
        required: true,
        min: 0,
        max: 15
    },
    filename: {
        type: String,
        default: ''
    },
    // Path partiel vers le fichier audio (ex: /uploads/kick.mp3)
    // Le frontend reconstruit l'URL complète: baseUrl + path
    path: {
        type: String,
        default: ''
    },
    // URL remote externe (Freesound, etc.)
    url: {
        type: String,
        default: ''
    },
    label: {
        type: String,
        default: ''
    },
    playbackRate: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 4.0
    },
    volume: {
        type: Number,
        default: 1.0,
        min: 0,
        max: 1
    },
    reverse: {
        type: Boolean,
        default: false
    },
    trim: {
        start: {
            type: Number,
            default: 0
        },
        end: {
            type: Number,
            default: 0  // 0 = end of file
        }
    },
    // Array of 16 steps for the sequencer (true = active, false = inactive)
    sequence: {
        type: [Boolean],
        default: () => Array(16).fill(false)
    }
});

/**
 * Preset Schema
 * Represents a complete sampler configuration with all 16 pads
 * Includes global settings like BPM and effects
 */
const PresetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: 'Uncategorized',
        trim: true
    },
    bpm: {
        type: Number,
        default: 120,
        min: 60,
        max: 240
    },
    fx: {
        reverbAmount: {
            type: Number,
            default: 0,
            min: 0,
            max: 1
        },
        delayAmount: {
            type: Number,
            default: 0,
            min: 0,
            max: 1
        }
    },
    samples: [SampleSchema]
}, {
    timestamps: true  // Adds createdAt and updatedAt fields
});

// Virtual for getting the number of loaded samples
PresetSchema.virtual('sampleCount').get(function () {
    if (!this.samples) return 0;
    return this.samples.filter(s => s.filename).length;
});

// Ensure virtuals are included in JSON output
PresetSchema.set('toJSON', { virtuals: true });
PresetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Preset', PresetSchema);
