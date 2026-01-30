require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const presetsRoutes = require('./routes/presets');
const freesoundRoutes = require('./routes/freesound');
const samplesRoutes = require('./routes/samples');
const sequencerPresetsRoutes = require('./routes/sequencer-presets');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS Configuration
// Allow requests from Angular (4200) and Sampler (5500) clients
// CORS Configuration
// Allow all origins for production simplicity, or restrict to specific domains
const corsOptions = {
    origin: '*', // Allow all origins (for now)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
// Audio files will be accessible at /uploads/filename.wav
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// API Routes
app.use('/api/presets', presetsRoutes);
app.use('/api/freesound', freesoundRoutes);
app.use('/api/samples', samplesRoutes);
app.use('/api/sequencer-presets', sequencerPresetsRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`
    });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
    console.error('Server Error:', err);

    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            error: 'File too large. Maximum size is 50MB.'
        });
    }

    // Multer file type error
    if (err.message.includes('Only .wav and .mp3')) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// ============================================
// DATABASE CONNECTION & SERVER START
// ============================================

const startServer = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri || mongoUri.includes('<username>')) {
            console.warn('⚠️  WARNING: MongoDB URI not configured in .env file');
            console.warn('   Server will start but database operations will fail.');
            console.warn('   Please update MONGODB_URI in backend/.env with your MongoDB Atlas credentials.');
        } else {
            await mongoose.connect(mongoUri);
            console.log('✅ Connected to MongoDB Atlas');
        }

        // Start Express server
        app.listen(PORT, () => {
            console.log(`
🚀 LOUNISampler Backend is running!
   
   Server:     http://localhost:${PORT}
   Health:     http://localhost:${PORT}/api/health
   Uploads:    http://localhost:${PORT}/uploads/
   
   API Endpoints:
   - GET    /api/presets       List all presets
   - POST   /api/presets       Create a preset (with file upload)
   - GET    /api/presets/:id   Get preset details
   - PUT    /api/presets/:id   Update preset
   - DELETE /api/presets/:id   Delete preset and files
   - GET    /api/freesound/search?query=...  Search Freesound
      `);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Start the server
startServer();
