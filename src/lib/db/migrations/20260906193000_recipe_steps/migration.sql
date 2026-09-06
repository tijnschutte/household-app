-- Instructions become ordered steps. Existing text is split on line breaks,
-- trimmed, and blank pieces dropped, so a recipe written as paragraphs
-- becomes one step per paragraph.
ALTER TABLE "Recipe" ADD COLUMN "steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Recipe"
SET "steps" = COALESCE(
  (
    SELECT array_agg(btrim(piece) ORDER BY ordinality)
    FROM unnest(regexp_split_to_array("instructions", E'\\n+')) WITH ORDINALITY AS t(piece, ordinality)
    WHERE btrim(piece) <> ''
  ),
  ARRAY[]::TEXT[]
);

ALTER TABLE "Recipe" DROP COLUMN "instructions";
