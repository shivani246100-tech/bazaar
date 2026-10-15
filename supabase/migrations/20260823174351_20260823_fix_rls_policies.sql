/*
# Fix RLS policies blocking checkout, become-seller, and cross-user reads

## Problems found
1. `notifications` INSERT policy only allowed `auth.uid() = user_id` — checkout inserts
   notifications for the SELLER (a different user), so the insert silently failed.
2. `wallets` had NO INSERT policy — the "Become a Seller" flow tried to insert a
   wallet row and silently failed, leaving the seller with no wallet.
3. `wallet_transactions` had NO INSERT policy — could never record transactions.
4. `profiles` SELECT was split: `anon` could read all, but `authenticated` could
   only read own/admin — seller orders page reads customer profile and got null.

## Changes
- notifications: relax INSERT to allow any authenticated user to insert
  (notifications are system-generated; the user_id is the RECIPIENT, not the sender).
- wallets: add INSERT policy for sellers to create their own wallet.
- wallet_transactions: add INSERT policy for sellers + admin.
- profiles: allow authenticated users to read any profile (profiles are public
  business data — names shown on orders, reviews, stores).
*/

-- 1. Fix notifications INSERT: allow any authenticated user to insert
--    (notifications are created by the system for recipients, not by the recipient)
DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_authenticated" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Fix wallets: add INSERT policy so sellers can create their own wallet
DROP POLICY IF EXISTS "wallet_seller_insert" ON wallets;
CREATE POLICY "wallet_seller_insert" ON wallets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM seller_profiles s
    WHERE s.user_id = auth.uid() AND s.id = wallets.seller_id
  ));

-- 3. Fix wallet_transactions: add INSERT policy
DROP POLICY IF EXISTS "wt_seller_insert" ON wallet_transactions;
CREATE POLICY "wt_seller_insert" ON wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM seller_profiles s
    WHERE s.user_id = auth.uid() AND s.id = wallet_transactions.seller_id
  ));

-- 4. Fix profiles: allow authenticated users to read any profile (public business data)
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT TO anon, authenticated USING (true);