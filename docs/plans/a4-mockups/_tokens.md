# Mockup tokens

Every HTML file in this folder is standalone (inline CSS, inline SVG, no external
requests). The custom properties below are copied verbatim from
`frontend/src/index.css:8-104` — HSL triplets, consumed as `hsl(var(--x))`, same as
`tailwind.config.js:15-63` does.

Fonts: the real app loads IBM Plex Sans / Mono / Sans Condensed from Google Fonts
(`frontend/index.html:26-29`). Mockups must not make external requests, so they
declare the same stack and fall back to `ui-sans-serif` / `ui-monospace` when Plex
is not installed locally. Metrics differ slightly from production; the hierarchy
does not.

Class names in the mockups are hand-written (`.mw-*`), not Tailwind. Each one
carries a comment naming the production Tailwind string it reproduces so an
implementer can translate 1:1.
