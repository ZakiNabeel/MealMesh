import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Consumed by the main MealMesh app's landing page ("From the kitchen" strip)
// so it can show the latest posts without a build-time dependency on this repo.
export const GET: APIRoute = async ({ site }) => {
  const articles = (await getCollection('articles')).sort(
    (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );

  const latest = articles.slice(0, 3).map((article) => ({
    slug: article.id,
    title: article.data.title,
    excerpt: article.data.excerpt,
    category: article.data.category,
    heroImage: new URL(article.data.heroImage, site).toString(),
    heroImageAlt: article.data.heroImageAlt,
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
