/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: "#00FF80",
        surface: {
          bg:     "#0B0E13",
          card:   "#141920",
          hover:  "#1A2030",
          border: "#1E2530",
        },
        muted: "#8B949E",
      },
    },
  },
  plugins: [],
}
