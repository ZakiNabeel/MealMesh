/**
 * The seed recipe corpus — authentic, hand-authored dishes that MealMesh's own
 * engine (planEngine) draws from, no external LLM. Each entry is a normalized
 * RawRecipe; `getCorpus()` tags them once (deterministically) through the SAME
 * constraint lexicon the app enforces with, so a dish's safety tokens are
 * computed by code, never declared.
 *
 * SCOPE: this is a SEED, not the finished dataset. It seeds the launch cuisines
 * (South Asian — Pakistani + Indian split — plus Chinese, Middle Eastern,
 * Mediterranean, East Asian, American, European, Latin, African). The procedural
 * generator (cuisine.ts) fills any slot the corpus can't cover, so plans are
 * always complete. New dishes drop straight in here (or, at scale, the
 * `recipe_corpus` table via migration 0013) and the engine picks them up — the path
 * to deep per-cuisine / per-country depth.
 *
 * `countryOrigin` (ISO code) disambiguates a broad cuisine: a Pakistani
 * household scores PK-origin South Asian dishes above generic ones.
 */

import { tagRecipe, type RawRecipe, type TaggedRecipe } from '@/lib/recipeCorpus';

/* Compact authoring helper — most fields default sensibly. */
const r = (
  title: string,
  cuisine: RawRecipe['cuisine'],
  course: RawRecipe['course'],
  ingredients: string[],
  steps: string[],
  opts: { country?: string; servings?: number; timeMinutes?: number } = {},
): RawRecipe => ({
  title,
  cuisine,
  course,
  ingredients: ingredients.map((name) => ({ name })),
  steps,
  countryOrigin: opts.country,
  servings: opts.servings ?? 4,
  timeMinutes: opts.timeMinutes,
  source: 'MealMesh original',
  license: 'original',
});

const RAW: RawRecipe[] = [
  /* ---------------- South Asian — Pakistan ---------------- */
  r('Chicken Karahi', 'south_asian', 'dinner', ['chicken', 'tomato', 'ginger', 'garlic', 'green chili', 'coriander', 'cooking oil'],
    ['Sear chicken in oil over high heat.', 'Add tomato, ginger and garlic; cook until oil separates.', 'Add green chili and spices; simmer until tender.', 'Finish with fresh coriander.'], { country: 'PK', timeMinutes: 40 }),
  r('Beef Nihari', 'south_asian', 'dinner', ['beef shank', 'wheat flour', 'ginger', 'garlic', 'nihari masala', 'cooking oil'],
    ['Brown beef shank with ginger-garlic.', 'Add nihari masala and water; slow-cook until very tender.', 'Thicken gravy with a flour slurry.', 'Garnish with ginger and serve with naan.'], { country: 'PK', timeMinutes: 180 }),
  r('Chicken Haleem', 'south_asian', 'dinner', ['chicken', 'lentils', 'wheat', 'barley', 'ginger', 'garlic', 'garam masala'],
    ['Boil chicken with lentils, wheat and barley until soft.', 'Blend to a thick, smooth porridge.', 'Temper with fried onions and spices.', 'Top with ginger, lemon and coriander.'], { country: 'PK', timeMinutes: 150 }),
  r('Aloo Gosht', 'south_asian', 'lunch', ['lamb', 'potato', 'onion', 'tomato', 'ginger', 'garlic', 'cooking oil'],
    ['Brown lamb with onion, ginger and garlic.', 'Add tomato and spices; cook to a masala.', 'Add potato and water; simmer until both are tender.', 'Serve with roti or rice.'], { country: 'PK', timeMinutes: 75 }),
  r('Chapli Kebab', 'south_asian', 'supper', ['ground beef', 'tomato', 'onion', 'green chili', 'coriander', 'cornmeal'],
    ['Mix beef with chopped tomato, onion, chili and spices.', 'Bind with a little cornmeal.', 'Flatten into wide patties.', 'Shallow-fry until crisp and browned.'], { country: 'PK', timeMinutes: 30 }),
  r('Seekh Kebab', 'south_asian', 'supper', ['ground beef', 'onion', 'ginger', 'garlic', 'green chili', 'garam masala'],
    ['Knead beef with grated onion, ginger, garlic and spices.', 'Mould around skewers.', 'Grill or pan-sear, turning, until charred.', 'Serve with chutney.'], { country: 'PK', timeMinutes: 30 }),
  r('Chicken Biryani', 'south_asian', 'lunch', ['chicken', 'basmati rice', 'yogurt', 'onion', 'ginger', 'garlic', 'biryani masala'],
    ['Marinate chicken in yogurt and spices.', 'Par-boil rice with whole spices.', 'Layer chicken masala and rice.', 'Steam on dum until fragrant.'], { country: 'PK', timeMinutes: 75 }),
  r('Chana Pulao', 'south_asian', 'lunch', ['basmati rice', 'chickpeas', 'onion', 'cumin', 'whole spices', 'cooking oil'],
    ['Fry onion and whole spices in oil.', 'Add chickpeas and rice; toss.', 'Add water and cook until fluffy.', 'Rest, then fork through.'], { country: 'PK', timeMinutes: 40 }),
  r('Daal Chawal', 'south_asian', 'lunch', ['lentils', 'rice', 'onion', 'garlic', 'cumin', 'turmeric', 'cooking oil'],
    ['Boil lentils with turmeric until creamy.', 'Make a tarka of fried garlic and cumin.', 'Pour tarka over the daal.', 'Serve over steamed rice.'], { country: 'PK', timeMinutes: 40 }),
  r('Anda Paratha', 'south_asian', 'breakfast', ['eggs', 'wheat flour', 'butter', 'green chili', 'coriander'],
    ['Roll and griddle a flaky paratha with butter.', 'Whisk eggs with chili and coriander.', 'Cook the egg into a thin omelette.', 'Fold inside the warm paratha.'], { country: 'PK', timeMinutes: 20 }),
  r('Halwa Puri', 'south_asian', 'breakfast', ['semolina', 'wheat flour', 'chickpeas', 'sugar', 'cardamom', 'cooking oil'],
    ['Cook semolina halwa with sugar and cardamom.', 'Simmer a light chickpea curry.', 'Fry puffed puris until golden.', 'Serve the three together.'], { country: 'PK', timeMinutes: 50 }),
  r('Chana Chaat', 'south_asian', 'supper', ['chickpeas', 'potato', 'onion', 'tomato', 'tamarind', 'chaat masala'],
    ['Toss boiled chickpeas and potato.', 'Add chopped onion and tomato.', 'Dress with tamarind and chaat masala.', 'Finish with lemon.'], { country: 'PK', timeMinutes: 15 }),
  r('Vegetable Samosa', 'south_asian', 'supper', ['potato', 'peas', 'wheat flour', 'cumin', 'green chili', 'cooking oil'],
    ['Make a spiced potato-and-pea filling.', 'Wrap in pastry triangles.', 'Deep-fry until crisp and golden.', 'Serve with chutney.'], { country: 'PK', timeMinutes: 45 }),
  r('Sooji Halwa', 'south_asian', 'dessert', ['semolina', 'sugar', 'ghee', 'cardamom', 'almonds'],
    ['Toast semolina in ghee until golden.', 'Add sugar syrup carefully.', 'Cook until it pulls from the pan.', 'Finish with cardamom and almonds.'], { country: 'PK', timeMinutes: 25 }),
  r('Kheer', 'south_asian', 'dessert', ['rice', 'milk', 'sugar', 'cardamom', 'pistachio'],
    ['Simmer rice in milk until thick.', 'Sweeten with sugar.', 'Add cardamom.', 'Chill and top with pistachio.'], { country: 'PK', timeMinutes: 60 }),

  /* ---------------- South Asian — India ---------------- */
  r('Masala Dosa', 'south_asian', 'breakfast', ['rice', 'lentils', 'potato', 'onion', 'curry leaves', 'mustard seeds'],
    ['Ferment a rice-and-lentil batter.', 'Make a spiced potato filling.', 'Crisp the dosa on a hot griddle.', 'Fold the filling inside.'], { country: 'IN', timeMinutes: 40 }),
  r('Idli Sambar', 'south_asian', 'breakfast', ['rice', 'lentils', 'toor dal', 'tamarind', 'sambar powder', 'vegetables'],
    ['Steam fermented idli batter into cakes.', 'Cook dal with tamarind and vegetables.', 'Season with sambar powder.', 'Serve idli with hot sambar.'], { country: 'IN', timeMinutes: 45 }),
  r('Chole', 'south_asian', 'lunch', ['chickpeas', 'onion', 'tomato', 'ginger', 'garlic', 'chole masala'],
    ['Sauté onion, ginger and garlic.', 'Add tomato and chole masala.', 'Simmer chickpeas until rich.', 'Garnish with coriander.'], { country: 'IN', timeMinutes: 50 }),
  r('Rajma Chawal', 'south_asian', 'lunch', ['kidney beans', 'rice', 'onion', 'tomato', 'ginger', 'garam masala'],
    ['Cook kidney beans until soft.', 'Build an onion-tomato masala.', 'Simmer beans in the masala.', 'Serve over rice.'], { country: 'IN', timeMinutes: 60 }),
  r('Palak Paneer', 'south_asian', 'dinner', ['spinach', 'paneer', 'onion', 'garlic', 'cream', 'garam masala'],
    ['Blanch and blend spinach.', 'Fry onion and garlic.', 'Add spinach purée and cream.', 'Fold in pan-fried paneer.'], { country: 'IN', timeMinutes: 35 }),
  r('Vegetable Pulao', 'south_asian', 'lunch', ['basmati rice', 'mixed vegetables', 'cumin', 'whole spices', 'cooking oil'],
    ['Fry whole spices and cumin.', 'Add vegetables and rice.', 'Add water and steam until fluffy.', 'Rest and serve.'], { country: 'IN', timeMinutes: 35 }),
  r('Dal Tadka', 'south_asian', 'dinner', ['lentils', 'tomato', 'garlic', 'cumin', 'turmeric', 'ghee'],
    ['Boil lentils with turmeric and tomato.', 'Make a ghee tadka of garlic and cumin.', 'Stir the tadka through.', 'Serve with rice or roti.'], { country: 'IN', timeMinutes: 35 }),
  r('Aloo Tikki', 'south_asian', 'supper', ['potato', 'peas', 'green chili', 'cumin', 'breadcrumbs'],
    ['Mash potato with peas and spices.', 'Shape into patties.', 'Coat lightly and pan-fry.', 'Serve with chutney.'], { country: 'IN', timeMinutes: 25 }),
  r('Gajar Halwa', 'south_asian', 'dessert', ['carrot', 'milk', 'sugar', 'ghee', 'cardamom', 'almonds'],
    ['Simmer grated carrot in milk.', 'Add sugar and reduce.', 'Finish with ghee and cardamom.', 'Top with almonds.'], { country: 'IN', timeMinutes: 60 }),
  r('Mango Lassi', 'south_asian', 'drink', ['yogurt', 'mango', 'sugar', 'cardamom'],
    ['Blend yogurt and mango.', 'Sweeten to taste.', 'Add a pinch of cardamom.', 'Serve chilled.'], { country: 'IN', timeMinutes: 5 }),

  /* ---------------- Chinese ---------------- */
  r('Kung Pao Chicken', 'chinese', 'dinner', ['chicken', 'peanuts', 'scallion', 'garlic', 'ginger', 'dried chili', 'soy sauce'],
    ['Sear marinated chicken.', 'Fry aromatics and dried chili.', 'Toss with a savoury-sweet sauce.', 'Stir in peanuts and serve.'], { timeMinutes: 25 }),
  r('Mapo Tofu', 'chinese', 'dinner', ['tofu', 'ground pork', 'garlic', 'ginger', 'doubanjiang', 'scallion'],
    ['Fry pork with garlic and ginger.', 'Add doubanjiang and stock.', 'Slide in cubed tofu.', 'Finish with scallion.'], { timeMinutes: 25 }),
  r('Egg Fried Rice', 'chinese', 'lunch', ['rice', 'eggs', 'scallion', 'soy sauce', 'cooking oil'],
    ['Scramble eggs in a hot wok.', 'Add day-old rice and break up.', 'Season with soy sauce.', 'Toss through scallion.'], { timeMinutes: 15 }),
  r('Chicken Chow Mein', 'chinese', 'dinner', ['noodles', 'chicken', 'cabbage', 'carrot', 'soy sauce', 'garlic'],
    ['Stir-fry chicken until done.', 'Add vegetables and garlic.', 'Toss boiled noodles with soy sauce.', 'Combine and serve hot.'], { timeMinutes: 25 }),
  r('Sweet and Sour Pork', 'chinese', 'dinner', ['pork', 'bell pepper', 'pineapple', 'onion', 'vinegar', 'sugar'],
    ['Fry battered pork until crisp.', 'Stir-fry peppers, onion and pineapple.', 'Add a sweet-sour sauce.', 'Toss the pork through.'], { timeMinutes: 35 }),
  r('Congee', 'chinese', 'breakfast', ['rice', 'ginger', 'scallion', 'soy sauce'],
    ['Simmer rice in plenty of water.', 'Cook low until silky.', 'Season with ginger and soy.', 'Top with scallion.'], { timeMinutes: 60 }),
  r('Vegetable Spring Rolls', 'chinese', 'supper', ['cabbage', 'carrot', 'scallion', 'wheat flour', 'cooking oil'],
    ['Stir-fry shredded vegetables.', 'Wrap in thin pastry.', 'Deep-fry until crisp.', 'Serve with dipping sauce.'], { timeMinutes: 40 }),
  r('Mango Pudding', 'chinese', 'dessert', ['mango', 'milk', 'sugar', 'gelatin'],
    ['Blend mango with milk and sugar.', 'Set with gelatin.', 'Chill until firm.', 'Serve cold.'], { timeMinutes: 20 }),

  /* ---------------- Middle Eastern ---------------- */
  r('Chicken Shawarma', 'middle_eastern', 'dinner', ['chicken', 'yogurt', 'garlic', 'cumin', 'coriander', 'flatbread'],
    ['Marinate chicken in yogurt and spices.', 'Roast or pan-sear until charred.', 'Slice thin.', 'Wrap in flatbread with garlic sauce.'], { timeMinutes: 40 }),
  r('Falafel', 'middle_eastern', 'supper', ['chickpeas', 'garlic', 'cumin', 'coriander', 'parsley', 'cooking oil'],
    ['Blend soaked chickpeas with herbs and spices.', 'Shape into small patties.', 'Deep-fry until crisp.', 'Serve with tahini.'], { timeMinutes: 30 }),
  r('Hummus', 'middle_eastern', 'appetizer', ['chickpeas', 'tahini', 'garlic', 'lemon', 'olive oil'],
    ['Blend chickpeas with tahini and garlic.', 'Loosen with lemon and water.', 'Whip until smooth.', 'Drizzle with olive oil.'], { timeMinutes: 15 }),
  r('Tabbouleh', 'middle_eastern', 'appetizer', ['bulgur', 'parsley', 'tomato', 'mint', 'lemon', 'olive oil'],
    ['Soak bulgur until tender.', 'Chop parsley, mint and tomato finely.', 'Toss together.', 'Dress with lemon and olive oil.'], { timeMinutes: 25 }),
  r('Lamb Kofta', 'middle_eastern', 'dinner', ['ground lamb', 'onion', 'parsley', 'cumin', 'cinnamon'],
    ['Knead lamb with onion, parsley and spices.', 'Shape around skewers.', 'Grill until charred.', 'Serve with flatbread.'], { timeMinutes: 30 }),
  r('Shakshuka', 'middle_eastern', 'breakfast', ['eggs', 'tomato', 'bell pepper', 'onion', 'cumin', 'paprika'],
    ['Simmer a spiced tomato-pepper sauce.', 'Make wells and crack in eggs.', 'Cover until just set.', 'Serve from the pan with bread.'], { timeMinutes: 25 }),
  r('Mujadara', 'middle_eastern', 'lunch', ['lentils', 'rice', 'onion', 'cumin', 'olive oil'],
    ['Cook lentils until almost done.', 'Add rice and cumin.', 'Fry onions until deep brown.', 'Fold onions through and serve.'], { timeMinutes: 45 }),
  r('Baked Fruit with Honey', 'middle_eastern', 'dessert', ['apple', 'honey', 'cinnamon', 'walnuts'],
    ['Halve and core the fruit.', 'Drizzle with honey and cinnamon.', 'Bake until soft.', 'Top with walnuts.'], { timeMinutes: 25 }),

  /* ---------------- Mediterranean ---------------- */
  r('Grilled Lemon Fish', 'mediterranean', 'dinner', ['white fish', 'lemon', 'garlic', 'olive oil', 'oregano'],
    ['Marinate fish in lemon, garlic and oregano.', 'Grill until just cooked.', 'Rest briefly.', 'Finish with olive oil.'], { timeMinutes: 25 }),
  r('Greek Salad', 'mediterranean', 'appetizer', ['tomato', 'cucumber', 'feta', 'olives', 'onion', 'olive oil'],
    ['Chop tomato, cucumber and onion.', 'Add olives and feta.', 'Dress with olive oil and oregano.', 'Toss gently.'], { timeMinutes: 15 }),
  r('Chickpea Stew', 'mediterranean', 'lunch', ['chickpeas', 'tomato', 'onion', 'garlic', 'spinach', 'olive oil'],
    ['Soften onion and garlic in olive oil.', 'Add tomato and chickpeas.', 'Simmer until rich.', 'Wilt in spinach.'], { timeMinutes: 35 }),
  r('Pasta Pomodoro', 'mediterranean', 'dinner', ['pasta', 'tomato', 'garlic', 'basil', 'olive oil'],
    ['Simmer a simple tomato-garlic sauce.', 'Cook pasta al dente.', 'Toss together with basil.', 'Finish with olive oil.'], { timeMinutes: 25 }),
  r('White Bean Breakfast Skillet', 'mediterranean', 'breakfast', ['white beans', 'tomato', 'onion', 'olive oil', 'paprika'],
    ['Soften onion in olive oil.', 'Add tomato and paprika.', 'Stir in white beans.', 'Simmer and serve with bread.'], { timeMinutes: 25 }),
  r('Roasted Vegetable Bowl', 'mediterranean', 'lunch', ['zucchini', 'bell pepper', 'chickpeas', 'couscous', 'olive oil', 'lemon'],
    ['Roast vegetables and chickpeas.', 'Steam couscous.', 'Combine in a bowl.', 'Dress with lemon and olive oil.'], { timeMinutes: 35 }),
  r('Yogurt with Honey and Fruit', 'mediterranean', 'dessert', ['yogurt', 'honey', 'orange', 'walnuts'],
    ['Spoon yogurt into bowls.', 'Top with orange segments.', 'Drizzle with honey.', 'Scatter walnuts.'], { timeMinutes: 5 }),

  /* ---------------- East Asian ---------------- */
  r('Chicken Teriyaki', 'east_asian', 'dinner', ['chicken', 'soy sauce', 'ginger', 'garlic', 'sugar', 'rice'],
    ['Sear chicken until golden.', 'Add a soy-ginger glaze.', 'Reduce until glossy.', 'Serve over rice.'], { timeMinutes: 25 }),
  r('Miso Soup', 'east_asian', 'breakfast', ['miso', 'tofu', 'scallion', 'seaweed'],
    ['Warm dashi or water.', 'Whisk in miso.', 'Add tofu and seaweed.', 'Finish with scallion.'], { timeMinutes: 15 }),
  r('Vegetable Bibimbap', 'east_asian', 'lunch', ['rice', 'spinach', 'carrot', 'egg', 'sesame oil', 'gochujang'],
    ['Cook rice and assorted vegetables.', 'Fry an egg.', 'Arrange over rice.', 'Serve with gochujang and sesame oil.'], { timeMinutes: 35 }),
  r('Tofu Stir-fry', 'east_asian', 'dinner', ['tofu', 'broccoli', 'garlic', 'ginger', 'soy sauce', 'sesame oil'],
    ['Pan-fry tofu until golden.', 'Stir-fry broccoli with aromatics.', 'Add soy sauce.', 'Toss and finish with sesame oil.'], { timeMinutes: 25 }),
  r('Edamame', 'east_asian', 'appetizer', ['edamame', 'salt'],
    ['Boil edamame in salted water.', 'Drain.', 'Toss with flaky salt.', 'Serve warm.'], { timeMinutes: 10 }),
  r('Matcha Fruit Bowl', 'east_asian', 'dessert', ['banana', 'orange', 'honey'],
    ['Slice fruit into a bowl.', 'Drizzle lightly with honey.', 'Chill briefly.', 'Serve.'], { timeMinutes: 10 }),

  /* ---------------- American ---------------- */
  r('Grilled Chicken and Veg', 'american', 'dinner', ['chicken', 'zucchini', 'bell pepper', 'olive oil', 'black pepper'],
    ['Season and grill chicken.', 'Grill the vegetables alongside.', 'Rest the chicken.', 'Plate together.'], { timeMinutes: 30 }),
  r('Turkey Chili', 'american', 'lunch', ['ground turkey', 'kidney beans', 'tomato', 'onion', 'cumin', 'paprika'],
    ['Brown turkey with onion.', 'Add tomato, beans and spices.', 'Simmer until thick.', 'Serve hot.'], { timeMinutes: 45 }),
  r('Veggie Omelette', 'american', 'breakfast', ['eggs', 'spinach', 'tomato', 'cheese', 'butter'],
    ['Whisk eggs.', 'Cook gently in butter.', 'Add spinach, tomato and cheese.', 'Fold and serve.'], { timeMinutes: 15 }),
  r('Bean Burrito Bowl', 'american', 'lunch', ['rice', 'black beans', 'corn', 'tomato', 'avocado', 'lime'],
    ['Build a base of rice and beans.', 'Add corn and tomato.', 'Top with avocado.', 'Finish with lime.'], { timeMinutes: 20 }),
  r('Baked Salmon', 'american', 'dinner', ['salmon', 'lemon', 'garlic', 'olive oil', 'black pepper'],
    ['Season salmon with lemon and garlic.', 'Bake until just flaky.', 'Rest briefly.', 'Serve with greens.'], { timeMinutes: 25 }),
  r('Fruit and Yogurt Parfait', 'american', 'dessert', ['yogurt', 'mixed berries', 'honey', 'oats'],
    ['Layer yogurt and berries.', 'Add a little honey.', 'Top with oats.', 'Chill and serve.'], { timeMinutes: 10 }),

  /* ---------------- European ---------------- */
  r('Chicken Cacciatore', 'european', 'dinner', ['chicken', 'tomato', 'onion', 'bell pepper', 'garlic', 'olive oil'],
    ['Brown chicken pieces.', 'Soften onion, pepper and garlic.', 'Add tomato and braise.', 'Serve with bread.'], { timeMinutes: 50 }),
  r('Vegetable Frittata', 'european', 'breakfast', ['eggs', 'potato', 'onion', 'spinach', 'olive oil'],
    ['Sauté potato and onion.', 'Add whisked eggs and spinach.', 'Cook until set.', 'Finish under a grill.'], { timeMinutes: 30 }),
  r('White Bean Soup', 'european', 'lunch', ['white beans', 'carrot', 'onion', 'garlic', 'olive oil', 'thyme'],
    ['Soften onion, carrot and garlic.', 'Add beans and stock.', 'Simmer with thyme.', 'Blend partly and serve.'], { timeMinutes: 40 }),
  r('Pan-Roasted Pork', 'european', 'dinner', ['pork', 'potato', 'garlic', 'rosemary', 'olive oil'],
    ['Sear pork with garlic and rosemary.', 'Roast with potatoes.', 'Rest the meat.', 'Slice and serve.'], { timeMinutes: 45 }),
  r('Lentil Stew', 'european', 'lunch', ['lentils', 'carrot', 'celery', 'onion', 'tomato', 'olive oil'],
    ['Soften the vegetables.', 'Add lentils and tomato.', 'Simmer until tender.', 'Season and serve.'], { timeMinutes: 40 }),
  r('Baked Apple', 'european', 'dessert', ['apple', 'butter', 'cinnamon', 'oats', 'honey'],
    ['Core the apples.', 'Fill with oats, butter and cinnamon.', 'Bake until soft.', 'Drizzle with honey.'], { timeMinutes: 35 }),

  /* ---------------- Latin ---------------- */
  r('Chicken Tinga Tacos', 'latin', 'dinner', ['chicken', 'tomato', 'onion', 'chipotle', 'corn tortilla', 'lime'],
    ['Cook and shred chicken.', 'Blend a smoky tomato-chipotle sauce.', 'Simmer chicken in the sauce.', 'Serve in warm tortillas with lime.'], { timeMinutes: 35 }),
  r('Black Bean Bowl', 'latin', 'lunch', ['black beans', 'rice', 'corn', 'tomato', 'avocado', 'lime'],
    ['Warm beans with spices.', 'Build over rice.', 'Add corn and tomato.', 'Top with avocado and lime.'], { timeMinutes: 20 }),
  r('Huevos Rancheros', 'latin', 'breakfast', ['eggs', 'corn tortilla', 'tomato', 'beans', 'chili'],
    ['Warm tortillas.', 'Fry eggs.', 'Top with a tomato-chili salsa.', 'Serve with beans.'], { timeMinutes: 20 }),
  r('Fish Ceviche', 'latin', 'appetizer', ['white fish', 'lime', 'onion', 'tomato', 'coriander', 'chili'],
    ['Dice fish finely.', 'Cure in lime juice.', 'Mix in onion, tomato and chili.', 'Finish with coriander.'], { timeMinutes: 25 }),
  r('Vegetable Quesadilla', 'latin', 'supper', ['wheat tortilla', 'cheese', 'bell pepper', 'onion', 'corn'],
    ['Sauté pepper, onion and corn.', 'Fill a tortilla with cheese and veg.', 'Griddle until melting.', 'Cut and serve.'], { timeMinutes: 20 }),
  r('Grilled Pineapple', 'latin', 'dessert', ['pineapple', 'butter', 'cinnamon', 'sugar'],
    ['Slice pineapple.', 'Brush with butter.', 'Grill until caramelized.', 'Dust with cinnamon sugar.'], { timeMinutes: 15 }),

  /* ---------------- African ---------------- */
  r('Chicken Peanut Stew', 'african', 'dinner', ['chicken', 'peanuts', 'tomato', 'onion', 'ginger', 'cooking oil'],
    ['Brown chicken with onion and ginger.', 'Add tomato and peanut butter.', 'Simmer until rich.', 'Serve with rice.'], { timeMinutes: 50 }),
  r('Jollof Rice', 'african', 'lunch', ['rice', 'tomato', 'onion', 'bell pepper', 'cooking oil', 'spices'],
    ['Blend a tomato-pepper base.', 'Fry it down with onion.', 'Add rice and stock.', 'Steam until done.'], { timeMinutes: 50 }),
  r('Berbere Lentils', 'african', 'lunch', ['lentils', 'onion', 'garlic', 'ginger', 'berbere', 'cooking oil'],
    ['Soften onion, garlic and ginger.', 'Bloom berbere spice.', 'Add lentils and water.', 'Simmer until soft.'], { timeMinutes: 40 }),
  r('Shakshuka-style Eggs', 'african', 'breakfast', ['eggs', 'tomato', 'onion', 'bell pepper', 'cumin'],
    ['Cook a spiced tomato-pepper base.', 'Make wells for eggs.', 'Cover until set.', 'Serve with bread.'], { timeMinutes: 25 }),
  r('Spiced Fruit Salad', 'african', 'dessert', ['mango', 'banana', 'orange', 'lime', 'mint'],
    ['Chop the fruit.', 'Toss with lime.', 'Add torn mint.', 'Chill and serve.'], { timeMinutes: 10 }),
];

let memo: TaggedRecipe[] | null = null;

/** The tagged corpus — computed once, deterministically, on first use. */
export function getCorpus(): TaggedRecipe[] {
  if (!memo) memo = RAW.map(tagRecipe);
  return memo;
}

/** Total seed-corpus size (for diagnostics / about screens). */
export const CORPUS_SIZE = RAW.length;
