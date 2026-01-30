const mongoose = require('mongoose');

const SequencerPresetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    sequences: [{
        padIndex: { type: Number, required: true },
        steps: [{ type: Boolean, default: false }]
    }],
    bpm: {
        type: Number,
        default: 120
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SequencerPreset', SequencerPresetSchema);
