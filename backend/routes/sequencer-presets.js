const express = require('express');
const router = express.Router();
const SequencerPreset = require('../models/SequencerPreset');

/**
 * GET /api/sequencer-presets
 * List all presets
 */
router.get('/', async (req, res) => {
    try {
        const presets = await SequencerPreset.find().sort({ name: 1 });
        res.json({ success: true, data: presets });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/sequencer-presets
 * Create new preset
 */
router.post('/', async (req, res) => {
    try {
        const { name, sequences, bpm } = req.body;

        // Upsert logic (optional) or just create
        // If name exists, update it? Or let unique constraint fail?
        // Let's try update if exists
        let preset = await SequencerPreset.findOne({ name });

        if (preset) {
            preset.sequences = sequences;
            preset.bpm = bpm;
            preset.updatedAt = Date.now();
            await preset.save();
        } else {
            preset = new SequencerPreset({ name, sequences, bpm });
            await preset.save();
        }

        res.status(201).json({ success: true, data: preset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/sequencer-presets/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await SequencerPreset.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Preset deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
