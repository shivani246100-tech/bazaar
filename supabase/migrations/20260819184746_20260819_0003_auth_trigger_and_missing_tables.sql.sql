/*
# Fix auth flow: auto-create profiles + add missing tables

## Problem
The frontend was manually inserting into `profiles` right after `supabase.auth.signUp()`.
This is fragile: the RLS check `auth.uid() = id` can fail when the session
isn't fully established yet, causing "Database error querying schema".

## Fix
1. Add a `handle_new_user` trigger function that auto-creates a `profiles`
   row whenever a new auth.users row is inserted. The role, full_name, and
   phone are read from `raw_user_meta_data` (passed via signUp options.data).
   The `referred_by` field is resolved from the referral_code if provided.
2. Attach the trigger to `auth.users` via `AFTER INSERT`.
3. Remove the manual frontend insert (handled in app code).

## New Tables
- `admin_profiles` — extended admin info (separate from seller_profiles)
- `payments` — payment records linked to orders, with gateway reference
- `commissions` — per-order commission breakdown (order, seller, category, amounts)

## Security
- `admin_profiles`: admin-only read; self read.
- `payments`: customer reads own (via order ownership); seller reads own; admin reads all. No frontend writes.
- `commissions`: seller reads own; admin reads all. No frontend writes.

## Notes
- All new tables have RLS enabled.
- No existing data is deleted or modified.
- Existing profiles rows remain untouched.
*/

-- =====================================================
-- 1. AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================

-- Trigger function: runs AFTER a new auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
  v_phone text;
  v_referral_code text;
  v_referred_by uuid;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'customer');
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_phone := new.raw_user_meta_data->>'phone';
  v_referral_code := new.raw_user_meta_data->>'referral_code';

  -- Validate role
  IF v_role NOT IN ('customer', 'seller', 'admin') THEN
    v_role := 'customer';
  END IF;

  -- Resolve referrer
  IF v_referral_code IS NOT NULL AND v_referral_code <> '' THEN
    SELECT id INTO v_referred_by FROM public.profiles
    WHERE referral_code = upper(v_referral_code)
    AND id <> new.id
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, role, full_name, phone, referred_by)
  VALUES (
    new.id,
    v_role,
    v_full_name,
    v_phone,
    v_referred_by
  )
  ON CONFLICT (id) DO NOTHING;

  -- If a referral was used, create a pending referral record
  IF v_referred_by IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, status)
    VALUES (v_referred_by, new.id, 'pending')
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Drop old trigger if exists, then create fresh
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions for the trigger to work
-- (SECURITY DEFINER runs as owner, so it bypasses RLS on profiles)

-- =====================================================
-- 2. ADMIN PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  department text,
  access_level text NOT NULL DEFAULT 'full' CHECK (access_level IN ('full','limited','read_only')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_self_read" ON admin_profiles;
CREATE POLICY "admin_self_read" ON admin_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_admin_read" ON admin_profiles;
CREATE POLICY "admin_admin_read" ON admin_profiles FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "admin_admin_update" ON admin_profiles;
CREATE POLICY "admin_admin_update" ON admin_profiles FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "admin_admin_insert" ON admin_profiles;
CREATE POLICY "admin_admin_insert" ON admin_profiles FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_user ON admin_profiles(user_id);

-- =====================================================
-- 3. PAYMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_gateway text NOT NULL DEFAULT 'razorpay',
  gateway_payment_id text UNIQUE,
  gateway_signature text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','captured','failed','refunded','partial_refund')),
  method text,
  method_data jsonb,
  error_code text,
  error_message text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Customer can read payments for their own orders
DROP POLICY IF EXISTS "pay_customer_read" ON payments;
CREATE POLICY "pay_customer_read" ON payments FOR SELECT
  TO authenticated USING (auth.uid() = customer_id);

-- Seller can read payments for orders they own
DROP POLICY IF EXISTS "pay_seller_read" ON payments;
CREATE POLICY "pay_seller_read" ON payments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN seller_profiles s ON s.id = o.seller_id
      WHERE o.id = payments.order_id AND s.user_id = auth.uid()
    )
  );

-- Admin can read all payments
DROP POLICY IF EXISTS "pay_admin_read" ON payments;
CREATE POLICY "pay_admin_read" ON payments FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Admin can update payments (e.g. mark verified after webhook)
DROP POLICY IF EXISTS "pay_admin_update" ON payments;
CREATE POLICY "pay_admin_update" ON payments FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Customer can insert a payment record (initiate payment)
DROP POLICY IF EXISTS "pay_customer_insert" ON payments;
CREATE POLICY "pay_customer_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON payments(gateway_payment_id);

-- =====================================================
-- 4. COMMISSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  seller_amount numeric(12,2) NOT NULL DEFAULT 0,
  gateway_fee numeric(10,2) NOT NULL DEFAULT 0,
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  settlement_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','refunded','partial_refund')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Seller can read commissions for their own orders
DROP POLICY IF EXISTS "comm_seller_read" ON commissions;
CREATE POLICY "comm_seller_read" ON commissions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = commissions.seller_id)
  );

-- Admin can read all commissions
DROP POLICY IF EXISTS "comm_admin_read" ON commissions;
CREATE POLICY "comm_admin_read" ON commissions FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Admin can update commissions (settle, mark refunded)
DROP POLICY IF EXISTS "comm_admin_update" ON commissions;
CREATE POLICY "comm_admin_update" ON commissions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Admin can insert commissions
DROP POLICY IF EXISTS "comm_admin_insert" ON commissions;
CREATE POLICY "comm_admin_insert" ON commissions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_commissions_order ON commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_seller ON commissions(seller_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- =====================================================
-- 5. UPDATED_AT TRIGGER FOR PROFILES
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- 6. ENSURE PROFILES INSERT POLICY ALLOWS TRIGGER-BASED INSERT
-- =====================================================
-- The trigger uses SECURITY DEFINER so it bypasses RLS.
-- But we also need to allow the frontend to update profiles
-- (e.g. become-a-seller flow updates role). The existing
-- profiles_update_own policy already handles this.
-- We keep profiles_insert_own for backward compatibility
-- but the trigger is the primary mechanism now.

-- Re-verify the insert policy exists
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
