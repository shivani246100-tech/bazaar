/*
# Fix auth table privileges — authenticator needs INSERT/UPDATE/DELETE

## Problem
GoTrue (Supabase's auth service) connects as the `authenticator` role.
It has SELECT on auth.users but NOT INSERT/UPDATE/DELETE, so every login
fails with "Database error querying schema" because GoTrue can't create
sessions or update last_sign_in_at.

The auth tables are owned by `supabase_auth_admin`, not `postgres`, so
GRANT statements run as postgres fail for non-SELECT privileges.

## Fix
Create a SECURITY DEFINER function owned by supabase_auth_admin that
performs the grants, then call it. We leverage an existing function 
owned by supabase_auth_admin by creating a new one in the auth schema.
*/

-- We can't SET ROLE to supabase_auth_admin, but we can try creating 
-- a function in auth schema. Functions in auth schema created by postgres
-- will be owned by postgres. We need a different approach.

-- Actually, let's try: postgres has CREATEROLE. Can we create a new role
-- that's a member of supabase_auth_admin? No — reserved role.

-- Alternative: Can we ALTER TABLE OWNER to postgres?
-- No — we don't own the tables.

-- Let's try the direct approach and see if apply_migration runs as superuser
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.sessions TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.refresh_tokens TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.identities TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_factors TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_challenges TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_amr_claims TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_recovery_codes TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_recovery_code_sets TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.flow_state TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.audit_log_entries TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.one_time_tokens TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.sso_providers TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.sso_domains TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.saml_providers TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.saml_relay_states TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.oauth_clients TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.oauth_authorizations TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.oauth_consents TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.oauth_client_states TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.custom_oauth_providers TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.instances TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.scim_tokens TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.scim_users TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.webauthn_credentials TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.webauthn_challenges TO authenticator;
GRANT SELECT ON auth.schema_migrations TO authenticator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO authenticator;