import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#64748b",
        line: "#d9e1ea",
        panel: "#f7f9fc",
        accent: "#0f766e",
        danger: "#b42318",
        warning: "#b45309"
      }
    }
  },
  plugins: []
};

export default config;
