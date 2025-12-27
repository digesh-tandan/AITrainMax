/** @type {import('tailwindcss').Config} */
module.exports = {
  // Specify files to scan for Tailwind classes (React components)
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Define the custom color palette for the Control-Room Theme
      colors: {
        // --- Base/UI Colors ---
        'rail-dark': '#121212',  // Primary background (Deepest Black/Gray)
        'rail-mid': '#1e1e1e',   // Sidebar/Panel background
        'rail-light': '#2c2c2c', // Card/Module background
        'rail-accent': '#00ffc8', // High-contrast **Cyan/Green** accent (used for titles, focus, KPI labels)
        
        // --- AI Priority Colors (Part 5 Visuals) ---
        'priority-high': '#34D399',  // **🟢 Green** (for High Priority trains/alerts)
        'priority-medium': '#FBBF24',// **🟡 Yellow/Amber** (for Medium Priority)
        'priority-low': '#EF4444',   // **🔴 Red** (for Low Priority/Critical alerts/Holds)

        // --- Track/Direction Colors (Part 4 Map) ---
        'track-up': '#4F46E5',    // **Indigo** (e.g., Track 1)
        'track-down': '#F97316',  // **Orange** (e.g., Track 2)
        'track-loop': '#10B981',  // **Emerald** (e.g., Track 3/Loop Line)
      },
      // Optional: Define custom font families if a specific railway-style mono font is desired
      fontFamily: {
        mono: ['Inconsolata', 'Fira Code', 'Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}