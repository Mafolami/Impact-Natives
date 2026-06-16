export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  safelist: ["ml-16", "ml-56"],
  theme: {
    extend: {
      colors: {
        primary: "#C45C26",
        trust: "#2D6A4F"
      }
    }
  },
  plugins: []
};