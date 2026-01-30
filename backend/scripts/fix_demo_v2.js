const mongoose = require('mongoose');
const Preset = require('../models/Preset');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fixDemo = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const preset = await Preset.findOne({ name: 'Demo Drum Kit v2' });

        if (!preset) {
            console.log('❌ Preset "Demo Drum Kit v2" not found.');
            process.exit(0);
        }

        console.log('Found preset:', preset.name);

        // 1. Fix Kick Latency (Pad 0)
        // Add trimStart to skip silence
        const kick = preset.samples.find(s => s.padIndex === 0);
        if (kick) {
            console.log('Fixing Kick (Pad 0) latency...');
            kick.trim = { start: 0.1, end: 1 }; // Skip 100ms of silence
        }

        // 2. Fix Pad 2 (Broken URL)
        // Pad 2 usually Snare 2 or Clap. Let's replace with a working Clap from Freesound.
        const pad2 = preset.samples.find(s => s.padIndex === 2);
        if (pad2) {
            console.log('Fixing Pad 2 (Broken URL)...');
            // Using a known working Clap preview URL from Freesound
            pad2.url = 'https://cdn.freesound.org/previews/147/147363_2689689-lq.mp3';
            pad2.label = 'Fixed Clap';
            pad2.filename = null; // Ensure it uses URL
        } else {
            console.log('Pad 2 not found, creating it...');
            preset.samples.push({
                padIndex: 2,
                label: 'Fixed Clap',
                url: 'https://cdn.freesound.org/previews/147/147363_2689689-lq.mp3',
                volume: 1,
                playbackRate: 1
            });
        }

        await preset.save();
        console.log('✅ Preset updated successfully !');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixDemo();
