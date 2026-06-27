import { getCollection, type CollectionEntry } from 'astro:content';

import { resolvePexelsImage } from './pexels';

export type ResolvedImage = { url: string; alt: string };
export type Article = CollectionEntry<'articles'>;

/**
 * All articles, sorted newest-first, each paired with its resolved hero
 * image — a real Pexels photo for `imageQuery` when a key is configured,
 * otherwise the article's local placeholder SVG.
 */
export async function getArticlesWithImages(): Promise<{ article: Article; image: ResolvedImage }[]> {
  const articles = await getCollection('articles');
  articles.sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());

  return Promise.all(
    articles.map(async (article) => {
      const pexels = await resolvePexelsImage(article.data.imageQuery);
      const image = pexels ?? { url: article.data.heroImage, alt: article.data.heroImageAlt };
      return { article, image };
    }),
  );
}
