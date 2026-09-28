# Venue address automation

Venue settings → Integrations reserves a permanent `<name>.pulsepb.com` address.
The **Connect venue addresses** GitHub Actions workflow processes due requests
about every 15 minutes, after successful frontend releases, and on manual runs.
GitHub scheduled runs can be delayed. No admin browser session is needed.

The worker uses the existing production Supabase Management API and Firebase
Hosting service account secrets directly. It does not depend on copying the
Firebase credential into Supabase Edge secrets. An optional existing manual
Edge endpoint remains available to installations that configured that secret.

## One-time DNS connection

1. Sign in to the [GoDaddy developer portal](https://developer.godaddy.com/en/personal-access-token)
   with the account managing `pulsepb.com`.
2. Create a production personal access token with domain read and DNS update
   access (`domains.domain:read`, `domains.dns:update`). Restrict it to
   `pulsepb.com` if the account offers resource restrictions. No domain purchase,
   transfer, deletion, or contact modification access is needed. Confirm the
   account supports production DNS API access. Record the token's expiry date.
3. Save its value as the GitHub Actions repository secret **GODADDY_DNS_TOKEN**
   in `akhourybsu-cmd/pulse-pickleball`. Do not place it in source, browser code,
   chat, logs, or a Supabase public setting.
4. In the PULSE platform admin venue address panel, queue a check, or wait for
   the next automatic retry. You can also run **Connect venue addresses** in
   GitHub Actions. A newly configured token does not override a retry backoff.

Without the DNS secret, hosting is still provisioned and checked automatically;
the admin panel shows the exact Firebase DNS instructions and the missing setup
step. The venue manager sees a plain-language progress message.

## Boundaries and recovery

- Only active, ownership-verified, real venues are processed. Visibility and
  publication settings are never changed. A connected private page stays private.
- A 15-minute lease and completion token fence duplicate or stale runs. A killed
  worker can retry after the lease expires. Up to 10 due addresses run per batch.
- Provisioning retries after 10 minutes, action-required after an hour, and
  errors use increasing delays up to 320 minutes. Connected domains are checked
  daily. State changes are audited as system actions, without impersonating users.
- GoDaddy v3 adds individual records only. Existing identical records are skipped.
  Only A, AAAA, CNAME, and TXT additions at the reserved venue host or its
  `_acme-challenge` name can be automated. Conflicts, removals, apex/shared records,
  and incomplete DNS reads require admin review. No whole-zone replacement occurs.
- A successful DNS write does not mean connected. Firebase must confirm hosting,
  ownership, and an active HTTPS certificate with no outstanding records or issues.
- Provider failures remain visible in the admin panel. The workflow logs only
  aggregate counts, not venue names, credentials, or DNS verification values.
- Rotate the GoDaddy secret before expiry. HTTP 401/403 in the admin panel means
  API access, scopes, or token expiry need review. The next check retries safely.

Firebase warns about certificate issuance limits when scaling beyond roughly
20 subdomains per apex. Review the hosting architecture before expanding to
hundreds of venue subdomains; the canonical `pulsepb.com/venues/<slug>` links
remain available without individual certificates.

References: [Firebase custom domains](https://firebase.google.com/docs/hosting/custom-domain),
[GoDaddy DNS records API](https://developer.godaddy.com/en/docs/references/rest/domains/v3/records).
