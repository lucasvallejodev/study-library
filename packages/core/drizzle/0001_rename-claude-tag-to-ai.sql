UPDATE "annotations"
SET "tags" = (
  SELECT jsonb_agg("tag" ORDER BY "position")
  FROM (
    SELECT DISTINCT ON ("tag") "tag", "position"
    FROM jsonb_array_elements_text("annotations"."tags") WITH ORDINALITY AS "element"("original", "position")
    CROSS JOIN LATERAL (
      SELECT CASE WHEN "original" = 'claude' THEN 'ai' ELSE "original" END AS "tag"
    ) AS "renamed"
    ORDER BY "tag", "position"
  ) AS "unique_tags"
)
WHERE "tags" ? 'claude';
