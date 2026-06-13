/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Waypoint Design System — cobalt × deep-teal dark (Navigation Map/tokens).
        "wp-bg": "#08090a",
        "wp-bg2": "#0c0d0f",
        "wp-surf": "#121316",
        "wp-surf2": "#17181c",
        "wp-surf3": "#1e1f24",
        "wp-surf4": "#26272d",
        "wp-acc": "#2f6df6",
        "wp-acc2": "#5a8bff",
        "wp-accd": "#1f50c8",
        "wp-teal": "#0e9594",
        "wp-teal2": "#2cb8b4",
        "wp-teald": "#0b7a72",
        "wp-open": "#4cc38a",
        "wp-low": "#d8b65c",
        "wp-full": "#e36a7d",
        "wp-tx": "#f7f8f8",
        "wp-txd": "#9395a1",
        "wp-txf": "#6a6b76",
        // Borders as colors (for ring/border utilities).
        "wp-line": "rgba(255,255,255,0.08)",
        "wp-line2": "rgba(255,255,255,0.13)",
      },
      fontFamily: {
        serif: ["DM Serif Display", "Georgia", "serif"],
        ui: ["Hanken Grotesk", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "wp-sm": "8px",
        "wp-md": "12px",
        "wp-lg": "16px",
        "wp-xl": "20px",
      },
      boxShadow: {
        "wp-sm": "0 2px 6px rgba(0,0,0,0.35)",
        "wp-md": "0 4px 16px rgba(0,0,0,0.4)",
        "wp-lg": "0 20px 60px rgba(0,0,0,0.5)",
        "wp-acc": "0 8px 26px rgba(47,109,246,0.28)",
        "wp-teal": "0 4px 16px rgba(14,149,148,0.35)",
      },
    },
  },
  plugins: [],
};
