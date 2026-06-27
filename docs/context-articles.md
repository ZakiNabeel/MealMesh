# MealMesh — Article Generation Context

> Feed this file to any LLM (Claude, GPT, etc.) along with a topic or title to
> draft a new Kitchen Notes article. It defines the product, the audience, the
> voice, the required structure, and the safety rules that make MealMesh's
> content trustworthy. For the mechanical "how to publish" steps (frontmatter
> fields, file location, `relatedSlugs`), see `blog/README.md` — this doc is
> about what to write and how it should sound, not where the file goes.

---

## 1. Product overview (what you're writing about)

**MealMesh** generates ONE weekly meal plan for a whole household whose
members have different dietary needs, plus a single consolidated grocery
list. One-line pitch: **"One household. Many diets. One plan. One grocery
list."**

**The moat, and the thing every article should ultimately point back to:**
most meal planners assume a solo eater and only send an AI model negative
rules ("no pork, no dairy"), which is exactly how unsafe substitutes slip
through. MealMesh instead computes a positive `ALLOW_LIST` per household
(not just an exclude list) and runs every generated plan through a
**deterministic, code-based safety check** before it's ever shown to a user —
no plan ships with a forbidden ingredient, by construction, not by AI
promise. This is the single most important fact about the product. Articles
don't need to explain the engineering, but they should never contradict it or
imply "the AI figures it out" — the truth is closer to "the AI proposes, a
deterministic check verifies."

## 2. Audience personas

Use these as the "who is this article for" lens. They match the personas
already live on the marketing site (`src/components/WebsiteLanding.tsx`) —
keep new copy consistent with them rather than inventing new segments:

- **Mixed-diet families** — one household, several diets at once (e.g. one
  vegetarian, one halal, one with a peanut allergy). The most common case;
  most "Guides" articles should default to this lens.
- **Medically careful households** — diabetic, renal, low-FODMAP, prenatal,
  or allergy-driven constraints where a mistake has real consequences, not
  just a preference violated. Includes diaspora families managing both a
  cultural diet (halal/kosher/Hindu vegetarian) and a medical one at once.
  Write for **diabetic caregivers** and **allergy parents** specifically when
  the topic calls for it — they read more carefully and want precision, not
  reassurance.
- **Picky eaters & busy parents** — variety fatigue and time pressure, not a
  formal constraint. Lighter, more practical tone; fewer "constraint engine"
  mentions, more "what actually gets cooked on a Tuesday."

## 3. Brand voice

**Direct, concrete, non-hype, safety-first.** MealMesh's own copy never
fabricates evidence (no invented testimonials, no fake stats, no "9 out of 10
families..."). Articles should sound like a practical, slightly technical
friend explaining how something actually works — not a content-marketing
listicle.

**Do:**
- Name the actual mechanism ("a positive allow-list, checked ingredient by
  ingredient," not "smart AI magic").
- Use concrete specifics (ingredient names, a real checklist, a real
  technique) over vague encouragement.
- Acknowledge where things are genuinely hard, then explain the fix.
- End on a real CTA back to the product, framed as the natural next step, not
  a hard sell.

**Don't:**
- Don't invent customer quotes, names, or review scores.
- Don't claim a specific number of users, downloads, or "X% of households."
- Don't say "doctor-approved," "clinically proven," or anything implying
  medical authority MealMesh doesn't have (see §6).
- Don't use false urgency ("don't wait," "limited time") — this is a
  household-planning tool, not a flash sale.

## 4. Article template

Every article follows this shape (see the three live articles in
`blog/src/content/articles/` for worked examples):

1. **Hook** — open with the real-world friction, not a definition. ("If you
   live with other people, there's a good chance not everyone at your table
   eats the same way.")
2. **Problem** — name what actually makes it hard, precisely. Avoid generic
   "meal planning is hard" — identify the *specific* mechanism of difficulty
   (e.g. negative-only constraint lists producing unsafe guesses).
3. **How it's actually solved** — a practical breakdown the reader can use
   even without the product (a checklist, a short framework, 3-5 concrete
   tactics). This is the part that earns the read — don't gate the useful
   part behind the CTA.
4. **Where MealMesh fits** — one or two sentences connecting the practical
   advice to the product's actual mechanism (allow-list + deterministic
   check), with a link to one related article if relevant.
5. **CTA** — one sentence + a link to `${APP_URL}/onboarding`, phrased as the
   logical next step ("Build your household's plan").

Target length: 500-800 words. Long enough to be genuinely useful, short
enough to respect a tired parent's time.

## 5. SEO rules

- **`metaTitle`** (≤60 chars) and **`metaDescription`** (≤155 chars) are
  required frontmatter fields — write them as real, specific summaries, not
  keyword stuffing. They become the literal `<title>` and OG/Twitter
  description.
- **`category`** must be exactly one of `Guides | Nutrition | Budget |
  Cultural` (enforced by the content schema in `blog/src/content.config.ts`)
  — pick the one that best matches search intent for the topic.
- **`tags`**: 3-6 lowercase, specific phrases a real person would search
  (e.g. `halal`, `gluten-free`, `budget meal planning`) — not generic single
  words like `food`.
- **Internal links**: every article should link to at least one other
  article inline (in the body, via `[text](/articles/<slug>)`) where it's
  genuinely relevant — not a forced "see also" — plus 1-2 entries in
  `relatedSlugs` (see §7). This is the actual SEO lever for a small site:
  dwell time and crawl depth, not keyword density.
- Always include the real CTA link to `${APP_URL}/onboarding` at least once —
  it's both a conversion path and a legitimate outbound-to-product link.

## 6. Safety guardrails (non-negotiable)

These mirror the product's own non-negotiables (`docs/MealMesh-context.md`
§10) — articles are marketing surface for a safety-critical product, so they
carry the same bar:

- **Never give specific medical or religious advice.** Don't tell a reader
  "X is safe for diabetics" or "Y is halal" as a general claim — describe
  *categories* and point to checking with a professional or religious
  authority for anything load-bearing. MealMesh's own Terms page explicitly
  disclaims being a medical or religious authority; articles must not
  contradict that.
- **Never present an unsafe substitution as a casual tip** (e.g. don't
  casually suggest a swap that could reintroduce an allergen or violate a
  hard religious rule "if you're not too strict about it"). If a substitution
  is mentioned, frame it as the kind of thing that should be checked, not
  assumed safe.
- **Always frame the safety claim correctly**: it's a deterministic,
  ingredient-by-ingredient check run after generation, not "the AI knows
  best." If an article references how MealMesh avoids unsafe meals, say
  *that*, specifically.
- **No fabricated social proof** — see §3. This includes implied claims like
  "households love this trick" without attribution.

## 7. Example titles + the related-articles linking convention

**Already published** (don't duplicate — link to these instead):
- *One Meal Plan, Five Different Diets: How Mixed-Diet Households Actually
  Cook* (`mixed-diet-households`, Guides)
- *Gluten-Free and Halal at the Same Table: Easier Than It Looks*
  (`gluten-free-halal-same-table`, Cultural)
- *Feeding a Family on a Budget Without Three Separate Grocery Lists*
  (`budget-friendly-family-meals`, Budget)

**Good next titles** (pick freely, or use as a model for new ones):
- *Guides*: "What 'Hard Exclude' Actually Means (and Why Your Meal App
  Should Use It)", "Picky Eaters Aren't a Diet, But They Still Need a Plan"
- *Nutrition*: "Diabetes-Friendly Dinners the Whole Family Will Actually
  Eat", "What Prenatal Nutrition Guidelines Actually Restrict (and What They
  Don't)"
- *Budget*: "Why Buying One Protein in Bulk Beats Five Small Purchases",
  "Regional Pricing: Why a Meal Plan Should Know What Groceries Cost Where
  You Live"
- *Cultural*: "Hindu Vegetarian and Vegan Aren't the Same Thing — Here's the
  Actual Difference", "Cooking Halal and Kosher in the Same Kitchen, Without
  Two Sets of Everything"

**Linking convention**: when you publish a new article, add its slug to the
`relatedSlugs` of 1-2 existing siblings in the *same or an adjacent*
category, and pick 1-2 existing slugs for its own `relatedSlugs`. The goal is
a connected web, not a flat list — no article should have zero inbound
related-links from another article.
