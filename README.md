# digital dash dev

a one-page, manifesto-style site: the story of what we built.

## stack

- vite + react 19 + typescript
- react-router (only `/` for now, room for `/journal` later)
- react-markdown + remark-gfm: the story is a markdown file
- framer-motion: page fade-in, reveal on scroll, reading progress
- plain css with custom properties, light and dark from the system
- instrument sans, self-hosted in `public/fonts`

## run

```sh
npm install
npm run dev
```

## edit the story

everything on the page comes from [`src/content/story.md`](src/content/story.md). each `## heading` starts a new section that reveals on its own. write in lowercase; the css lowercases everything anyway, but copy-paste should match what's on screen.

## build

```sh
npm run build     # outputs dist/
npm run preview   # serve the build locally
```

## deploy

`vercel.json` is included, so `vercel` from the repo root deploys it as a static spa. any static host works: point it at `dist/` and rewrite every path to `index.html`.
