const mongoose = require('mongoose');
const Preset = require('../models/Preset');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const safeUrl = 'https://cdn.freesound.org/previews/387/387188_7255534-hq.mp3'; // URL du Pad 3 (qui marche)

const fixFinal = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const presets = await Preset.find({ name: /Demo Drum Kit/ });
        console.log(`Found ${presets.length} demo presets.`);

        for (const preset of presets) {
            console.log(`Processing "${preset.name}"...`);
            let modified = false;

            // 1. Fix Pad 0 (Kick Latency)
            const pad0 = preset.samples.find(s => s.padIndex === 0);
            if (pad0) {
                console.log(' - Fixing Pad 0 latency (Trim 80ms)');
                pad0.trim = { start: 0.08, end: 0 }; // 0 end means full length
                modified = true;
            }

            // 2. Fix Pad 2 (Broken URL)
            const pad2 = preset.samples.find(s => s.padIndex === 2);
            if (pad2) {
                console.log(' - Fixing Pad 2 URL (Using Safe URL)');
                pad2.url = safeUrl;
                pad2.label = 'Snare (Fix)';
                modified = true;
            } else {
                console.log(' - Creating Pad 2...');
                preset.samples.push({
                    padIndex: 2,
                    label: 'Snare (Fix)',
                    url: safeUrl,
                    volume: 1,
                    playbackRate: 1
                });
                modified = true;
            }

            if (modified) {
                await preset.save();
                console.log('✅ Changes saved.');
            }
        }

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixFinal();
