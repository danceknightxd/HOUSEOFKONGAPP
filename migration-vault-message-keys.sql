-- ============================================================
-- THE THRONE — MIGRATION: Vault Per-Message Keys
-- Run once in Supabase's SQL Editor. Safe on an existing database.
--
-- Adds the column the new per-message key derivation needs (see the
-- large comment above deriveRootSecretBits in vault-crypto.js for
-- the full explanation of what changed and why).
--
-- Fully backward compatible: existing messages have salt = null and
-- keep decrypting exactly as before via the untouched legacy path.
-- Only NEW messages sent after this migration + the updated client
-- files get the per-message key improvement.
-- ============================================================

alter table vault_messages add column if not exists salt text;
