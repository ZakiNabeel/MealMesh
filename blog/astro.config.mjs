import { defineConfig } from 'astro/config';

// Deployed independently from the main MealMesh app (separate Vercel project),
// on its own subdomain — see README.md for the deploy + DNS steps.
export default defineConfig({
  site: 'https://blog.getmealmesh.com',
  trailingSlash: 'never',
});
