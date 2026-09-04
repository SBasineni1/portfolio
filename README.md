# Weather Balloon Portfolio

A weather-balloon-themed portfolio for Suchit Basineni.

Use `npm run dev` for local development, `npm run build` for a production build, and `npm run preview` to preview the production build locally.

Balloon exits default to `DEFAULT_MOTION = 'physics'`; use `?motion=track` for the scripted path or `?motion=physics` to select the default explicitly.

Set the repository's GitHub Pages source to **GitHub Actions** in the repository settings before deploying.

## Content and imagery

All copy and records live in `src/content.ts`. Every project, experience and education record
has an optional `cover` (and `logo`) slot. Drop image files into `public/covers/` and reference
them with `asset('covers/your-file.jpg')`; until a file is set, each card renders its designed
fallback (typographic cover for projects, tinted surface with the organisation name for
experience and education). `DESIGN.md` is the visual contract — read it before changing CSS.
