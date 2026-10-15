/*
# Fully restrict handle_new_user execution

The previous REVOKE didn't cover the implicit `public` grant.
PostgreSQL functions are executable by PUBLIC by default. We must
REVOKE FROM PUBLIC and then grant only to the trigger owner (postgres).

## Notes
- The trigger still works because it runs with SECURITY DEFINER
  (the function owner's privileges), not the caller's.
- This removes the REST API exposure entirely.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
