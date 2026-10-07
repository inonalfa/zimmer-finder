# Shared votes with Supabase (free tier)

By default votes are stored in the browser (`"adapter": "local"`). That is perfect for one device, but
two people on two phones will not see each other's likes. For shared votes and "matches", connect a free
[Supabase](https://supabase.com) project. It takes about five minutes.

## 1. Create the table

In the Supabase dashboard open **SQL Editor** and run:

```sql
create table if not exists public.zimmer_votes (
  trip_id     text not null default 'default' check (char_length(trip_id) between 1 and 80),
  zimmer_slug text not null check (char_length(zimmer_slug) between 1 and 120),
  voter_name  text not null check (char_length(voter_name) between 1 and 30),
  vote        text not null check (vote in ('like', 'unlike')),
  updated_at  timestamptz not null default now(),
  primary key (trip_id, zimmer_slug, voter_name)
);

alter table public.zimmer_votes enable row level security;

-- Anyone who knows the trip id can read and vote (there is no login in the app).
create policy "read votes"   on public.zimmer_votes for select using (true);
create policy "insert votes" on public.zimmer_votes for insert with check (true);
create policy "update votes" on public.zimmer_votes for update using (true) with check (true);
create policy "delete votes" on public.zimmer_votes for delete using (true);
```

## 2. Point the app at it

Copy the **Project URL** and the **anon public** key from *Project Settings > API*, then either edit
`trip.config.json`:

```json
"votes": {
  "adapter": "supabase",
  "url": "https://YOUR-PROJECT.supabase.co",
  "anon_key": "YOUR-ANON-KEY",
  "trip_id": "a-long-random-string-only-you-share"
}
```

or keep them out of the repo and set GitHub repository **variables** used by the deploy workflow:
`VITE_VOTES_ADAPTER=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VOTES_TRIP_ID`.

## Security notes

- The anon key is designed to be public, but with the policies above **anyone who has your site and trip id
  can vote under any name**. Use a long random `trip_id` and share the link only with your travel partners.
- Never put the `service_role` key in the app or the repo.
- With these policies the anon key can read the votes of every trip in the table. Votes contain only a display name, a slug and like/unlike, so use a separate Supabase project if that matters to you.
