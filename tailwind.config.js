/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{ts,tsx}', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#a8ff35',
          dark: '#6fe600',
          light: '#c3ff70',
        },
        surface: {
          DEFAULT: '#050505',
          card: '#0d0d0f',
          elevated: '#141416',
        },
        // Palette Skoleom Universe
        skoleom: {
          lime: '#a8ff35',
          green: '#6fe600',
          cyan: '#00ffff',
          yellow: '#faee21',
          silver: '#98989D',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Anton', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'skoleom-gradient': 'linear-gradient(135deg, #faee21 0%, #6fe600 50%, #00ffff 100%)',
        'skoleom-gradient-warm': 'linear-gradient(90deg, #a8ff35 0%, #6fe600 100%)',
      },
      boxShadow: {
        'glow-lime': '0 0 40px rgba(168, 255, 53, 0.4)',
        'glow-lime-sm': '0 0 20px rgba(168, 255, 53, 0.25)',
        'glow-lime-lg': '0 0 60px rgba(168, 255, 53, 0.35)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'capsule-ping': 'capsulePing 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        capsulePing: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(168, 255, 53, 0.3)' },
          '50%': { boxShadow: '0 0 0 20px rgba(168, 255, 53, 0)' },
        },
      },
    },
  },
  plugins: [],
};
