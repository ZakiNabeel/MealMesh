# MealMesh — Kitchen Notes (blog)

A separate static site (Astro) for long-form content, decoupled from the main
Expo app so articles get real, pre-rendered HTML — better SEO than the main
app's client-side SPA can offer. See `docs/MealMesh-context.md` → Plan C for
why this is a second codebase instead of in-app routes.

## Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks (astro check) + builds to dist/
```

## Adding a new article

1. Create `src/content/articles/<slug>.md` with this frontmatter:
   ```yaml
   title: '...'
   category: 'Guides' # Guides | Nutrition | Budget | Cultural
   excerpt: '...'
   heroImage: '/images/articles/<slug>.svg' # or an absolute https:// URL
   heroImageAlt: '...'
   author: 'The MealMesh Team'
   publishedAt: 2026-06-01
   readingTime: '5 min read'
   tags: ['...']
   relatedSlugs: ['some-other-slug']
   metaTitle: '...'
   metaDescription: '...'
   ```
2. Write the body in Markdown below the frontmatter.
3. Add this article's slug to 1–2 siblings' `relatedSlugs` to weave the reading flow.
4. Commit + redeploy. No code change needed — it appears in the index, the
   `/feed.json` endpoint, and any related-reads strip automatically.

## Deploying (not yet done — needs your hands)

This scaffold is built but **not deployed**. To go live:

1. **Vercel**: create a *second* Vercel project pointed at this `/blog`
   subdirectory of the repo (Root Directory = `blog` in the Vercel project
   settings). Framework preset: Astro (auto-detected).
2. **Domain**: in that Vercel project's Domains settings, add
   `blog.getmealmesh.com`.
3. **DNS at Porkbun**: add a `CNAME` record — host `blog`, pointing at the
   target Vercel gives you (shown on the same Domains screen, usually
   `cname.vercel-dns.com`).
4. **Env var**: set `PUBLIC_APP_URL=https://getmealmesh.com` in the Vercel
   project's Environment Variables (optional — that's already the default).
5. **Wire the main app**: set `EXPO_PUBLIC_BLOG_URL=https://blog.getmealmesh.com`
   in the main app's Vercel project once this is live, so the "Articles" nav
   link and the "From the kitchen" landing strip point at the real blog
   instead of falling back to the in-page anchor / being hidden.

I can't create the Vercel project, add the domain, or edit DNS myself — those
need your login. Happy to walk through each screen when you're ready.
