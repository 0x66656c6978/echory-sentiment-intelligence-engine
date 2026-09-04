/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#06090b",
        panel: "#0f1618",
        line: "#233234",
        amber: "#ffb020",
        signal: {
          low: "#34d399",
          medium: "#fbbf24",
          high: "#fb7a1e",
          critical: "#ef4444",
        },
        sentiment: {
          positive: "#34d399",
          negative: "#f87171",
          neutral: "#94a3b8",
          sarcastic: "#c084fc",
          aggressive: "#ef4444",
          deflecting: "#f59e0b",
          appeasement: "#38bdf8",
        },
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        transcript: ['"IBM Plex Serif"', "serif"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: 1, filter: "brightness(1)" },
          "50%": { opacity: 0.55, filter: "brightness(1.5)" },
        },
        blink: {
          "0%, 49%": { opacity: 1 },
          "50%, 100%": { opacity: 0.15 },
        },
        slideIn: {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-glow": "pulseGlow 1.4s ease-in-out infinite",
        blink: "blink 1s steps(1) infinite",
        "slide-in": "slideIn 0.3s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
