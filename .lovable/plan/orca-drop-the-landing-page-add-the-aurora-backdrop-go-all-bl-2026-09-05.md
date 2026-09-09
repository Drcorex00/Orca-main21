# ORCA: drop the landing page, add the aurora backdrop, go all-black

## What you'll get

1. **The uploaded ORCA project becomes the live app.** Right now the workspace still holds the empty starter, so the first step is bringing in the files from your zip (everything except the git data).
2. **No more landing page.** Opening the site takes you straight into the console — map, sidebar, chat — instead of the marketing page. The old landing file is deleted and its route becomes the console itself, so `/app` links keep working via a redirect.
3. **Aurora animation behind the chat.** The WebGL aurora (green / lavender / violet stops, blend 0.5, amplitude 1, speed 1) sits only behind the chat column — it never runs under the map or the data/overview panels. Once you send your first message it fades out smoothly and stops rendering, so the conversation stays readable and the GPU work ends.
4. **Black aesthetic.** Page background near-black, sidebar a slightly lifted charcoal grey, chat surface black, hairline borders, muted grey text, one restrained accent used sparingly. Map and chart panels re-tinted to match.

## Style rules being respected

Flat surfaces, no harsh gradients or rainbow/neon color, no drop shadows, no glass, no pastel filler, no emojis, no sparkle/arrow decoration, no dot grids or radial orbs, no feature-card rows or pricing tiers or testimonials, no purple-on-black cliché beyond the aurora's own palette, sharp/near-square corners, existing hand-drawn SVG icons kept (no Lucide), motion limited to the aurora plus the fade.

## Technical notes

- Copy `forecast-foundation-main/**` into the project with rsync excluding `.git`; merge its `package.json` deps into the existing one and install. Keep the current `src/routeTree.gen.ts` regeneration flow (never hand-edit).
- Add `ogl` as a dependency. New `src/components/Background/Aurora.tsx` — the supplied component, typed, with the CSS moved into the component's Tailwind classes or a tiny local rule; it renders inside a `pointer-events-none absolute inset-0` wrapper.
- Aurora is mounted by `ChatPanel` (or the chat column wrapper in `AppLayout`) behind the message list, gated on `messages.length === 0`; unmount after a 400 ms opacity transition so the WebGL context is disposed by the component's existing cleanup.
- Aurora is client-only: it is imported through `React.lazy` behind the existing `ClientOnly`/`Suspense` shell so SSR never evaluates `ogl`.
- Delete `src/routes/index.tsx` (landing) and move the console route there: `src/routes/index.tsx` renders the lazy `AppLayout` with the existing `ssr: false` + `ClientOnly` pattern and the console's own `head()` metadata (unique title/description/og/twitter). `src/routes/app.tsx` becomes a redirect to `/`.
- Recolor via the `--orca-*` tokens in `src/styles.css` (bg-primary `#0a0a0a`, bg-secondary `#141414`, surface `#1a1a1a`, border `rgba(255,255,255,0.08)`, text muted `#8a8a8a`) so sidebar, chat, charts and map chrome all shift together; no per-component hardcoded colors added.
