import type { APIRoute } from 'astro';
import { getArticlesWithImages } from '../lib/articles';

// Consumed by the main MealMesh app's landing page ("From the kitchen" strip)
// so it can show the latest posts without a build-time dependency on this repo.
export const GET: APIRoute = async ({ site }) => {
  const resolved = await getArticlesWithImages();

  const latest = resolved.slice(0, 10).map(({ article, image }) => ({
    slug: article.id,
    title: article.data.title,
    excerpt: article.data.excerpt,
    category: article.data.category,
    heroImage: image.url.startsWith('http') ? image.url : new URL(image.url, site).toString(),
    heroImageAlt: image.alt,
    readingTime: article.data.readingTime,
    publishedAt: article.data.publishedAt.toISOString(),
    url: new URL(`/articles/${article.id}`, site).toString(),
  }));

  return new Response(JSON.stringify({ articles: latest }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
