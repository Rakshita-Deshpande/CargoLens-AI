/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#060F24", 900: "#0A1A3C", 800: "#102450", 700: "#1A3366", 600: "#2A4580" },
        brand: { 50: "#EEF3FF", 100: "#DCE7FF", 200: "#BDD0FF", 500: "#3C6CF0", 600: "#2458E6", 700: "#1B45C0", 800: "#1A3A99" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        pop: "0 10px 30px -8px rgba(15,23,42,0.25), 0 2px 8px rgba(15,23,42,0.08)",
      },
      keyframes: {
        "toast-in": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: { "toast-in": "toast-in .2s ease-out", "fade-in": "fade-in .15s ease-out" },
    },
  },
  plugins: [],
};
