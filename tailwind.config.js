/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        ink: { DEFAULT: "#1c1917", soft: "#57534e", faint: "#a8a29e" },
        surface: { DEFAULT: "#ffffff", muted: "#f5f5f4", border: "#e7e5e4" },
      },
    },
  },
  plugins: [],
};
