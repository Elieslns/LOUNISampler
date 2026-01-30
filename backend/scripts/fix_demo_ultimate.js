const mongoose = require('mongoose');
const Preset = require('../models/Preset');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const safeUrl = 'https://cdn.freesound.org/previews/387/387188_7255534-hq.mp3'; // URL du Pad 3
const badUrlPart = '250551';

const fixUltimate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const presets = await Preset.find({ name: /Demo Drum Kit/ });
        console.log(`Found ${presets.length} demo presets to check.`);

        for (const preset of presets) {
            console.log(`Inspecting "${preset.name}"...`);
            let modified = false;

            const pad2 = preset.samples.find(s => s.padIndex === 2);
            if (pad2) {
                console.log(` - Pad 2 Current State: path="${pad2.path}", url="${pad2.url}"`);

                // Check for bad path
                if (pad2.path && pad2.path.includes(badUrlPart)) {
                    console.log('   !!! BAD PATH DETECTED - CLEARING !!!');
                    pad2.path = '';
                    modified = true;
                }

                // Check for bad URL
                if (pad2.url && pad2.url.includes(badUrlPart)) {
                    console.log('   !!! BAD URL DETECTED - REPLACING !!!');
                    pad2.url = safeUrl;
                    modified = true;
                }

                // Ensure good URL if path is empty (and url was potentially not set correctly before)
                if ((!pad2.url || pad2.url !== safeUrl) && (!pad2.path)) {
                    console.log('   -> Enforcing Safe URL');
                    pad2.url = safeUrl;
                    pad2.label = 'Snare (Fix)';
                    modified = true;
                }

                // ALSO Check Pad 0 Trim just in case
                const pad0 = preset.samples.find(s => s.padIndex === 0);
                if (pad0) {
                    if (!pad0.trim || pad0.trim.start < 0.05) {
                        console.log('   -> Re-Enforcing Pad 0 Trim');
                        pad0.trim = { start: 0.08, end: 0 };
                        modified = true;
                    }
                }

            }

            if (modified) {
                await preset.save();
                console.log('✅ Changes saved.');
            } else {
                console.log('User data seems clean.');
            }
        }

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixUltimate();
