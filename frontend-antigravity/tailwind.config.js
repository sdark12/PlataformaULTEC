/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0f172a',
                secondary: '#334155',
                accent: '#3b82f6',
                background: '#f8fafc',
                brand: {
                    dark: '#0b0f19',
                    card: '#1e293b',
                    blue: '#0d59f2',
                    teal: '#25c0f4',
                    purple: '#7f0df2',
                    magenta: '#f425d1',
                    warning: '#fbbf24',
                    danger: '#ef4444',
                    success: '#22c55e',
                }
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.36)'
            }
        },
    },
    plugins: [],
}
