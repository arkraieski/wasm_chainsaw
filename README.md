# Data Chainsaw

Plain HTML/CSS/JS WASM data workbench with a minimal Vite build step.
Tailwind is compiled locally with PostCSS (no Tailwind CDN runtime dependency).

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

Build output is generated in `dist/`.

## GitHub Pages

This project is configured with `base: "./"` in `vite.config.js`, so the built site works from a repository subpath.

Deploy by publishing the `dist/` folder (for example with GitHub Actions or any Pages deploy action).
