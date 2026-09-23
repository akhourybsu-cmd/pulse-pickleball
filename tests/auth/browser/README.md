# Connection recovery preview

Run `node node_modules/vite/bin/vite.js --config tests/auth/browser/vite.config.ts --host 127.0.0.1 --port 5196 --strictPort`.

Open `/tests/auth/browser/index.html?scenario=session` or `?scenario=profile`. The real AuthStateProvider and AuthGuard run under React StrictMode with a local backend adapter that deliberately never resolves the selected request. After 15 seconds, the loading screen must offer Retry connection and Reload PULSE. Choose Restore mock connection, then Retry connection: player information must load. The two scenarios use separate fixture identities so a cached profile does not hide a cold-start timeout. No live account or network service is used.
