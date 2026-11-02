import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "ghost-void": "#0a0a0f",
        "ghost-crypt": "#0f0f1a",
        "ghost-tomb": "#1a1a2e",
        "ghost-mist": "#16213e",
        specter: {
          100: "#f0e6ff",
          200: "#d9b8ff",
          300: "#b980ff",
          400: "#9b4dff",
          500: "#7c1dff",
          600: "#6600e6",
          700: "#5200b3",
          800: "#3d0080",
          900: "#29004d",
        },
        ectoplasm: {
          100: "#e0fff8",
          200: "#b3ffed",
          300: "#66ffe0",
          400: "#1affc2",
          500: "#00e6a8",
          600: "#00b380",
          700: "#008060",
          800: "#005c40",
          900: "#003326",
        },
        glow: {
          100: "#fff8e6",
          200: "#ffedb3",
          300: "#ffd966",
          400: "#ffc61a",
          500: "#ffb300",
          600: "#cc8c00",
        },
        parchment: {
          100: "#fdf8f0",
          200: "#f5e6cc",
          300: "#e8c99a",
          400: "#d4a668",
          500: "#b8844d",
          600: "#8c6035",
          700: "#5c3d1f",
          800: "#3d2810",
          900: "#2a1a08",
        },
        shade: {
          error: "#ff4d6a",
          warn: "#ffc61a",
          success: "#1affc2",
        },
      },
      boxShadow: {
        "glow-sm": "0 0 8px rgba(124, 29, 255, 0.4)",
        "glow-md": "0 0 16px rgba(124, 29, 255, 0.5)",
        "glow-lg": "0 0 32px rgba(124, 29, 255, 0.6)",
        "specter-sm": "0 0 6px rgba(255, 179, 0, 0.3)",
        "specter-md": "0 0 12px rgba(255, 179, 0, 0.5)",
        "crypt-sm":
          "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.6)",
        "crypt-md":
          "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(0, 0, 0, 0.7)",
        "crypt-lg":
          "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 16px 48px rgba(0, 0, 0, 0.8)",
      },
      backgroundImage: {
        "parchment-texture":
          "radial-gradient(ellipse at 20% 50%, rgba(26, 26, 46, 0.8) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124, 29, 255, 0.05) 0%, transparent 50%)",
        "fog-radial":
          "radial-gradient(ellipse at center, rgba(124, 29, 255, 0.08) 0%, transparent 70%)",
      },
      keyframes: {
        "ghost-appear": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(124, 29, 255, 0.4)" },
          "50%": { boxShadow: "0 0 20px rgba(124, 29, 255, 0.7)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "ghost-appear": "ghost-appear 150ms ease-out forwards",
        "ghost-appear-slow": "ghost-appear 200ms ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
