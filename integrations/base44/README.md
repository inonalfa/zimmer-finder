# Optional: Base44 backend

The default setup needs no backend: data is a JSON file and the site is static. If you already use
[Base44](https://base44.com) and want its hosted database instead, this folder has what you need.

1. Create a Base44 code-first app and copy `entities/` and `functions/` from here into its `base44/` folder.
2. Push records with your agent (one `Zimmer` record per entry in `data/zimmers.json`, upsert by `slug`).
3. In `trip.config.json`:

```json
"storage": {
  "data":  { "adapter": "base44", "app_id": "<your app id>" },
  "votes": { "adapter": "base44", "app_id": "<your app id>" }
}
```

The browser loads the Base44 SDK from a CDN only when this adapter is selected, so the default build has
no Base44 dependency. Votes go through the `zimmer-vote` function, which validates the slug, the vote and
the name length; the votes table itself is admin-write only.
