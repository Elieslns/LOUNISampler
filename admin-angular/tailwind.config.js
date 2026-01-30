/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    theme: {
        extend: {
            colors: {
                // Backgrounds
                'brand-dark': '#0f172a',    // Slate 900 (Main BG)
                'brand-panel': '#1e293b',   // Slate 800 (Cards)
                'brand-surface': '#334155', // Slate 700 (Inputs/Hover)

                // Accents
                'brand-primary': '#8b5cf6', // Violet 500
                'brand-secondary': '#ec4899', // Pink 500
                'brand-cyan': '#06b6d4',      // Cyan 500

                // Status
                'brand-success': '#10b981', // Emerald 500
                'brand-warning': '#f59e0b', // Amber 500
                'brand-danger': '#ef4444',  // Red 500
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
