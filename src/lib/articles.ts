/**
 * Latest-articles feed — the blog (`/blog`) is a separately-deployed Astro
 * site exposing `feed.json`. This is the one fetch point every consumer
 * (marketing site, in-app dashboard rail) shares.
 */

export type FeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  heroImage: string;
  heroImageAlt: string;
  readingTime: string;
  url: string;
};

// Until the blog is live, EXPO_PUBLIC_BLOG_URL is unset and callers fall back
// to their own placeholder content instead of linking somewhere dead.
const BLOG_URL = process.env.EXPO_PUBLIC_BLOG_URL;

export async function getLatestArticles(limit = 12): Promise<FeedArticle[]> {
  if (!BLOG_URL) return [];
  try {
    const res = await fetch(`${BLOG_URL}/feed.json`);
    const json: { articles?: FeedArticle[] } = await res.json();
    return (json.articles ?? []).slice(0, limit);
  } catch {
    return [];
  }
}
