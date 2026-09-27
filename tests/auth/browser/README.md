# Connection recovery preview

Run `node node_modules/vite/bin/vite.js --config tests/auth/browser/vite.config.ts --host 127.0.0.1 --port 5196 --strictPort`.

Open `/tests/auth/browser/index.html?scenario=session` or `?scenario=profile`. The real AuthStateProvider and AuthGuard run under React StrictMode with a local backend adapter that deliberately never resolves the selected request. After 15 seconds, the loading screen must offer Retry connection and Reload PULSE. Choose Restore mock connection, then Retry connection: player information must load. The two scenarios use separate fixture identities so a cached profile does not hide a cold-start timeout. No live account or network service is used.

For draft continuity, open `?scenario=resume`. Edit both Event name and Unfinished
notes, then use Return to app, Renew session token, Return with connection
unavailable, and Reconnect session. Both fields and the form instance must remain
unchanged. The return button reproduces the SDK's same-account SIGNED_IN event.
The automated `auth-provider-continuity.test.tsx` additionally covers real
visibility events, periodic checks, requests in flight, sign-out, account changes,
and an explicit server verification denial.
