import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", "html"], // ✅ Ensure dark mode works properly
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",       // ✅ Scan `app/` directory
    "./components/**/*.{js,ts,jsx,tsx,mdx}",// ✅ Scan `components/`
    "./ui/**/*.{js,ts,jsx,tsx,mdx}",        // ✅ Scan `ui/`
    "./public/**/*.html",                   // ✅ Ensure it scans static HTML files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;