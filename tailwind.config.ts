import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", "html"], // ✅ Ensure dark mode works properly
  content: [
    "./src/**/**/*.{js,ts,jsx,tsx,mdx}",       // ✅ Scan `app/` directory
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",// ✅ Scan `components/`
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",        // ✅ Scan `ui/`
    "./public/**/*.html",                   // ✅ Ensure it scans static HTML files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;