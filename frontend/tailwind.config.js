/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        kairon: {
          dark: "#0b0e14",
          card: "#121721",
          border: "#1e2638",
          accent: "#3b82f6",
          gold: "#eab308",
          bullish: "#10b981",
          bearish: "#ef4444",
        }
      },
    },
  },
  plugins: [],
};
