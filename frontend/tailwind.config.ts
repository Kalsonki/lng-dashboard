import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f1117",
        surface: "#1a1f2e",
        "surface-2": "#242938",
        border: "#2e3347",
        "text-muted": "#8892a4",
        europe: "#3b82f6",
        asia: "#f59e0b",
        uncertain: "#6b7280",
      },
    },
  },
  plugins: [],
};
export default config;
