module.exports = {
            theme: {
                extend: {
                    colors: {
                        navy: { 950: '#020617', 900: '#0b1120', 800: '#0f172a', 700: '#1e293b' },
                        slatebrand: { 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b' },
                        electric: { 400: '#60a5fa', 500: '#3b82f6' },
                        gold: { 400: '#fbbf24' }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    }
                }
            }
        };
module.exports.content = ["./dist/index.html", "./assets/js/**/*.js"];
