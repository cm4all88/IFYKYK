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
        amber: {
          DEFAULT: "#d4680a",
          soft: "rgba(212,104,10,0.08)",
          dim: "rgba(212,104,10,0.22)",
          light: "#f5a623",
        },
        surface: {
          DEFAULT: "#faf8f4",
          alt: "#f2ede4",
          deep: "#e8e2d8",
        },
        dark: {
          DEFAULT: "#080808",
          surface: "#111110",
          card: "#181816",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
