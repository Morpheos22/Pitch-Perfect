-- Migration: 1_add_device_tracking
-- Adds device fingerprint + IP + UA capture to the users table.
-- Captured on signup (first authenticated request after Clerk user.created)
-- and refreshed on every subsequent sign-in / page load via /api/user/sync.
--
-- Fields:
--   signup_device_id        SHA-256 hash of UA + Client Hints at signup
--   signup_ip               Client IP at signup
--   signup_user_agent       Raw User-Agent string at signup (truncated to 512)
--   signup_at               Timestamp of signup device capture
--   last_signin_device_id   SHA-256 hash of UA + Client Hints at last sign-in
--   last_signin_ip          Client IP at last sign-in
--   last_signin_user_agent  Raw User-Agent string at last sign-in (truncated to 512)
--   last_signin_at          Timestamp of last sign-in device capture
--
-- All fields are nullable so existing users are not forced to re-authenticate.
-- The next /api/user/sync POST call will populate them.

ALTER TABLE "users"
  ADD COLUMN "signupDeviceId"      TEXT,
  ADD COLUMN "signupIp"            TEXT,
  ADD COLUMN "signupUserAgent"     TEXT,
  ADD COLUMN "signupAt"            TIMESTAMP(3),
  ADD COLUMN "lastSigninDeviceId"  TEXT,
  ADD COLUMN "lastSigninIp"        TEXT,
  ADD COLUMN "lastSigninUserAgent" TEXT,
  ADD COLUMN "lastSigninAt"        TIMESTAMP(3);
