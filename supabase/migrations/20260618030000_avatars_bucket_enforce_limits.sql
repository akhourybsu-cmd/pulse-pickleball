-- =====================================================================
-- Force the avatars bucket's size + MIME limits to be enforced
-- (Phase 3.A.2).
--
-- The original avatars migration (20251002164937) inserts the bucket
-- with `file_size_limit = 5MB` and a JPEG/PNG/WebP MIME whitelist,
-- but the ON CONFLICT DO NOTHING clause means if the bucket already
-- existed (Supabase sometimes provisions default buckets, or a manual
-- dashboard create predates the migration), those limits never landed.
--
-- The client-side check in EditProfile.tsx:215 already validates 5MB,
-- but the audit (Phase 1 P2) flagged this as client-only. This
-- migration makes the bucket-level limit authoritative regardless of
-- when the bucket was created.
--
-- Idempotent — safe to re-run.
-- =====================================================================

UPDATE storage.buckets
   SET file_size_limit    = 5242880,  -- 5 MB
       allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/jpg',
         'image/webp'
       ]
 WHERE id = 'avatars'
   AND (
        file_size_limit IS DISTINCT FROM 5242880
     OR allowed_mime_types IS DISTINCT FROM ARRAY[
          'image/jpeg', 'image/png', 'image/jpg', 'image/webp'
        ]
   );
