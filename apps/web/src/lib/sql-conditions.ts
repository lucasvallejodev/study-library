import 'server-only';

import { and, sql, type SQL } from 'drizzle-orm';

/** Builds one optional `where` condition from a list filter, or `undefined` when it does not apply. */
export type ConditionBuilder<Filter> = (filter: Filter) => SQL | undefined;

/**
 * Combines the conditions that apply to a filter with `and`.
 *
 * @param builders - One builder per filter field.
 * @param filter - The filter to translate.
 * @returns The combined condition, or `undefined` (no `where`) when none applies.
 */
export const whereAll = <Filter>(
  builders: ConditionBuilder<Filter>[],
  filter: Filter
): SQL | undefined => {
  const conditions = builders
    .map(build => build(filter))
    .filter((condition): condition is SQL => condition !== undefined);

  return conditions.length ? and(...conditions) : undefined;
};

/**
 * Selects `count(*)` as a JavaScript number.
 *
 * @returns The SQL expression, cast to `int` so the driver does not return a string.
 */
export const countRows = (): SQL<number> => sql<number>`count(*)::int`;
