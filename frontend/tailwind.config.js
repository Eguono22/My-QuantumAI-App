module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif']
      },
      colors: {
        market: {
          black: '#07111f',
          dark: '#0d1b2f',
          yellow: '#f4c95d',
          paper: '#eef4ff',
          line: '#20314c',
          text: '#d9e4f4'
        },
      },
      boxShadow: {
        panel: '0 18px 55px rgba(2, 10, 24, 0.26)',
      },
      keyframes: {
        fadeRise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        fadeRise: 'fadeRise 600ms ease-out forwards',
        ticker: 'ticker 36s linear infinite'
      }
    }
  }
};
