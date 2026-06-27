import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Authoring workflow: drop a new `.md` file in src/content/articles/ with this
// frontmatter shape. It auto-appears in the index, the latest-posts feed, and
// any sibling's `relatedSlugs` — no code change needed.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['Guides', 'Nutrition', 'Budget', 'Cultural']),
    excerpt: z.string(),
    heroImage: z.string(),
    heroImageAlt: z.string(),
    author: z.string(),
    publishedAt: z.coerce.date(),
    readingTime: z.string(),
    tags: z.array(z.string()).default([]),
    relatedSlugs: z.array(z.string()).default([]),
    metaTitle: z.string(),
    metaDescription: z.string(),
  }),
});

export const collections = { articles };
