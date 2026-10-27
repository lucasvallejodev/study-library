import { migrateDatabase } from './migrate';

await migrateDatabase();
console.log('Migrations applied.');
