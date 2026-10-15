/*
# Fix: Create missing auth.identities for seed users

## Problem
The 5 seed users (admin, 3 sellers, customer) were inserted directly into
`auth.users` without corresponding `auth.identities` rows. GoTrue requires
an identity record for password-based login. Without it, the login endpoint
returns HTTP 500 "Database error querying schema".

## Fix
Insert the missing `auth.identities` rows for all seed users who don't
already have one. The `email` column is generated, so we omit it.
*/

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);
