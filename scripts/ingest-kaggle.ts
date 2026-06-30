/**
 * Offline ingest: turn a large external recipe dataset (e.g. the Kaggle
 * RecipeNLG ~2M CSV) into VERIFIED, cuisine-tagged rows in `recipe_corpus`.
 *
 * We deliberately DON'T import all 2M rows. The funnel keeps only rows we can
 * confidently place on the culinary map and safely tag:
 *
 *   raw row
 *     → parse title + ingredients (+ steps)
 *     → drop if < 3 ingredients
 *     → enrichCuisine(): drop if confidence < MIN_CONFIDENCE (80) or cuisine 'none'
 *     → dedup by normalized title slug
 *     → tagRecipe(): safety tokens from the SAME lexicon the app enforces
 *     → batch upsert via the service role
 *
 * Run OFFLINE, manually:
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   KAGGLE_DATA_PATH=./data/full_dataset.csv \
 *   KAGGLE_LICENSE="CC-BY-NC-4.0" \
 *   npm run ingest-kaggle
 *
 * Column names default to the RecipeNLG schema (title, ingredients, directions)
 * and can be overridden with KAGGLE_COL_TITLE / _INGREDIENTS / _STEPS. The
 * ingredients/steps columns may be JSON-array strings or newline/semicolon
 * lists — both are handled.
 *
 * LICENSE: verify the dataset's license permits redistribution before using
 * the output in production. Every row stores `source` + `license` so the
 * provenance travels with the data.
 */

import { createReadStream, readFileSync } from 'node:fs';
import { parse } from 'csv-parse';

import { createClient } from '@supabase/supabase-js';

import { buildGazetteer, deriveCourse, enrichCuisine, MIN_CONFIDENCE, normalizeTitle } from '@/lib/enrichCuisine';
import { tagRecipe, type RawRecipe } from '@/lib/recipeCorpus';

/* ----------------------------- config ----------------------------- */
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dataPath = process.env.KAGGLE_DATA_PATH;
const license = process.env.KAGGLE_LICENSE ?? 'unknown';
const sourceDataset = process.env.KAGGLE_SOURCE ?? 'kaggle_recipenlg';
const colTitle = process.env.KAGGLE_COL_TITLE ?? 'title';
const colIngredients = process.env.KAGGLE_COL_INGREDIENTS ?? 'ingredients';
const colSteps = process.env.KAGGLE_COL_STEPS ?? 'directions';
const MAX_ROWS = process.env.KAGGLE_MAX_ROWS ? Number(process.env.KAGGLE_MAX_ROWS) : Infinity;

if (!url || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
if (!dataPath) throw new Error('Set KAGGLE_DATA_PATH to the dataset CSV.');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/* --------------------------- gazetteer ---------------------------- */
const readJson = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const gaz = buildGazetteer({
  nationalDishes: readJson('national-dishes.json'),
  countryToRegion: readJson('country-to-region.json'),
  titleRules: readJson('title-cuisine-rules.json'),
  regionProfiles: readJson('region-ingredient-profiles.json'),
});

/* --------------------------- helpers ------------------------------ */
/** Parse a cell that's either a JSON array string or a delimited list. */
function parseList(cell: string | undefined): string[] {
  if (!cell) return [];
  const t = cell.trim();
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* fall through to delimiter split */
    }
  }
  return t.split(/\n|;|\|/).map((s) => s.trim()).filter(Boolean);
}

/** Strip quantities/units down to a coarse ingredient name for tagging. */
function ingredientName(raw: string): string {
  return raw
    .replace(/^[\d\s.,/¼½¾⅓⅔-]+/, '') // leading amounts
    .replace(/\b(cup|cups|tbsp|tsp|teaspoon|tablespoon|oz|ounce|lb|pound|g|kg|ml|l|clove|cloves|pinch|can|cans|package)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Row { [k: string]: string }

function toRow(raw: RawRecipe, confidence: number, method: string) {
  const tagged = tagRecipe(raw);
  return {
    title: tagged.title,
    cuisine: tagged.cuisine,
    country_origin: tagged.countryOrigin ?? null,
    course: tagged.course,
    ingredients: tagged.ingredients,
    steps: tagged.steps,
    servings: tagged.servings ?? 4,
    time_minutes: tagged.timeMinutes ?? 30,
    exclusion_tokens: tagged.exclusionTokens,
    diet_compatible: tagged.dietCompatible,
    cost_tier: tagged.costTier,
    health_score: tagged.healthScore,
    source: sourceDataset,
    license,
    attribution_url: null,
    cuisine_confidence: confidence,
    cuisine_tag_method: method,
    source_dataset: sourceDataset,
  };
}

/* ----------------------------- main ------------------------------- */
async function main() {
  const seenSlugs = new Set<string>();
  let readCount = 0;
  let kept = 0;
  let buffer: ReturnType<typeof toRow>[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const { error } = await supabase.from('recipe_corpus').upsert(buffer, { onConflict: 'title,cuisine,course' });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    buffer = [];
  };

  const parser = createReadStream(dataPath!).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }),
  );

  for await (const record of parser as AsyncIterable<Row>) {
    if (readCount >= MAX_ROWS) break;
    readCount++;

    const title = (record[colTitle] ?? '').trim();
    if (!title) continue;

    const slug = normalizeTitle(title);
    if (!slug || seenSlugs.has(slug)) continue; // dedup by normalized title

    const ingredientStrings = parseList(record[colIngredients]).map(ingredientName).filter(Boolean);
    if (ingredientStrings.length < 3) continue; // too sparse to plan or tag well

    const { cuisine, countryOrigin, confidence, method } = enrichCuisine(title, ingredientStrings, gaz);
    if (cuisine === 'none' || confidence < MIN_CONFIDENCE) continue; // not confidently placeable

    seenSlugs.add(slug);
    const raw: RawRecipe = {
      title,
      cuisine,
      countryOrigin,
      course: deriveCourse(title),
      ingredients: ingredientStrings.map((name) => ({ name })),
      steps: parseList(record[colSteps]),
      source: sourceDataset,
      license,
    };
    buffer.push(toRow(raw, confidence, method));
    kept++;

    if (buffer.length >= 200) await flush();
    if (readCount % 50000 === 0) console.log(`… read ${readCount}, kept ${kept}`);
  }

  await flush();
  console.log(`✓ Done. Read ${readCount} rows, ingested ${kept} verified recipes into recipe_corpus.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
