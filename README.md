# Devendra Mulewa

Personal portfolio website for Devendra Mulewa, a software engineer based in India.

The site is intentionally simple: static HTML and CSS, with no build step. `script.js` handles work-item image previews.

The home page has extra pieces, each in its own files:

- **Grass footer** (`grass-footer.js`, `grass-footer.css`): a WebGL grass field with sunflowers. It loads three.js from a CDN. If WebGL or the CDN fails, a green background shows instead.
- **Wind cursor** (`puff-cursor.js`): a custom cursor for mouse and trackpad devices only.
- **Bug squash game** (`bugs.js`, `bugs.css`): bugs crawl on the grass. A click or tap squashes one.
- **Terminal card** (`terminal.js`, `terminal.css`): a Ghostty-style terminal that types a short intro. It shows only on screens at least 1400px wide.

All motion stops when the visitor has reduced motion turned on. On screens under 600px wide or 700px high, the home page scrolls normally.

The site has home, work, things, gems, and archive pages, SEO metadata, JSON-LD, a sitemap, robots.txt, and llms.txt.

Public site: https://devendram.com/
