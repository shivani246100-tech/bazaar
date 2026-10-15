/*
# Fix security warnings on trigger functions

## Changes
1. Revoke EXECUTE on `handle_new_user` from anon and authenticated roles so
   it cannot be called directly via the REST API. It still works as a trigger
   because triggers run with the function owner's privileges.
2. Set a fixed `search_path` on `update_updated_at` to remove the
   "mutable search_path" warning.

## Notes
- No data changes.
- No structural changes.
- These are hardening fixes only.
*/

-- Revoke direct execution of the trigger function from all non-internal roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Fix mutable search_path on update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
