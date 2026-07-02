## Migration status audit (last ~2 days)

I checked every migration file dated 20260701 or later against the live database. Some were applied out-of-band via the SQL editor (so they're not tracked in `schema_migrations` but their objects exist); most of the newer ones are **not applied**.

### Applied on live (verified by object existence)
- `20260701003422_..._friend_suggestions_rr_and_dismiss` — `friend_suggestion_dismissals` table + `dismiss_friend_suggestion` RPC exist
- `20260702000000_invite_code_expiry_and_audit_log` — `group_invites.expires_at` column exists
- `20260703000000_friend_suggestions_rr_and_dismiss` — same objects as above (idempotent duplicate)

### NOT applied on live — needs to be run
| File | What it adds | Frontend impact until applied |
|---|---|---|
| `20260703120000_pulse_rating_algorithm_fixes.sql` | Pulse rating algorithm corrections | Ratings continue calculating with old formula |
| `20260703130000_new_player_self_rating.sql` | `profiles.self_rating` col + `set_new_player_self_rating` RPC | New-player self-rating UI writes will fail |
| `20260703140000_incremental_rating_updates.sql` | `apply_incremental_rating_update` RPC | Incremental rating recompute path fails |
| `20260703150000_league_management_foundation.sql` | `leagues`, `league_teams`, `league_members`, etc. | Entire league feature is broken (no tables) |
| `20260703160000_league_matches_scores.sql` | `league_matches` + score columns | League match creation/queries fail |
| `20260703170000_leagues_player_read_policies.sql` | Player-facing RLS on league tables | Player league views return empty/permission errors |
| `20260703180000_league_invite_codes.sql` | League invite code RPCs | Join-by-code fails |
| `20260703190000_league_teammate_visibility.sql` | Teammate visibility policy | Roster views incomplete |
| `20260703200000_league_teams_visibility_for_standings.sql` | Standings visibility policy | Standings blank |
| `20260703210000_league_match_score_flow.sql` | `submit_league_match_score` RPC + flow | Score submission fails |

### Recommendation
Apply the 10 missing migration files above to live, **in filename order**, via the Supabase SQL editor. They're standard idempotent-style Lovable migrations; each depends on the previous league one, so order matters within the `league_*` group. Nothing else in the codebase needs to change — the frontend is already written against these objects.

Want me to (a) generate a single consolidated SQL bundle you can paste into the SQL editor, or (b) re-issue each migration individually through the approval flow so they land tracked in `schema_migrations`?