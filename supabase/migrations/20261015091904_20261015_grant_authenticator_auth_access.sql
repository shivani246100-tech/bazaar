/*
# Grant authenticator USAGE on auth schema + table CRUD privileges

## Problem
GoTrue connects as `authenticator` but that role lost USAGE on the `auth`
schema and INSERT/UPDATE/DELETE on auth tables. Every login fails with
"Database error querying schema".

## Fix
- GRANT USAGE ON SCHEMA auth TO authenticator
- GRANT SELECT, INSERT, UPDATE, DELETE on all auth tables TO authenticator
*/

GRANT USAGE ON SCHEMA auth TO authenticator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO authenticator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO authenticator;