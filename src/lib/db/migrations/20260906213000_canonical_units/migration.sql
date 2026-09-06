-- Units get one spelling (recepten/units.ts). Existing rows are brought in
-- line so a recipe saved as "gram" still adds up with a line saved as "g".
UPDATE "RecipeIngredient" SET "unit" = CASE lower(btrim("unit"))
  WHEN 'gr' THEN 'g' WHEN 'gram' THEN 'g' WHEN 'grams' THEN 'g' WHEN 'grammen' THEN 'g'
  WHEN 'kilo' THEN 'kg' WHEN 'kilogram' THEN 'kg'
  WHEN 'milliliter' THEN 'ml'
  WHEN 'liter' THEN 'l' WHEN 'liters' THEN 'l'
  WHEN 'eetlepel' THEN 'el' WHEN 'eetlepels' THEN 'el'
  WHEN 'theelepel' THEN 'tl' WHEN 'theelepels' THEN 'tl'
  WHEN 'stuk' THEN 'stuks' WHEN 'st' THEN 'stuks'
  ELSE lower(btrim("unit")) END
WHERE "unit" IS NOT NULL;

UPDATE "Grocery" SET "unit" = CASE lower(btrim("unit"))
  WHEN 'gr' THEN 'g' WHEN 'gram' THEN 'g' WHEN 'grams' THEN 'g' WHEN 'grammen' THEN 'g'
  WHEN 'kilo' THEN 'kg' WHEN 'kilogram' THEN 'kg'
  WHEN 'milliliter' THEN 'ml'
  WHEN 'liter' THEN 'l' WHEN 'liters' THEN 'l'
  WHEN 'eetlepel' THEN 'el' WHEN 'eetlepels' THEN 'el'
  WHEN 'theelepel' THEN 'tl' WHEN 'theelepels' THEN 'tl'
  WHEN 'stuk' THEN 'stuks' WHEN 'st' THEN 'stuks'
  ELSE lower(btrim("unit")) END
WHERE "unit" IS NOT NULL;
