/*
# Core marketplace tables

1. New Tables
- profiles, addresses, seller_profiles, categories, products, product_variants, product_images, cart_items, wishlist, orders, order_items, reviews, coupons, notifications, support_tickets, support_replies

2. Security
- RLS enabled on every table with appropriate owner/admin/public policies.

3. Notes
- Owner columns default to auth.uid() so inserts omitting them succeed.
- Products require admin approval before public visibility.
*/

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','seller','admin')),
  full_name text,
  phone text,
  avatar_url text,
  referral_code text UNIQUE DEFAULT upper(substr(md5(random()::text),1,8)),
  referred_by uuid REFERENCES profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT TO anon USING (true);

-- ===== ADDRESSES =====
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addr_select_own" ON addresses;
CREATE POLICY "addr_select_own" ON addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "addr_insert_own" ON addresses;
CREATE POLICY "addr_insert_own" ON addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "addr_update_own" ON addresses;
CREATE POLICY "addr_update_own" ON addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "addr_delete_own" ON addresses;
CREATE POLICY "addr_delete_own" ON addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== SELLER PROFILES =====
CREATE TABLE IF NOT EXISTS seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  store_slug text UNIQUE NOT NULL,
  store_logo text,
  store_banner text,
  description text,
  business_name text,
  gstin text,
  pan text,
  kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected')),
  seller_status text NOT NULL DEFAULT 'pending' CHECK (seller_status IN ('pending','active','suspended','rejected')),
  commission_override numeric(5,2),
  rating numeric(2,1) NOT NULL DEFAULT 0,
  total_sales numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seller_public_read" ON seller_profiles;
CREATE POLICY "seller_public_read" ON seller_profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "seller_owner_update" ON seller_profiles;
CREATE POLICY "seller_owner_update" ON seller_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "seller_owner_insert" ON seller_profiles;
CREATE POLICY "seller_owner_insert" ON seller_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ===== CATEGORIES =====
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  icon text,
  image text,
  commission_pct numeric(5,2) NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cat_public_read" ON categories;
CREATE POLICY "cat_public_read" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "cat_admin_write" ON categories;
CREATE POLICY "cat_admin_write" ON categories FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== PRODUCTS =====
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  brand text,
  description text,
  mrp numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  sku text,
  weight numeric(10,2),
  shipping_info text,
  return_policy text DEFAULT '7 Days Easy Returns',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','disabled')),
  is_featured boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  review_count int NOT NULL DEFAULT 0,
  sales_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prod_public_read" ON products;
CREATE POLICY "prod_public_read" ON products FOR SELECT TO anon, authenticated USING (status = 'approved');
DROP POLICY IF EXISTS "prod_seller_all" ON products;
CREATE POLICY "prod_seller_all" ON products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = products.seller_id));
DROP POLICY IF EXISTS "prod_admin_all" ON products;
CREATE POLICY "prod_admin_all" ON products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "prod_seller_insert" ON products;
CREATE POLICY "prod_seller_insert" ON products FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = products.seller_id));
DROP POLICY IF EXISTS "prod_seller_update" ON products;
CREATE POLICY "prod_seller_update" ON products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = products.seller_id)) WITH CHECK (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = products.seller_id));
DROP POLICY IF EXISTS "prod_admin_update" ON products;
CREATE POLICY "prod_admin_update" ON products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "prod_admin_delete" ON products;
CREATE POLICY "prod_admin_delete" ON products FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== PRODUCT VARIANTS =====
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  price_adjustment numeric(10,2) NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pv_public_read" ON product_variants;
CREATE POLICY "pv_public_read" ON product_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pv_seller_manage" ON product_variants;
CREATE POLICY "pv_seller_manage" ON product_variants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM products p JOIN seller_profiles s ON s.id = p.seller_id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM products p JOIN seller_profiles s ON s.id = p.seller_id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()));

-- ===== PRODUCT IMAGES =====
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pi_public_read" ON product_images;
CREATE POLICY "pi_public_read" ON product_images FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pi_seller_manage" ON product_images;
CREATE POLICY "pi_seller_manage" ON product_images FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM products p JOIN seller_profiles s ON s.id = p.seller_id WHERE p.id = product_images.product_id AND s.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM products p JOIN seller_profiles s ON s.id = p.seller_id WHERE p.id = product_images.product_id AND s.user_id = auth.uid()));

-- ===== CART =====
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cart_select_own" ON cart_items;
CREATE POLICY "cart_select_own" ON cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_insert_own" ON cart_items;
CREATE POLICY "cart_insert_own" ON cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_update_own" ON cart_items;
CREATE POLICY "cart_update_own" ON cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_delete_own" ON cart_items;
CREATE POLICY "cart_delete_own" ON cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== WISHLIST =====
CREATE TABLE IF NOT EXISTS wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wish_select_own" ON wishlist;
CREATE POLICY "wish_select_own" ON wishlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wish_insert_own" ON wishlist;
CREATE POLICY "wish_insert_own" ON wishlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wish_delete_own" ON wishlist;
CREATE POLICY "wish_delete_own" ON wishlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== ORDERS =====
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','packed','shipped','out_for_delivery','delivered','cancelled','return_requested','returned','refunded','completed')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded','partial_refund')),
  payment_method text,
  payment_ref text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping_charge numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  seller_amount numeric(12,2) NOT NULL DEFAULT 0,
  shipping_address jsonb,
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_customer_read" ON orders;
CREATE POLICY "order_customer_read" ON orders FOR SELECT TO authenticated USING (auth.uid() = customer_id);
DROP POLICY IF EXISTS "order_seller_read" ON orders;
CREATE POLICY "order_seller_read" ON orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = orders.seller_id));
DROP POLICY IF EXISTS "order_admin_all" ON orders;
CREATE POLICY "order_admin_all" ON orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "order_customer_insert" ON orders;
CREATE POLICY "order_customer_insert" ON orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
DROP POLICY IF EXISTS "order_seller_update" ON orders;
CREATE POLICY "order_seller_update" ON orders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = orders.seller_id)) WITH CHECK (EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = auth.uid() AND s.id = orders.seller_id));
DROP POLICY IF EXISTS "order_admin_update" ON orders;
CREATE POLICY "order_admin_update" ON orders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== ORDER ITEMS =====
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image text,
  variant_name text,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oi_customer_read" ON order_items;
CREATE POLICY "oi_customer_read" ON order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()));
DROP POLICY IF EXISTS "oi_seller_read" ON order_items;
CREATE POLICY "oi_seller_read" ON order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders o JOIN seller_profiles s ON s.id = o.seller_id WHERE o.id = order_items.order_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "oi_admin_read" ON order_items;
CREATE POLICY "oi_admin_read" ON order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "oi_customer_insert" ON order_items;
CREATE POLICY "oi_customer_insert" ON order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()));

-- ===== REVIEWS =====
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  image_url text,
  is_reported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rev_public_read" ON reviews;
CREATE POLICY "rev_public_read" ON reviews FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "rev_owner_insert" ON reviews;
CREATE POLICY "rev_owner_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rev_owner_delete" ON reviews;
CREATE POLICY "rev_owner_delete" ON reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "rev_admin_update" ON reviews;
CREATE POLICY "rev_admin_update" ON reviews FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== COUPONS =====
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_value numeric(10,2) NOT NULL DEFAULT 0,
  max_discount numeric(10,2),
  seller_id uuid REFERENCES seller_profiles(id) ON DELETE CASCADE,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupon_public_read" ON coupons;
CREATE POLICY "coupon_public_read" ON coupons FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "coupon_admin_manage" ON coupons;
CREATE POLICY "coupon_admin_manage" ON coupons FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ===== SUPPORT TICKETS =====
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text,
  message text,
  attachment text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_owner_read" ON support_tickets;
CREATE POLICY "ticket_owner_read" ON support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "ticket_owner_insert" ON support_tickets;
CREATE POLICY "ticket_owner_insert" ON support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ticket_owner_update" ON support_tickets;
CREATE POLICY "ticket_owner_update" ON support_tickets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ticket_admin_update" ON support_tickets;
CREATE POLICY "ticket_admin_update" ON support_tickets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TABLE IF NOT EXISTS support_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reply_owner_read" ON support_replies;
CREATE POLICY "reply_owner_read" ON support_replies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = support_replies.ticket_id AND (t.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));
DROP POLICY IF EXISTS "reply_owner_insert" ON support_replies;
CREATE POLICY "reply_owner_insert" ON support_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_trending ON products(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_slug ON seller_profiles(store_slug);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(selling_price);
CREATE INDEX IF NOT EXISTS idx_products_sales ON products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
