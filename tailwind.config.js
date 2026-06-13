/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm-dark palette anchors (see .claude/rules/map.md). Lanes extend this.
        waypoint: {
          bg: "#1a1410",
          surface: "#241c16",
          accent: "#f4a259",
        },
      },
    },
  },
  plugins: [],
};
