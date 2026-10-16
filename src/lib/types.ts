export type UserRole = 'customer' | 'seller' | 'admin';

export type ProductStatus = 'pending' | 'approved' | 'rejected' | 'disabled';
export type OrderStatus =
  | 'pending' | 'confirmed' | 'processing' | 'packed'
  | 'shipped' | 'out_for_delivery' | 'delivered'
  | 'cancelled' | 'return_requested' | 'returned' | 'refunded' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type SellerStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'paid' | 'rejected';
export type PayoutMethod = 'upi' | 'bank_transfer' | 'wallet';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  referred_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  store_name: string;
  store_slug: string;
  store_logo: string | null;
  store_banner: string | null;
  description: string | null;
  business_name: string | null;
  kyc_status: KycStatus;
  seller_status: SellerStatus;
  status_reason?: string | null;
  rating: number;
  total_sales: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  image: string | null;
  commission_pct: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Product {
  rejection_reason?: string | null;
  id: string;
  seller_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  mrp: number;
  selling_price: number;
  stock: number;
  sku: string | null;
  weight: number | null;
  shipping_info: string | null;
  return_policy: string;
  status: ProductStatus;
  is_featured: boolean;
  is_trending: boolean;
  rating: number;
  review_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  seller?: SellerProfile;
  product_images?: ProductImage[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  value: string;
  price_adjustment: number;
  stock: number;
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
  product?: Product;
  variant?: ProductVariant;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  seller_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_ref: string | null;
  subtotal: number;
  shipping_charge: number;
  discount: number;
  total: number;
  commission_amount: number;
  seller_amount: number;
  shipping_address: any;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
  seller?: SellerProfile;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_image: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  image_url: string | null;
  is_reported: boolean;
  created_at: string;
  reviewer_name?: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  seller_id: string | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Wallet {
  id: string;
  seller_id: string;
  available_balance: number;
  pending_balance: number;
  total_earnings: number;
  total_commission: number;
  total_withdrawn: number;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  seller_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  order_id: string | null;
  withdrawal_id: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  seller_id: string;
  amount: number;
  payout_method: PayoutMethod;
  payout_details: any;
  status: WithdrawalStatus;
  requested_at: string;
  processed_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  product_limit: number;
  commission_pct: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  seller_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  started_at: string;
  renews_at: string | null;
  payment_ref: string | null;
  amount_paid: number;
  created_at: string;
  plan?: SubscriptionPlan;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string | null;
  message: string;
  attachment: string | null;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface SupportReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  reward_amount: number;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  is_public: boolean;
  updated_at: string;
}
