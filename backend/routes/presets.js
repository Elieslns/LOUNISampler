const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Preset = require('../models/Preset');
const Sample = require('../models/Sample');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, `${basename}-${uniqueSuffix}${ext}`);
    }
});

// File filter: only accept audio files
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only .wav and .mp3 files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max per file
    }
});

/**
 * POST /api/presets
 * Create a new preset with uploaded audio files
 * Expects multipart/form-data with:
 *   - samples: audio files (max 16)
 *   - metadata: JSON string with preset info and sample configurations
 */
router.post('/', upload.array('samples', 16), async (req, res) => {
    try {
        // Parse metadata from request body
        let metadata = {};
        if (req.body.metadata) {
            metadata = JSON.parse(req.body.metadata);
        }

        // Build samples array from uploaded files and metadata
        const samples = [];
        const uploadedFiles = req.files || [];

        // Map uploaded files by original name for matching with metadata
        const fileMap = new Map();
        uploadedFiles.forEach(file => {
            fileMap.set(file.originalname, file);
        });

        // Process each sample from metadata
        if (metadata.samples && Array.isArray(metadata.samples)) {
            for (const sampleMeta of metadata.samples) {
                let filename = '';
                let pathStr = '';
                let originalName = '';

                // Case 1: Library Sample (Linked by ID)
                if (sampleMeta.sampleId) {
                    try {
                        const libSample = await Sample.findById(sampleMeta.sampleId);
                        if (libSample) {
                            filename = libSample.filename || ''; // Might be empty if external URL
                            pathStr = libSample.path || libSample.url || '';
                            originalName = libSample.name;
                        }
                    } catch (err) {
                        console.warn(`Sample ID ${sampleMeta.sampleId} not found`);
                    }
                }
                // Case 2: New Upload
                else if (sampleMeta.originalFilename) {
                    const file = fileMap.get(sampleMeta.originalFilename);
                    if (file) {
                        filename = file.filename;
                        pathStr = `/uploads/${file.filename}`;
                        originalName = file.originalname;
                    }
                }

                const sample = {
                    padIndex: sampleMeta.padIndex,
                    filename: filename,
                    path: pathStr,
                    label: sampleMeta.label || originalName || `Pad ${sampleMeta.padIndex}`,
                    playbackRate: sampleMeta.playbackRate || 1.0,
                    volume: sampleMeta.volume || 1.0,
                    reverse: sampleMeta.reverse || false,
                    trim: sampleMeta.trim || { start: 0, end: 0 },
                    sequence: sampleMeta.sequence || Array(16).fill(false)
                };

                samples.push(sample);
            }
        } else {
            // ... (keep fallback for raw uploads without metadata if needed, or remove)
            uploadedFiles.forEach((file, index) => {
                samples.push({
                    padIndex: index,
                    filename: file.filename,
                    path: `/uploads/${file.filename}`,
                    label: file.originalname,
                    playbackRate: 1.0,
                    volume: 1.0,
                    reverse: false,
                    trim: { start: 0, end: 0 },
                    sequence: Array(16).fill(false)
                });
            });
        }

        // Create the preset
        const preset = new Preset({
            name: metadata.name || 'New Preset',
            category: metadata.category || 'Uncategorized',
            bpm: metadata.bpm || 120,
            fx: metadata.fx || { reverbAmount: 0, delayAmount: 0 },
            samples
        });

        const savedPreset = await preset.save();

        res.status(201).json({
            success: true,
            data: savedPreset
        });

    } catch (error) {
        console.error('Error creating preset:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/presets/json
 * Create a preset with external URLs (no file upload)
 * Useful for creating presets with Freesound URLs
 */
router.post('/json', async (req, res) => {
    try {
        const { name, category, bpm, fx, samples } = req.body;

        const preset = new Preset({
            name: name || 'New Preset',
            category: category || 'Uncategorized',
            bpm: bpm || 120,
            fx: fx || { reverbAmount: 0, delayAmount: 0 },
            samples: samples || []
        });

        const savedPreset = await preset.save();

        res.status(201).json({
            success: true,
            data: savedPreset
        });

    } catch (error) {
        console.error('Error creating JSON preset:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/presets
 * List all presets
 */
router.get('/', async (req, res) => {
    try {
        const presets = await Preset.find()
            .sort({ createdAt: -1 })
            .select('name category bpm samples createdAt updatedAt');

        res.json({
            success: true,
            count: presets.length,
            data: presets
        });

    } catch (error) {
        console.error('Error fetching presets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/presets/:id
 * Get a single preset by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const preset = await Preset.findById(req.params.id);

        if (!preset) {
            return res.status(404).json({
                success: false,
                error: 'Preset not found'
            });
        }

        res.json({
            success: true,
            data: preset
        });

    } catch (error) {
        console.error('Error fetching preset:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/presets/:id
 * Update a preset (without file changes)
 */
/**
 * PUT /api/presets/:id
 * Update a preset (Supports editing metadata + changing samples)
 */
router.put('/:id', upload.array('samples', 16), async (req, res) => {
    try {
        const presetId = req.params.id;
        let existingPreset = await Preset.findById(presetId);

        if (!existingPreset) {
            return res.status(404).json({ success: false, error: 'Preset not found' });
        }

        // Parse metadata
        let metadata = {};
        if (req.body.metadata) {
            metadata = JSON.parse(req.body.metadata);
        } else {
            // Fallback for JSON-only requests (legacy or simple updates)
            metadata = req.body;
        }

        // Update basic fields
        existingPreset.name = metadata.name || existingPreset.name;
        existingPreset.category = metadata.category || existingPreset.category;
        existingPreset.bpm = metadata.bpm || existingPreset.bpm;
        if (metadata.fx) existingPreset.fx = metadata.fx;

        // Handle Samples update if provided
        if (metadata.samples && Array.isArray(metadata.samples)) {
            const uploadedFiles = req.files || [];
            console.log('PUT /:id - Metadata received:', JSON.stringify(metadata, null, 2));
            console.log('PUT /:id - Files received:', uploadedFiles.length);

            const fileMap = new Map();
            uploadedFiles.forEach(file => fileMap.set(file.originalname, file));

            const newSamples = [];

            for (const sampleMeta of metadata.samples) {
                let filename = sampleMeta.filename || ''; // Default to existing
                let pathStr = sampleMeta.path || '';
                let urlStr = sampleMeta.url || '';
                let label = sampleMeta.label || '';

                // Case 1: Library Sample (New link)
                if (sampleMeta.sampleId) {
                    const libSample = await Sample.findById(sampleMeta.sampleId);
                    if (libSample) {
                        filename = libSample.filename || '';
                        pathStr = libSample.path || '';
                        urlStr = libSample.url || '';
                        label = libSample.name;
                    }
                }
                // Case 2: New File Upload
                else if (sampleMeta.originalFilename && fileMap.has(sampleMeta.originalFilename)) {
                    const file = fileMap.get(sampleMeta.originalFilename);
                    filename = file.filename;
                    pathStr = `/uploads/${file.filename}`;
                    label = file.originalname.replace(/\.[^/.]+$/, "");
                }
                // Case 3: Existing Sample (No change, or just metadata change)
                else {
                    // Values taken from sampleMeta (filename, path, url)
                }

                newSamples.push({
                    padIndex: sampleMeta.padIndex,
                    filename: filename,
                    path: pathStr,
                    url: urlStr,
                    label: label,
                    playbackRate: sampleMeta.playbackRate || 1.0,
                    volume: sampleMeta.volume || 1.0,
                    reverse: sampleMeta.reverse || false,
                    trim: sampleMeta.trim || { start: 0, end: 0 },
                    sequence: sampleMeta.sequence || Array(16).fill(false)
                });
            }
            existingPreset.samples = newSamples;
        }

        const savedPreset = await existingPreset.save();

        res.json({
            success: true,
            data: savedPreset
        });

    } catch (error) {
        console.error('Error updating preset:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/presets/:id
 * Delete a preset and its associated audio files
 * CRITICAL: Uses fs.unlink to remove files from disk
 */
router.delete('/:id', async (req, res) => {
    try {
        const preset = await Preset.findById(req.params.id);

        if (!preset) {
            return res.status(404).json({
                success: false,
                error: 'Preset not found'
            });
        }

        // Delete all associated audio files from disk
        const uploadsDir = path.join(__dirname, '../public/uploads');
        const deletePromises = [];

        for (const sample of preset.samples) {
            if (sample.filename) {
                const filePath = path.join(uploadsDir, sample.filename);
                deletePromises.push(
                    fs.unlink(filePath).catch(err => {
                        // Log but don't fail if file doesn't exist
                        console.warn(`Could not delete file ${filePath}:`, err.message);
                    })
                );
            }
        }

        // Wait for all file deletions
        await Promise.all(deletePromises);

        // Delete the preset from database
        await Preset.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Preset and associated files deleted'
        });

    } catch (error) {
        console.error('Error deleting preset:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
