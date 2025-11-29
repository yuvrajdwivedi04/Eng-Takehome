# Fonts Directory

This directory contains custom font files for the Endex application.

## Usage

1. Place font files (`.woff2`, `.woff`, `.ttf`) in this directory
2. Declare fonts in `src/app/globals.css` using `@font-face`
3. Reference fonts in Tailwind config (`tailwind.config.ts`) under `fontFamily`
4. Use via Tailwind classes (e.g., `font-title`)

## Example

```css
/* In globals.css */
@font-face {
  font-family: 'CustomTitle';
  src: url('/fonts/YourFont.woff2') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
```

```typescript
// In tailwind.config.ts
fontFamily: {
  title: ['CustomTitle', 'sans-serif'],
}
```

```tsx
// In components
<h1 className="font-title">Endex</h1>
```

## File Formats

Prefer `.woff2` for modern browsers (best compression).
Include `.woff` as fallback if broader support needed.



