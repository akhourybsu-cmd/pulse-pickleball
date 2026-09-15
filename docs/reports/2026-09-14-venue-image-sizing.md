# Venue image sizing and upload verification

Status: published to production September 14, 2026 (America/New_York). No database migration, production media changes, Stripe changes, Android Studio or Google Play work.

## Production release

- Application commit: `79bf23380f011f41daff3d2858883ade96b0a8e3`, pushed to `main` with explicit publication approval.
- [Firebase deployment run 34916700060](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34916700060), job `104215769138`: successful. CI confirmed 1,225 passing tests, 32 skipped, 10 todo and a successful 4,715-module production build.
- Firebase Hosting version: `1533379be90e5ef4`.
- The live ELEVENO route returned HTTP 200 using `/assets/index-DiLxJdm6.js` and `/assets/index-Bx0M_cKU.css`, matching the CI build.
- Entry JavaScript, stylesheet, `VenueCommunity-GnmL88e4.js`, `GroupManage-BLiejjDe.js` and `GroupDetail-DqMMi8dj.js` returned HTTP 200 and matched the locally verified build content exactly.
- `/manifest.json` returned HTTP 200 with standalone display; `/sw.js` returned JavaScript with no-cache/no-store/revalidation headers. Existing PWA installations may need a reload/reopen to activate the update.
- Production checks confirm release delivery, not live authenticated storage writes or physical-device acceptance. No existing venue image was replaced during verification.

## Changes

- Responsive, bounded banner frames use real images with explicit contain/cover and focal-point behavior. Intrinsic image dimensions cannot stretch the page. Missing or broken images have deliberate fallbacks.
- Full-photo mode places the paid venue name and avatar below the banner, avoiding the filled-banner title overlay. Free venue communities display a compact separate banner, omitted in chat to preserve messaging space.
- Venue avatars share saved fit and shape in player headers, venue lists, paid venue chat and the entrance. Full-logo mode includes safe padding so a circular mask does not cut off square-image corners. Existing explicit fill/crop choices remain supported.
- Owner settings show representative phone/desktop image previews, always-visible upload controls, resolution/format guidance and a clear distinction between immediately saved uploads and display settings that require Save venue profile.
- Banner uploads retain their aspect ratio at up to 2880px; logos are capped at 1024px. No source is upscaled. High-quality canvas resampling preserves transparency, and the stored extension follows the browser encoder's actual MIME type.
- Uploads use unique immutable filenames and require a confirmed updated venue row before removing the previous file. Explicit database rejection cleans the new file only; ambiguous network outcomes retain both files. Cleanup is restricted to the same venue path. Concurrent upload/removal and profile-save actions are guarded. Private sample public-upload restrictions remain intact.
- Public discovery now loads venue identity settings, so the saved venue logo is not replaced by a stale community icon.

## Verification

- Full suite: **1,225 passed**, 32 skipped, 10 todo; 98 passing files and 3 skipped. Nineteen new tests cover preparation geometry, file validation, safe persistence, circular containment, list identity and full-photo header placement.
- Production build succeeded (4,715 modules); final compact free-venue placement rechecked in the production build.
- Focused ESLint passed for new/rewritten image components, upload logic and tests. Existing no-explicit-any lint errors remain in useGroups/GroupDetail; the BrandMark file retains its pre-existing Fast Refresh export warning.
- TypeScript check remains blocked by existing unrelated diagnostics; the newly introduced venue-join typing issue was corrected and a rerun reported no errors in touched files.
- Local isolated fixture ran the real file chooser, image decoder/resizer and owner upload handlers against in-memory storage only. Banner upload decoded 1200×630; a 1600×896 transparent logo normalized proportionally to 1024×573. Saved fit/shape options reflected immediately in both previews. A simulated save failure kept the old banner URL. No live Supabase upload was performed.
- Owner editor: 280, 320, 390, 430, 768, 1024, 1440 and 1920px, including dark mode and 125% text. No horizontal document overflow or out-of-bounds image/button/input elements.
- Paid venue header: 280, 320, 390, 430, 768, 1024, 1280, 1440 and 1920px, long unbroken names, dark mode and 125% text; no horizontal overflow. Full-photo mode rechecked at 280, 390, 768, 1024, 1440 and 1920px; identity remained below the image.
- Visually inspected light mobile and dark desktop owner previews plus the player-facing mobile full-photo header. Broken banner/logo fixture showed fallback initials without broken-image icons.
- Physical-device, installed-PWA, authenticated hosted storage/RLS acceptance and complete free-community interaction testing were not performed in this local visual pass.

## Local fixtures

Run `npm exec vite -- --config tests/venues/browser/vite.config.ts --host 127.0.0.1 --port 8092 --strictPort`.

- `/tests/venues/browser/index.html?images`: real owner image editor, local-memory uploads. Optional `&save-error`, `&private`, `&dark`, `&large-text`.
- `/tests/venues/browser/index.html?surface&contain-images`: full-photo player header. Optional `&long`, `&large-text`; replace contain-images with broken-images to check fallbacks.
