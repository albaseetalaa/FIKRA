Supabase Migrations
===================

This project uses SQL migrations stored in `supabase/migrations`.

Prerequisites
- Install Supabase CLI.
- Authenticate and link the project.

Apply migrations
1. `supabase login`
2. `supabase link --project-ref <your-project-ref>`
3. `supabase db push`

Run locally against local Supabase
1. `supabase start`
2. `supabase db reset`

Migration included
- `20260726100000_ai_workflow_persistence.sql`

Environment variables for runtime
- `AI_PERSISTENCE_PROVIDER=supabase`
- `SUPABASE_URL=<https://your-project.supabase.co>`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`

Notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- API routes and server workflow code use service-role access only on the server.
