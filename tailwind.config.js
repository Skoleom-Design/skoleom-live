/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{ts,tsx}', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#ffc94d',
          dark: '#ff5470',
          light: '#ffe0a3',
        },
        surface: {
          DEFAULT: '#1c0c21',
          card: '#341839',
          elevated: '#3d1f44',
        },
        // Palette "Ticket Show"
        skoleom: {
          lime: '#ffc94d',
          green: '#ff5470',
          cyan: '#ff5470',
          yellow: '#ffc94d',
          silver: '#98989D',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'skoleom-gradient': 'linear-gradient(135deg, #ffc94d 0%, #ff5470 55%, #b33951 100%)',
        'skoleom-gradient-warm': 'linear-gradient(90deg, #ffc94d 0%, #ff5470 100%)',
      },
      boxShadow: {
        'glow-lime': '0 0 40px rgba(255, 201, 77, 0.4)',
        'glow-lime-sm': '0 0 20px rgba(255, 201, 77, 0.25)',
        'glow-lime-lg': '0 0 60px rgba(255, 201, 77, 0.35)',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 201, 77, 0.3)' },
          '50%': { boxShadow: '0 0 0 20px rgba(255, 201, 77, 0)' },
        },
      },
    },
  },
  plugins: [],
};
