const mongoose = require('mongoose');

const SampleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['Kick', 'Snare', 'HiHat', 'Percussion', 'Bass', 'Melodic', 'FX', 'Voice', 'Other'],
        default: 'Other'
    },
    filename: {
        type: String, // For uploaded files
        required: false
    },
    path: {
        type: String, // Relative path (/uploads/...)
        required: false
    },
    url: {
        type: String, // For external URLs (Freesound)
        required: false
    },
    duration: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to ensure either filename/path OR url is present
SampleSchema.pre('save', function (next) {
    if (!this.path && !this.url) {
        next(new Error('Sample must have either a local file path or an external URL'));
    } else {
        next();
    }
});

module.exports = mongoose.model('Sample', SampleSchema);
