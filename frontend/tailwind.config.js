/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101723",
        paper: "#f5f7fa",
        accent: "#0ea5e9",
        positive: "#22c55e",
        caution: "#f59e0b",
        negative: "#ef4444",
      },
      boxShadow: {
        soft: "0 18px 40px rgba(8, 47, 73, 0.15)",
      },
    },
  },
  plugins: [],
};
