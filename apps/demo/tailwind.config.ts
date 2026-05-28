import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "Garamond", "serif"],
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: "#0a0a0a",
        paper: "#faf8f3",
        accent: "#c4a857",
        obsidian: "#050505",
        bone: "#F4EFE7",
        stone: "#9B948A",
        gold: "#C8A45D",
        arcblue: "#4D8CFF",
        oxblood: "#16110D",
        verified: "#58D68D",
      },
      letterSpacing: {
        widest2: "0.32em",
        widest3: "0.48em",
      },
      animation: {
        "fade-up": "fadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 1.4s ease-out both",
        "drift-gold": "driftGold 18s ease-in-out infinite",
        "drift-blue": "driftBlue 22s ease-in-out infinite",
        "seal-pulse": "sealPulse 4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        driftGold: {
          "0%, 100%": { transform: "translate(-20%, -10%) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate(-10%, 5%) scale(1.15)", opacity: "0.75" },
        },
        driftBlue: {
          "0%, 100%": { transform: "translate(20%, 10%) scale(1)", opacity: "0.45" },
          "50%": { transform: "translate(10%, -5%) scale(1.2)", opacity: "0.65" },
        },
        sealPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
