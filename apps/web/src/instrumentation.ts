export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { prepareServer } = await import('./lib/server-startup');

  await prepareServer();
}
