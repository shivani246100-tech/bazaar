import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { CartItem, Product, Address } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter, Link } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge, EmptyState } from '@/components/ui/Common';
import { formatINR } from '@/lib/utils';
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, Store, Tag, Check, ChevronLeft } from 'lucide-react';

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  items: (CartItem & { product?: Product })[];
  subtotal: number;
}

interface CouponRow {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  seller_id: string | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string;
  ends_at: string | null;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const DEFAULT_SHIPPING = 49;
const ONLINE_ENABLED = Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID);
const CART_SELECT = '*, product:products(*, seller:seller_profiles(*), product_images(*))';
const COUPON_SELECT = 'code, discount_type, discount_value, min_order_value, max_discount, seller_id, usage_limit, used_count, starts_at, ends_at';

function useShippingCharge() {
  const [shipping, setShipping] = useState(DEFAULT_SHIPPING);
  useEffect(() => {
    supabase.from('platform_settings').select('value').eq('key', 'default_shipping_charge').maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value);
        if (data && isFinite(n) && n >= 0) setShipping(n);
      });
  }, []);
  return shipping;
}

function groupCart(items: any[]): SellerGroup[] {
  const map = new Map<string, SellerGroup>();
  for (const item of items) {
    const sid = item.product?.seller_id;
    if (!sid) continue;
    if (!map.has(sid)) {
      map.set(sid, { sellerId: sid, sellerName: item.product?.seller?.store_name || 'Seller', items: [], subtotal: 0 });
    }
    const g = map.get(sid)!;
    g.items.push(item);
    g.subtotal += item.product.selling_price * item.quantity;
  }
  return Array.from(map.values());
}

// Estimate only. The server recalculates everything when the order is placed.
function estimateDiscount(groups: SellerGroup[], c: CouponRow | null): number {
  if (!c) return 0;
  const eligible = groups.filter(g => !c.seller_id || g.sellerId === c.seller_id).reduce((s, g) => s + g.subtotal, 0);
  if (eligible <= 0 || eligible < c.min_order_value) return 0;
  let d = c.discount_type === 'percentage' ? (eligible * c.discount_value) / 100 : c.discount_value;
  if (c.discount_type === 'percentage' && c.max_discount) d = Math.min(d, c.max_discount);
  return Math.round(Math.min(d, eligible) * 100) / 100;
}

function couponUsable(c: CouponRow): boolean {
  const now = Date.now();
  if (new Date(c.starts_at).getTime() > now) return false;
  if (c.ends_at && new Date(c.ends_at).getTime() <= now) return false;
  if (c.usage_limit !== null && c.used_count >= c.usage_limit) return false;
  return true;
}

function stockProblem(groups: SellerGroup[]): string | null {
  for (const g of groups) {
    for (const item of g.items) {
      if (item.product && item.product.stock < item.quantity) {
        return `Only ${Math.max(item.product.stock, 0)} left of "${item.product.name}"`;
      }
    }
  }
  return null;
}

export function CartPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const shipping = useShippingCharge();
  const [groups, setGroups] = useState<SellerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRow | null>(null);

  const fetchCart = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('cart_items')
      .select(CART_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setGroups(groupCart((data as any) || []));
    setLoading(false);
  };

  useEffect(() => { fetchCart(); }, [user]);

  const updateQty = async (itemId: string, qty: number) => {
    if (qty < 1 || qty > 20) return;
    await supabase.from('cart_items').update({ quantity: qty }).eq('id', itemId);
    fetchCart();
  };

  const removeItem = async (itemId: string) => {
    await supabase.from('cart_items').delete().eq('id', itemId);
    push('info', 'Item removed from cart');
    fetchCart();
  };

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const { data: coupon } = await supabase.from('coupons').select(COUPON_SELECT).eq('code', code).eq('is_active', true).maybeSingle();
    if (!coupon || !couponUsable(coupon as any)) { push('error', 'This coupon is invalid or has expired'); return; }
    const disc = estimateDiscount(groups, coupon as any);
    if (disc <= 0) { push('error', 'This coupon does not apply to your cart (check the minimum order amount)'); return; }
    setAppliedCoupon(coupon as any);
    push('success', `Coupon ${coupon.code} applied! You save about ${formatINR(disc)}`);
  };

  const itemsTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const shippingTotal = groups.length * shipping;
  const discount = estimateDiscount(groups, appliedCoupon);
  const finalTotal = itemsTotal + shippingTotal - discount;
  const problem = stockProblem(groups);

  if (!user) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="p-8 max-w-md text-center">
        <ShoppingCart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Sign in to view your cart</h2>
        <Link to="/login"><Button>Sign In</Button></Link>
      </Card>
    </div>;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div>;

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <EmptyState icon={<ShoppingCart className="h-16 w-16" />} title="Your cart is empty" message="Browse products and add items to your cart." action={<Link to="/"><Button>Start Shopping</Button></Link>} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Shopping Cart ({groups.reduce((s, g) => s + g.items.length, 0)} items)</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {groups.map(g => (
              <Card key={g.sellerId} className="overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <Store className="h-4 w-4 text-rose-600" />
                  <span className="text-sm font-semibold text-slate-700">{g.sellerName}</span>
                  <Badge>{g.items.length} items</Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.items.map(item => (
                    <div key={item.id} className="flex gap-3 p-4">
                      <Link to={`/product/${item.product?.slug}`} className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {(item.product as any)?.product_images?.[0]?.image_url ? (
                          <img src={(item.product as any).product_images[0].image_url} alt="" className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ShoppingCart className="h-6 w-6" /></div>}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${item.product?.slug}`} className="text-sm font-medium text-slate-800 hover:text-rose-600 line-clamp-2">{item.product?.name}</Link>
                        <p className="text-xs text-slate-400 mt-0.5">{item.product?.brand}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-base font-bold text-slate-900">{formatINR(item.product?.selling_price || 0)}</span>
                          {item.product && item.product.mrp > item.product.selling_price && (
                            <span className="text-xs text-slate-400 line-through">{formatINR(item.product.mrp)}</span>
                          )}
                        </div>
                        {item.product && item.product.stock < item.quantity && (
                          <p className="text-xs text-red-600 mt-1">Only {Math.max(item.product.stock, 0)} left in stock</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center border border-slate-300 rounded-lg">
                          <button onClick={() => updateQty(item.id, item.quantity - 1)} className="p-1.5 hover:bg-slate-50"><Minus className="h-3.5 w-3.5 text-slate-600" /></button>
                          <span className="px-2 text-sm font-semibold">{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, item.quantity + 1)} className="p-1.5 hover:bg-slate-50"><Plus className="h-3.5 w-3.5 text-slate-600" /></button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal: <span className="font-semibold text-slate-800">{formatINR(g.subtotal)}</span></span>
                  <span className="text-slate-500">Shipping: <span className="font-semibold text-slate-800">{formatINR(shipping)}</span></span>
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-28">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-800">{formatINR(itemsTotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium text-slate-800">{formatINR(shippingTotal)}</span></div>
                {appliedCoupon && discount > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>Discount ({appliedCoupon.code})</span><span className="font-medium">-{formatINR(discount)}</span></div>
                )}
                <div className="border-t border-slate-100 pt-2 flex justify-between"><span className="font-semibold text-slate-900">Total</span><span className="text-lg font-bold text-rose-600">{formatINR(finalTotal)}</span></div>
                <p className="text-xs text-slate-400">The final amount is confirmed when you place the order.</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">{appliedCoupon.code}</span>
                    </div>
                    <button onClick={() => setAppliedCoupon(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code" className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-rose-400 focus:outline-none" />
                    </div>
                    <Button variant="outline" size="sm" onClick={applyCoupon}>Apply</Button>
                  </div>
                )}
              </div>
              {problem && <p className="mt-3 text-xs text-red-600">{problem}. Please reduce the quantity.</p>}
              <Button onClick={() => navigate(`/checkout${appliedCoupon ? `?coupon=${appliedCoupon.code}` : ''}`)} size="lg" className="w-full mt-4" disabled={!!problem}>
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/" className="block text-center mt-3 text-sm text-slate-500 hover:text-rose-600">Continue Shopping</Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutPage() {
  const { user } = useAuth();
  const { navigate, path } = useRouter();
  const { push } = useToast();
  const shipping = useShippingCharge();
  const query = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
  const couponCode = (query.get('coupon') || '').toUpperCase();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string>('');
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [groups, setGroups] = useState<SellerGroup[]>([]);
  const [coupon, setCoupon] = useState<CouponRow | null>(null);
  const [loadingCart, setLoadingCart] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [method, setMethod] = useState<'cod' | 'online'>(ONLINE_ENABLED ? 'online' : 'cod');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      const { data: addrs } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false });
      setAddresses(addrs || []);
      if (addrs && addrs.length > 0) setSelectedAddr(addrs[0].id);

      const { data: cartItems } = await supabase.from('cart_items').select(CART_SELECT).eq('user_id', user.id);
      setGroups(groupCart((cartItems as any) || []));

      if (couponCode) {
        const { data: c } = await supabase.from('coupons').select(COUPON_SELECT).eq('code', couponCode).eq('is_active', true).maybeSingle();
        if (c && couponUsable(c as any)) setCoupon(c as any);
      }
      setLoadingCart(false);
    })();
  }, [user]);

  const saveAddress = async () => {
    if (!user) return;
    const f = addrForm;
    if (!f.full_name.trim() || !f.line1.trim() || !f.city.trim() || !f.state.trim()) {
      push('error', 'Please fill name, address, city and state'); return;
    }
    if (!/^\d{10}$/.test(f.phone.trim())) { push('error', 'Enter a valid 10-digit phone number'); return; }
    if (!/^\d{6}$/.test(f.pincode.trim())) { push('error', 'Enter a valid 6-digit pincode'); return; }
    const { data, error } = await supabase.from('addresses').insert({
      full_name: f.full_name.trim(), phone: f.phone.trim(), line1: f.line1.trim(),
      line2: f.line2.trim() || null, city: f.city.trim(), state: f.state.trim(), pincode: f.pincode.trim(),
      user_id: user.id,
    }).select().single();
    if (error) { push('error', error.message); return; }
    if (data) {
      setAddresses(prev => [...prev, data as Address]);
      setSelectedAddr(data.id);
      setShowAddrForm(false);
      setAddrForm({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
      push('success', 'Address saved');
    }
  };

  // Opens the Razorpay window. The amount comes from OUR server, and the
  // order is only marked paid after the server checks with Razorpay.
  const startOnlinePayment = async (checkoutId: string, ids: string[]) => {
    const addr = addresses.find(a => a.id === selectedAddr);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Please sign in again');

      const r = await fetch('/api/pay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkout_id: checkoutId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not start the payment');

      const rzp = new window.Razorpay({
        key: j.key,
        amount: j.amount,
        currency: j.currency,
        order_id: j.order_id,
        name: 'Bazaar',
        description: 'Order payment',
        prefill: { name: addr?.full_name, contact: addr?.phone },
        theme: { color: '#e11d48' },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            push('info', 'Payment not completed. Your items are held for 30 minutes. Press Pay to try again.');
          },
        },
        handler: async (resp: any) => {
          try {
            const vr = await fetch('/api/pay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const vj = await vr.json().catch(() => ({}));
            if (vr.ok && (vj.result === 'paid' || vj.result === 'already_paid')) {
              navigate(`/order-success?ids=${ids.join(',')}`);
              return;
            }
            if (vr.ok && vj.result === 'refunded') {
              push('error', 'Your order expired, so the payment was refunded automatically. Please order again.');
              navigate('/cart');
              return;
            }
            push('info', 'We are confirming your payment. Please check My Orders in a minute.');
            navigate('/orders');
          } catch {
            push('info', 'We are confirming your payment. Please check My Orders in a minute.');
            navigate('/orders');
          } finally {
            setPlacing(false);
          }
        },
      });
      rzp.on('payment.failed', (resp: any) => {
        push('error', `Payment failed: ${resp?.error?.description || 'please try again'}`);
      });
      rzp.open();
    } catch (e: any) {
      setPlacing(false);
      push('error', e.message || 'Could not start the payment');
    }
  };

  // The server checks prices, stock and coupon, creates the orders and
  // reduces stock in ONE safe step. The browser sends no prices at all.
  const placeOrder = async () => {
    if (placing) return;
    if (!user || !selectedAddr) { push('error', 'Please select a delivery address'); return; }
    if (groups.length === 0) { push('error', 'Your cart is empty'); return; }
    const online = method === 'online';
    if (online && !window.Razorpay) {
      push('error', 'Payment system is still loading. Please try again in a moment.');
      return;
    }
    setPlacing(true);
    if (online) await supabase.rpc('release_expired_checkouts');
    const { data, error } = await supabase.rpc('place_order', {
      p_address_id: selectedAddr,
      p_payment_method: online ? 'online' : 'cod',
      p_coupon: couponCode || null,
    });
    if (error) { setPlacing(false); push('error', error.message); return; }
    const ids: string[] = (data as any)?.order_ids || [];
    if (ids.length === 0) { setPlacing(false); push('error', 'Order could not be created. Please try again.'); return; }
    if (!online) {
      setPlacing(false);
      navigate(`/order-success?ids=${ids.join(',')}`);
      return;
    }
    await startOnlinePayment((data as any).checkout_id, ids);
  };

  const itemsTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const shippingTotal = groups.length * shipping;
  const discount = estimateDiscount(groups, coupon);
  const grandTotal = itemsTotal + shippingTotal - discount;
  const problem = stockProblem(groups);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/cart')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to Cart
        </button>
        <h1 className="text-xl font-bold text-slate-900 mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">1. Delivery Address</h3>
              {addresses.length > 0 && !showAddrForm && (
                <div className="space-y-2 mb-3">
                  {addresses.map(a => (
                    <label key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selectedAddr === a.id ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" checked={selectedAddr === a.id} onChange={() => setSelectedAddr(a.id)} className="mt-1 text-rose-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{a.full_name} <span className="text-slate-400">{a.phone}</span></p>
                        <p className="text-sm text-slate-500">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} - {a.pincode}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {showAddrForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Full Name" value={addrForm.full_name} onChange={e => setAddrForm({ ...addrForm, full_name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input placeholder="Phone (10 digits)" value={addrForm.phone} onChange={e => setAddrForm({ ...addrForm, phone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <input placeholder="Address Line 1" value={addrForm.line1} onChange={e => setAddrForm({ ...addrForm, line1: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input placeholder="Address Line 2 (optional)" value={addrForm.line2} onChange={e => setAddrForm({ ...addrForm, line2: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <div className="grid grid-cols-3 gap-3">
                    <input placeholder="City" value={addrForm.city} onChange={e => setAddrForm({ ...addrForm, city: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input placeholder="State" value={addrForm.state} onChange={e => setAddrForm({ ...addrForm, state: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input placeholder="Pincode" value={addrForm.pincode} onChange={e => setAddrForm({ ...addrForm, pincode: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveAddress}>Save Address</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddrForm(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddrForm(true)} className="text-sm text-rose-600 font-medium hover:underline">+ Add New Address</button>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">2. Payment Method</h3>
              <div className="space-y-2">
                {ONLINE_ENABLED ? (
                  <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${method === 'online' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" checked={method === 'online'} onChange={() => setMethod('online')} className="text-rose-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Pay online</p>
                      <p className="text-xs text-slate-500">UPI, Credit / Debit Card, Net Banking</p>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-slate-200 bg-slate-50 opacity-70">
                    <input type="radio" disabled />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">Online payment (UPI, Card, Net Banking)</p>
                      <p className="text-xs text-slate-500">Not set up yet</p>
                    </div>
                    <Badge>Soon</Badge>
                  </div>
                )}
                <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${method === 'cod' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" checked={method === 'cod'} onChange={() => setMethod('cod')} className="text-rose-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Cash on Delivery</p>
                    <p className="text-xs text-slate-500">Pay in cash when your order arrives</p>
                  </div>
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {method === 'online'
                  ? 'Secured by Razorpay. Your order is confirmed once the payment is verified.'
                  : 'No online payment needed. Pay cash at delivery.'}
              </p>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-28">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h3>
              {loadingCart ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                    {groups.map(g => (
                      <div key={g.sellerId} className="text-sm">
                        <p className="font-medium text-slate-700 text-xs mb-1">{g.sellerName}</p>
                        {g.items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs text-slate-500 py-0.5">
                            <span className="truncate flex-1 mr-2">{item.product?.name} × {item.quantity}</span>
                            <span>{formatINR((item.product?.selling_price || 0) * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatINR(itemsTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium">{formatINR(shippingTotal)}</span></div>
                    {coupon && discount > 0 && (
                      <div className="flex justify-between text-emerald-600"><span>Discount ({coupon.code})</span><span className="font-medium">-{formatINR(discount)}</span></div>
                    )}
                    <div className="border-t border-slate-100 pt-2 flex justify-between"><span className="font-semibold text-slate-900">Total</span><span className="text-lg font-bold text-rose-600">{formatINR(grandTotal)}</span></div>
                    <p className="text-xs text-slate-400">The final amount is confirmed when you place the order.</p>
                  </div>
                </>
              )}
              {problem && <p className="mt-3 text-xs text-red-600">{problem}. Please go back and reduce the quantity.</p>}
              <Button onClick={placeOrder} loading={placing} size="lg" className="w-full mt-4" disabled={!selectedAddr || placing || groups.length === 0 || !!problem}>
                {method === 'online' ? `💳 Pay ${formatINR(grandTotal)}` : '📦 Place Order (Cash on Delivery)'}
              </Button>
              {method === 'online' && <p className="text-center text-xs text-slate-400 mt-2">Powered by Razorpay</p>}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
