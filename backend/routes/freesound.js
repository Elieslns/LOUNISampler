const express = require('express');
const router = express.Router();
const axios = require('axios');

// Freesound API base URL
const FREESOUND_API_URL = 'https://freesound.org/apiv2';

/**
 * GET /api/freesound/search
 * Proxy endpoint for Freesound API search
 * Hides the API key from the client
 * 
 * Query parameters:
 *   - query: Search term (required)
 *   - filter: Additional filters (optional)
 *   - sort: Sort order (optional, default: 'rating_desc')
 *   - page: Page number (optional, default: 1)
 *   - page_size: Results per page (optional, default: 15, max: 150)
 */
router.get('/search', async (req, res) => {
    try {
        const { query, filter, sort, page, page_size } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        const apiKey = process.env.FREESOUND_API_KEY;

        if (!apiKey || apiKey === 'your_freesound_api_key_here') {
            return res.status(503).json({
                success: false,
                error: 'Freesound API key not configured'
            });
        }

        // Build request parameters
        const params = {
            token: apiKey,
            query: query,
            fields: 'id,name,description,duration,previews,username,avg_rating,num_ratings,tags',
            sort: sort || 'rating_desc',
            page: page || 1,
            page_size: Math.min(parseInt(page_size) || 15, 150)
        };

        // Add filter if provided
        if (filter) {
            params.filter = filter;
        }

        // Make request to Freesound API
        const response = await axios.get(`${FREESOUND_API_URL}/search/text/`, { params });

        // Transform response for client
        const results = response.data.results.map(sound => ({
            id: sound.id,
            name: sound.name,
            description: sound.description,
            duration: sound.duration,
            username: sound.username,
            rating: sound.avg_rating,
            numRatings: sound.num_ratings,
            tags: sound.tags,
            previews: {
                mp3: sound.previews['preview-hq-mp3'],
                ogg: sound.previews['preview-hq-ogg'],
                lq_mp3: sound.previews['preview-lq-mp3'],
                lq_ogg: sound.previews['preview-lq-ogg']
            }
        }));

        res.json({
            success: true,
            count: response.data.count,
            next: response.data.next ? true : false,
            previous: response.data.previous ? true : false,
            currentPage: parseInt(page) || 1,
            data: results
        });

    } catch (error) {
        console.error('Freesound API error:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            return res.status(401).json({
                success: false,
                error: 'Invalid Freesound API key'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to search Freesound'
        });
    }
});

/**
 * GET /api/freesound/sound/:id
 * Get details for a specific sound
 */
router.get('/sound/:id', async (req, res) => {
    try {
        const apiKey = process.env.FREESOUND_API_KEY;

        if (!apiKey || apiKey === 'your_freesound_api_key_here') {
            return res.status(503).json({
                success: false,
                error: 'Freesound API key not configured'
            });
        }

        const response = await axios.get(`${FREESOUND_API_URL}/sounds/${req.params.id}/`, {
            params: {
                token: apiKey,
                fields: 'id,name,description,duration,previews,username,avg_rating,num_ratings,tags,download'
            }
        });

        const sound = response.data;

        res.json({
            success: true,
            data: {
                id: sound.id,
                name: sound.name,
                description: sound.description,
                duration: sound.duration,
                username: sound.username,
                rating: sound.avg_rating,
                numRatings: sound.num_ratings,
                tags: sound.tags,
                previews: {
                    mp3: sound.previews['preview-hq-mp3'],
                    ogg: sound.previews['preview-hq-ogg']
                },
                download: sound.download
            }
        });

    } catch (error) {
        console.error('Freesound API error:', error.response?.data || error.message);

        if (error.response?.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Sound not found'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to fetch sound details'
        });
    }
});

module.exports = router;
