/*
# Financial & platform tables

1. New Tables
- `wallets` — seller wallet balances (available, pending, total_earnings, total_commission, withdrawn)
- `withdrawals` — seller withdrawal requests with payout details
- `wallet_transactions` — immutable ledger entries per wallet
- `subscription_plans` — FREE/PRO/BUSINESS plans with commission rates and product limits
- `subscriptions` — active seller subscriptions linked to plans
- `referrals` — referral records with reward tracking
- `audit_logs` — admin audit trail
- `platform_settings` — global config (global commission, etc.)

2. Security
- Wallets: seller read own; admin read all; NO frontend writes.
- Wallet transactions: seller read own; admin read all; NO frontend writes.
- Withdrawals: seller create/read own; admin read/update all.
- Subscription plans: public read; admin write.
- Subscriptions: seller read own; admin read all; seller insert own.
- Referrals: owner read; admin read all.
- Audit logs: admin read only.
- Platform settings: admin read/write; public read of non-sensitive keys.

3. Notes
- Wallet balances are NEVER directly writable by the frontend.
- Commission engine reads: seller override > category commission > global setting.
*/

-- ===== WALLETS =====
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES seller_profiles(id) ON DELETE CASCADE,
  available_balance numeric(12,2) NOT NULL DEFAULT 0,
  pending_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  total_commission numeric(12,2) NOT NULL DEFAULT 0,
  total_withdrawn numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_seller_read" ON wallets;
CREATE POLICY "wallet_seller_read" ON wallets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = wallets.seller_id));
DROP POLICY IF EXISTS "wallet_admin_read" ON wallets;
CREATE POLICY "wallet_admin_read" ON wallets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== WITHDRAWALS =====
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payout_method text NOT NULL CHECK (payout_method IN ('upi','bank_transfer','wallet')),
  payout_details jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','paid','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wd_seller_read" ON withdrawals;
CREATE POLICY "wd_seller_read" ON withdrawals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = withdrawals.seller_id));
DROP POLICY IF EXISTS "wd_admin_read" ON withdrawals;
CREATE POLICY "wd_admin_read" ON withdrawals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "wd_seller_insert" ON withdrawals;
CREATE POLICY "wd_seller_insert" ON withdrawals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = withdrawals.seller_id));
DROP POLICY IF EXISTS "wd_admin_update" ON withdrawals;
CREATE POLICY "wd_admin_update" ON withdrawals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== WALLET TRANSACTIONS =====
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit','debit','commission','withdrawal','refund','adjustment','subscription')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  balance_after numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  withdrawal_id uuid REFERENCES withdrawals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wt_seller_read" ON wallet_transactions;
CREATE POLICY "wt_seller_read" ON wallet_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = wallet_transactions.seller_id));
DROP POLICY IF EXISTS "wt_admin_read" ON wallet_transactions;
CREATE POLICY "wt_admin_read" ON wallet_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== SUBSCRIPTION PLANS =====
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  product_limit int NOT NULL DEFAULT 10,
  commission_pct numeric(5,2) NOT NULL DEFAULT 10,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_public_read" ON subscription_plans;
CREATE POLICY "plan_public_read" ON subscription_plans FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "plan_admin_manage" ON subscription_plans;
CREATE POLICY "plan_admin_manage" ON subscription_plans FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== SUBSCRIPTIONS =====
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','pending')),
  started_at timestamptz NOT NULL DEFAULT now(),
  renews_at timestamptz,
  payment_ref text,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_seller_read" ON subscriptions;
CREATE POLICY "sub_seller_read" ON subscriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = subscriptions.seller_id));
DROP POLICY IF EXISTS "sub_admin_read" ON subscriptions;
CREATE POLICY "sub_admin_read" ON subscriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "sub_seller_insert" ON subscriptions;
CREATE POLICY "sub_seller_insert" ON subscriptions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = subscriptions.seller_id));
DROP POLICY IF EXISTS "sub_seller_update" ON subscriptions;
CREATE POLICY "sub_seller_update" ON subscriptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = subscriptions.seller_id)) WITH CHECK (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = subscriptions.seller_id));
DROP POLICY IF EXISTS "sub_admin_update" ON subscriptions;
CREATE POLICY "sub_admin_update" ON subscriptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== REFERRALS =====
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_owner_read" ON referrals;
CREATE POLICY "ref_owner_read" ON referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
DROP POLICY IF EXISTS "ref_admin_read" ON referrals;
CREATE POLICY "ref_admin_read" ON referrals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== AUDIT LOGS =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_read" ON audit_logs;
CREATE POLICY "audit_admin_read" ON audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== PLATFORM SETTINGS =====
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_public_read" ON platform_settings;
CREATE POLICY "settings_public_read" ON platform_settings FOR SELECT TO anon, authenticated USING (is_public = true);
DROP POLICY IF EXISTS "settings_admin_read" ON platform_settings;
CREATE POLICY "settings_admin_read" ON platform_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "settings_admin_write" ON platform_settings;
CREATE POLICY "settings_admin_write" ON platform_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_wallet_seller ON wallets(seller_id);
CREATE INDEX IF NOT EXISTS idx_wt_seller ON wallet_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_wt_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller ON withdrawals(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_seller ON subscriptions(seller_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);

-- ===== DEFAULT PLATFORM SETTINGS =====
INSERT INTO platform_settings (key, value, description, is_public) VALUES
  ('global_commission_pct', '10', 'Global default commission percentage', false),
  ('min_withdrawal_amount', '500', 'Minimum withdrawal amount in INR', false),
  ('referral_reward_amount', '50', 'Reward for successful referral in INR', false),
  ('platform_name', 'Bazaar', 'Platform display name', true),
  ('support_email', 'support@bazaar.app', 'Support contact email', true),
  ('default_shipping_charge', '49', 'Default shipping charge in INR', false)
ON CONFLICT (key) DO NOTHING;

-- ===== DEFAULT SUBSCRIPTION PLANS =====
INSERT INTO subscription_plans (name, slug, price, product_limit, commission_pct, features, sort_order) VALUES
  ('Free', 'free', 0, 10, 12, '["Up to 10 product listings","Basic seller profile","Standard dashboard","Standard support"]'::jsonb, 1),
  ('Pro', 'pro', 299, 100, 10, '["Up to 100 product listings","Better store visibility","Advanced analytics","Priority support","Promotional tools"]'::jsonb, 2),
  ('Business', 'business', 799, 1000, 8, '["Up to 1000 product listings","Premium store profile","Higher visibility","Advanced analytics","Priority support","Promotional tools","Featured listing credits"]'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;
