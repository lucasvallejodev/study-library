/**
 * Postgres `onnotice` handler that discards server notices (such as "relation already
 * exists, skipping") so they do not clutter the console.
 *
 * @returns Nothing.
 */
export const ignoreNotice = (): void => undefined;
