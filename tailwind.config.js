/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Single source of truth: All colors are defined in constants/theme.ts
      // For dynamic theme switching, use the useThemeColor hook with style prop:
      // const color = useThemeColor({}, 'primary');
      // <View style={{ backgroundColor: color }} />
      //
      // Tailwind classes (like bg-blue-500, text-xl) can still be used for
      // static styling like layout, spacing, and typography sizes.
    },
  },
  plugins: [],
}