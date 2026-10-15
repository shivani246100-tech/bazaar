/*
# Fix: Add missing provider metadata to seed users

## Problem
The 5 seed users (admin, 3 sellers, customer) have `raw_app_meta_data` that
only contains `{"role": "..."}` but is missing the `provider` and `providers`
fields that GoTrue needs to authenticate password-based logins.

The working user (shivani246100@gmail.com) has:
  raw_app_meta_data = {"provider": "email", "providers": ["email"]}

Without these fields, GoTrue cannot resolve the identity provider during
the password grant flow, causing HTTP 500 "Database error querying schema".

## Fix
Update `raw_app_meta_data` for all seed users to merge in the provider
information while preserving any existing keys (like `role`).

## Notes
- Does NOT change passwords.
- Does NOT change any other user data.
- Only affects users whose raw_app_meta_data is missing the provider field.
*/

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'provider', 'email',
  'providers', jsonb_build_array('email')
)
WHERE email IN (
  'admin@bazaar.app',
  'seller1@bazaar.app',
  'seller2@bazaar.app',
  'seller3@bazaar.app',
  'customer@bazaar.app'
)
AND NOT (raw_app_meta_data ? 'provider');
