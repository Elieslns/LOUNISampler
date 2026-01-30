const mongoose = require('mongoose');
const Preset = require('../models/Preset');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const badUrlPart = '250551_2297168';
const newUrl = 'https://cdn.freesound.org/previews/147/147363_2689689-lq.mp3'; // Working Clap

const fixGlobal = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const presets = await Preset.find({});
        console.log(`Scanning ${presets.length} presets...`);

        let updatedCount = 0;

        for (const preset of presets) {
            console.log(`Checking Preset: "${preset.name}"`);
            let modified = false;
            for (const sample of preset.samples) {
                if (sample.url) {
                    console.log(` - Pad ${sample.padIndex}: ${sample.url}`);
                    if (sample.url.includes('250551')) {
                        console.log(`   !!! FOUND BAD URL !!!`);
                        sample.url = newUrl;
                        sample.label = 'Fix Clap';
                        modified = true;
                    }
                }
            }

            if (modified) {
                await preset.save();
                console.log(`✅ Fixed preset "${preset.name}"`);
                updatedCount++;
            }
        }

        if (updatedCount === 0) {
            console.log('No broken URLs found.');
        } else {
            console.log(`Fixed ${updatedCount} presets.`);
        }

        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixGlobal();
