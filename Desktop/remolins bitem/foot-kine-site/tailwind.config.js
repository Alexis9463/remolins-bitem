/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#EEF3FA",
        surface2: "#E1EAF6",
        ink: "#101A2B",
        inksoft: "#51637A",
        inkfaint: "#8C9BB0",
        pitch: "#173C77",
        pitchdark: "#0B2148",
        tape: "#1D5FB8",
        tapedark: "#154A92",
        tapelight: "#DCEAFB",
        okbg: "#DCEEEF",
        oktext: "#1F5A61",
        purple: "#6B4FA0",
        purplelight: "#EDE7F6",
        pink: "#B3467C",
        pinklight: "#F7E4EE",
        green: "#3D7A5C",
        greenlight: "#DFEFE6",
        amber: "#B8823A",
        amberlight: "#F5E7D2",
        danger: "#A6423A",
        dangerlight: "#F5DFDC",
        blue: "#2C63A6",
        bluelight: "#DCE7F5",
        line: "#D6E0EE",
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};
