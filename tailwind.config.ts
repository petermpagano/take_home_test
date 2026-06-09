import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // High-contrast palette tuned for a clean, government-tool feel.
        ink: "#1a2332",
        agency: "#1d4ed8",
      },
      fontSize: {
        // Slightly larger base sizing — the tool must be legible for
        // agents who are not comfortable hunting for small UI.
        base: ["1.0625rem", { lineHeight: "1.6" }],
      },
    },
  },
  plugins: [],
};

export default config;
