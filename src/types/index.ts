/**
 * Shared application-wide types.
 *
 * Database types will be generated here via the Supabase CLI once the
 * schema exists:
 *
 *   npx supabase gen types typescript --project-id <project-id> \
 *     > src/types/database.ts
 */

export type Nullable<T> = T | null;
