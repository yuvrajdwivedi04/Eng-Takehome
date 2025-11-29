import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Aeonik', 'system-ui', 'sans-serif'],
        title: ['Season Serif', 'serif'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
      },
      colors: {
        dark: "#04181A",
        "input-bg": "#11282A",
        "brand-teal": "#3fc79e",
        frame: "rgba(255, 255, 255, 0.1)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        flow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'flow-diagonal': {
          '0%': { transform: 'translate(-50%, -50%) rotate(45deg) translateY(-50%)' },
          '100%': { transform: 'translate(-50%, -50%) rotate(45deg) translateY(50%)' },
        },
        'color-cycle': {
          '0%, 100%': { backgroundColor: '#04181A' },
          '25%': { backgroundColor: '#0a3a3d' },
          '50%': { backgroundColor: '#1a6b6f' },
          '75%': { backgroundColor: '#3fc79e' },
          '90%': { backgroundColor: '#7fffd4' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        flow: 'flow 15s linear infinite',
        'flow-diagonal': 'flow-diagonal 20s linear infinite',
        'color-cycle': 'color-cycle 8s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up-fade': 'slide-up-fade 0.4s ease-out',
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
export default config

