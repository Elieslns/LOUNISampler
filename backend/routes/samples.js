const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Sample = require('../models/Sample');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, `sample-${basename}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});

/**
 * GET /api/samples
 * List all samples, optionally filtered by category
 */
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        // Case-insensitive match if category is provided
        const query = category ? { category: { $regex: new RegExp(category, 'i') } } : {};

        const samples = await Sample.find(query).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: samples.length,
            data: samples
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/samples
 * Upload a new sample file
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const sample = new Sample({
            name: req.body.name || req.file.originalname,
            category: req.body.category || 'Other',
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
            duration: req.body.duration || 0
        });

        const savedSample = await sample.save();

        res.status(201).json({
            success: true,
            data: savedSample
        });
    } catch (error) {
        console.error('Error uploading sample:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/samples/url
 * Add a sample via external URL (Freesound etc)
 */
router.post('/url', async (req, res) => {
    try {
        const { name, url, category, duration } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        const sample = new Sample({
            name: name || 'External Sample',
            category: category || 'Other',
            url: url,
            duration: duration || 0
        });

        const savedSample = await sample.save();

        res.status(201).json({
            success: true,
            data: savedSample
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/samples/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const sample = await Sample.findById(req.params.id);
        if (!sample) {
            return res.status(404).json({ success: false, error: 'Sample not found' });
        }

        // Delete file if local
        if (sample.filename) {
            const filePath = path.join(__dirname, '../public/uploads', sample.filename);
            await fs.unlink(filePath).catch(err => console.warn('File not found on disk:', err.message));
        }

        await Sample.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Sample deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
