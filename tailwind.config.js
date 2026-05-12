/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        messenger: {
          blue:   "#0099FF",
          purple: "#A033FF",
          dark:   "#0a0a0a",
          surface: "#161616",
        },
      },
      fontFamily: {
        ui: ["'Segoe UI'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
