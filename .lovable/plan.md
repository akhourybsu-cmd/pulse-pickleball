## Root cause

The match wizard submission fails on the **`match_approvals` insert step** because of an overly strict RLS policy.

In `src/components/match-wizard/MatchWizardContainer.tsx` (step 5 of `handleSubmit`) the creator inserts one approval row **for every real player in the match** — themselves plus opponents/partners. But the only INSERT policy on `match_approvals` is:

```
with_check: auth.uid() = player_id
```

So any row whose `player_id` is not the current user is rejected by RLS, which fails the whole batch insert and surfaces as a generic "Failed to record match" toast. (The earlier `matches` and `match_participants` inserts succeed, which is why the user sees the error only on final submit — and orphan rows are likely left behind.)

The other parts of the flow check out:
- `matches` INSERT policy (`auth.uid() IS NOT NULL`) — fine.
- `match_participants` INSERT policy already allows match creators to insert rows for any participant.
- All triggers on `matches` are gated on `status = 'approved'`/`'completed'`, and the wizard inserts `status = 'pending'`, so none of them fire destructively.
- `guest_match_players` policy allows match creators to insert — fine.

## Fix

Add a second INSERT policy on `match_approvals` that mirrors the pattern already used for `match_participants`: the creator of the match can insert approval rows for any player in that match. Keep the existing self-insert policy so players can still create their own approval row when a match was created by someone else.

New policy (migration):

```sql
CREATE POLICY "Match creators can insert approvals for their match"
ON public.match_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_approvals.match_id
      AND m.created_by = auth.uid()
  )
);
```

No GRANT change needed — `match_approvals` already has the standard role grants.

## Defensive client cleanup (same file)

While I'm in `MatchWizardContainer.tsx`, harden `handleSubmit` so a future RLS failure doesn't leave orphan rows and so the user sees the real Postgres error:

1. Check the result of the `match_approvals` insert (currently the error is swallowed) and `throw` on failure.
2. On any thrown error after the `matches` row is created, delete the orphan match (`supabase.from('matches').delete().eq('id', match.id)`) before showing the toast.
3. Surface `error.message` plus `error.details`/`error.hint` in the console log so the next regression is diagnosable.

No UI, wizard step, or data-shape changes.

## Files touched

- New migration: add the `Match creators can insert approvals for their match` policy on `public.match_approvals`.
- `src/components/match-wizard/MatchWizardContainer.tsx`: check approval-insert error, roll back the match row on failure, log richer error info.

## Verification

1. Record a doubles match with three other real players → submit → toast `Match submitted — pending player verification.`, redirect to `/player/matches?tab=pending`, one row in `matches`, four rows in `match_participants`, four rows in `match_approvals` (creator `approved = true`, others `null`).
2. Record a singles match with one guest opponent → succeeds, one `guest_match_players` row, one `match_approvals` row (creator only).
3. Force a failure (e.g. temporarily revoke `match_participants` insert) → no orphan `matches` row remains and the toast shows the real error.
