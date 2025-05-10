/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Territory colors
        'territory-1': '#F2FCE2', // Light Green
        'territory-2': '#FEF7CD', // Light Yellow
        'territory-3': '#FEC6A1', // Light Orange
        'territory-4': '#E5DEFF', // Light Purple
        'territory-5': '#FFDEE2', // Light Pink
        'territory-6': '#FDE1D3', // Light Peach
        'territory-7': '#D3E4FD', // Light Blue
        'territory-8': '#F1F0FB', // Light Gray
        'territory-9': '#E6FCF5', // Light Mint
        'territory-10': '#FFF0CC', // Light Gold
        'territory-11': '#FFE8C4', // Light Apricot
        'territory-12': '#E6E6FA', // Light Lavender
        
        // Special tile colors
        'mountain': '#4B5563',
        'lord-player': '#DC2626',    // Red
        'lord-opponent': '#2563EB',  // Blue
        'lord-neutral': '#9CA3AF',   // Gray
        'city-player': '#DB2777',    // Pink
        'city-opponent': '#0EA5E9',  // Light Blue
        'city-neutral': '#6B7280',   // Gray
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} 