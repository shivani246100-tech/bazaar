import { supabase } from './supabase';
import type { Category, SellerProfile, SubscriptionPlan, Subscription } from './types';

export interface CommissionConfig {
  globalPct: number;
  categoryPct: number | null;
  sellerOverridePct: number | null;
  planPct: number | null;
}

export async function getGlobalCommission(): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'global_commission_pct')
    .maybeSingle();
  return data ? parseFloat(data.value) : 10;
}

export async function getCategoryCommission(categoryId: string | null): Promise<number | null> {
  if (!categoryId) return null;
  const { data } = await supabase
    .from('categories')
    .select('commission_pct')
    .eq('id', categoryId)
    .maybeSingle();
  return data ? data.commission_pct : null;
}

export async function getSellerCommission(sellerId: string): Promise<number | null> {
  const { data } = await supabase
    .from('seller_profiles')
    .select('commission_override')
    .eq('id', sellerId)
    .maybeSingle();
  return data?.commission_override ?? null;
}

export async function getActivePlanCommission(sellerId: string): Promise<number | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select(`
      plan_id,
      status,
      subscription_plans!inner(commission_pct)
    `)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any)?.subscription_plans?.commission_pct ?? null;
}

export async function resolveCommissionPct(
  sellerId: string,
  categoryId: string | null,
): Promise<number> {
  const [global, category, seller, plan] = await Promise.all([
    getGlobalCommission(),
    getCategoryCommission(categoryId),
    getSellerCommission(sellerId),
    getActivePlanCommission(sellerId),
  ]);

  if (seller !== null) return seller;
  if (plan !== null) return plan;
  if (category !== null) return category;
  return global;
}

export function calculateCommission(total: number, commissionPct: number) {
  const commissionAmount = Math.round((total * commissionPct) / 100);
  const sellerAmount = total - commissionAmount;
  return { commissionAmount, sellerAmount, commissionPct };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function fetchSellerProfile(userId: string): Promise<SellerProfile | null> {
  const { data, error } = await supabase
    .from('seller_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function fetchActiveSubscription(sellerId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
