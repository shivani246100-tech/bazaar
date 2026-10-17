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
  shipping: number;
  total: number;
}

// ✅ Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

export function CartPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const [groups, setGroups] = useState<SellerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  const fetchCart = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('cart_items')
      .select('*, product:products(*, seller:seller_profiles(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const items = (data as any) || [];
    const map = new Map<string, SellerGroup>();
    for (const item of items) {
      const sellerId = item.product?.seller_id;
      if (!sellerId) continue;
      if (!map.has(sellerId)) {
        map.set(sellerId, {
          sellerId,
          sellerName: item.product?.seller?.store_name || 'Seller',
          items: [],
          subtotal: 0, shipping: 49, total: 0,
        });
      }
      const g = map.get(sellerId)!;
      g.items.push(item);
      g.subtotal += item.product.selling_price * item.quantity;
    }
    const arr = Array.from(map.values());
    arr.forEach(g => { g.total = g.subtotal + g.shipping; });
    setGroups(arr);
    setLoading(false);
  };

  useEffect(() => { fetchCart(); }, [user]);

  const updateQty = async (itemId: string, qty: number) => {
    if (qty < 1) return;
    await supabase.from('cart_items').update({ quantity: qty }).eq('id', itemId);
    fetchCart();
  };

  const removeItem = async (itemId: string) => {
    await supabase.from('cart_items').delete().eq('id', itemId);
    push('info', 'Item removed from cart');
    fetchCart();
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const { data: coupon } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).maybeSingle();
    if (!coupon) { push('error', 'Invalid coupon code'); return; }
    const grandTotal = groups.reduce((s, g) => s + g.total, 0);
    if (grandTotal < coupon.min_order_value) { push('error', `Minimum order ${formatINR(coupon.min_order_value)} required`); return; }
    let disc = 0;
    if (coupon.discount_type === 'percentage') {
      disc = (grandTotal * coupon.discount_value) / 100;
      if (coupon.max_discount) disc = Math.min(disc, coupon.max_discount);
    } else {
      disc = coupon.discount_value;
    }
    setAppliedCoupon({ code: coupon.code, discount: Math.round(disc) });
    push('success', `Coupon ${coupon.code} applied! You save ${formatINR(Math.round(disc))}`);
  };

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const finalTotal = appliedCoupon ? grandTotal - appliedCoupon.discount : grandTotal;

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
                        {item.product?.product_images?.[0]?.image_url ? (
                          <img src={item.product.product_images[0].image_url} alt="" className="w-full h-full object-cover" />
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
                  <span className="text-slate-500">Shipping: <span className="font-semibold text-slate-800">{formatINR(g.shipping)}</span></span>
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-28">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-800">{formatINR(grandTotal - groups.length * 49)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium text-slate-800">{formatINR(groups.length * 49)}</span></div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600"><span>Discount ({appliedCoupon.code})</span><span className="font-medium">-{formatINR(appliedCoupon.discount)}</span></div>
                )}
                <div className="border-t border-slate-100 pt-2 flex justify-between"><span className="font-semibold text-slate-900">Total</span><span className="text-lg font-bold text-rose-600">{formatINR(finalTotal)}</span></div>
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
              <Button onClick={() => navigate(`/checkout${appliedCoupon ? `?coupon=${appliedCoupon.code}` : ''}`)} size="lg" className="w-full mt-4">
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
  const query = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
  const couponCode = query.get('coupon') || '';

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string>('');
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [groups, setGroups] = useState<SellerGroup[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      const { data: addrs } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false });
      setAddresses(addrs || []);
      if (addrs && addrs.length > 0) setSelectedAddr(addrs[0].id);

      const { data: cartItems } = await supabase.from('cart_items').select('*, product:products(*, seller:seller_profiles(*))').eq('user_id', user.id);
      const items = (cartItems as any) || [];
      const map = new Map<string, SellerGroup>();
      for (const item of items) {
        const sid = item.product?.seller_id;
        if (!sid) continue;
        if (!map.has(sid)) map.set(sid, { sellerId: sid, sellerName: item.product?.seller?.store_name || 'Seller', items: [], subtotal: 0, shipping: 49, total: 0 });
        const g = map.get(sid)!;
        g.items.push(item);
        g.subtotal += item.product.selling_price * item.quantity;
      }
      const arr = Array.from(map.values());
      arr.forEach(g => { g.total = g.subtotal + g.shipping; });
      setGroups(arr);
    })();
  }, [user]);

  const saveAddress = async () => {
    if (!user) return;
    const { data } = await supabase.from('addresses').insert({ ...addrForm, user_id: user.id }).select().single();
    if (data) {
      setAddresses(prev => [...prev, data as Address]);
      setSelectedAddr(data.id);
      setShowAddrForm(false);
      setAddrForm({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
      push('success', 'Address saved');
    }
  };

  // ✅ CREATE ORDER IN DB FIRST, THEN OPEN RAZORPAY
  const placeOrder = async () => {
    if (!user || !selectedAddr) { push('error', 'Please select a delivery address'); return; }
    if (groups.length === 0) { push('error', 'Your cart is empty'); return; }
    if (paymentMethod !== 'cod' && !window.Razorpay) {
      push('error', 'Payment system loading... please try again');
      return;
    }
    setPlacing(true);

    const addr = addresses.find(a => a.id === selectedAddr);
    if (!addr) { setPlacing(false); return; }

    const shippingAddress = {
      full_name: addr.full_name, phone: addr.phone,
      line1: addr.line1, line2: addr.line2,
      city: addr.city, state: addr.state, pincode: addr.pincode,
    };

    // Create orders in DB
    const orderIds: string[] = [];
    const orderNumbers: string[] = [];
    for (const g of groups) {
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const { data: order } = await supabase.from('orders').insert({
        order_number: orderNumber,
        customer_id: user.id,
        seller_id: g.sellerId,
        status: 'pending',
        payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
        payment_method: paymentMethod,
        subtotal: g.subtotal,
        shipping_charge: g.shipping,
        discount: 0,
        total: g.total,
        commission_amount: Math.round(g.subtotal * 0.1),
        seller_amount: g.subtotal - Math.round(g.subtotal * 0.1),
        shipping_address: shippingAddress,
        coupon_code: couponCode || null,
      }).select().single();

      if (order) {
        orderIds.push(order.id);
        orderNumbers.push(orderNumber);
        for (const item of g.items) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product?.name || '',
            product_image: item.product?.product_images?.[0]?.image_url || null,
            variant_name: null,
            quantity: item.quantity,
            unit_price: item.product?.selling_price || 0,
            total_price: (item.product?.selling_price || 0) * item.quantity,
          });
          await supabase.from('products').update({
            stock: Math.max(0, (item.product?.stock || 0) - item.quantity),
            sales_count: (item.product?.sales_count || 0) + item.quantity,
          }).eq('id', item.product_id);
        }
        const sellerUserId = g.items[0]?.product?.seller?.user_id;
        if (sellerUserId) {
          await supabase.from('notifications').insert({
            user_id: sellerUserId,
            title: 'New Order Received',
            body: `Order ${orderNumber} — ${g.items.length} items — ${formatINR(g.total)}`,
            type: 'order',
            link: '/seller/orders',
          });
        }
      }
    }

    const grandTotal = groups.reduce((s, g) => s + g.total, 0);

    // ✅ COD — direct confirm
    if (paymentMethod === 'cod') {
      await supabase.from('cart_items').delete().eq('user_id', user.id);
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Order Placed!',
        body: `Your COD order has been placed. Order: ${orderNumbers[0]}`,
        type: 'order',
        link: '/orders',
      });
      setPlacing(false);
      push('success', 'Order placed! Pay on delivery.');
      navigate(`/order-success?ids=${orderIds.join(',')}`);
      return;
    }

    // ✅ RAZORPAY — open payment popup
    setPlacing(false);
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: grandTotal * 100, // paise mein
      currency: 'INR',
      name: 'Bazaar',
      description: `Order${orderNumbers.length > 1 ? 's' : ''}: ${orderNumbers.join(', ')}`,
      image: '/icon.svg',
      handler: async (response: any) => {
        // ✅ Payment successful — update all orders
        for (const orderId of orderIds) {
          await supabase.from('orders').update({
            payment_status: 'paid',
            status: 'confirmed',
          }).eq('id', orderId);

          await supabase.from('payments').insert({
            order_id: orderId,
            amount: grandTotal,
            currency: 'INR',
            payment_method: paymentMethod,
            gateway: 'razorpay',
            gateway_payment_id: response.razorpay_payment_id,
            gateway_order_id: response.razorpay_order_id || '',
            gateway_signature: response.razorpay_signature || '',
            status: 'completed',
          });
        }

        await supabase.from('cart_items').delete().eq('user_id', user.id);
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: '✅ Payment Successful!',
          body: `Payment of ${formatINR(grandTotal)} received. Order confirmed!`,
          type: 'order',
          link: '/orders',
        });

        push('success', `Payment successful! ₹${grandTotal} paid.`);
        navigate(`/order-success?ids=${orderIds.join(',')}`);
      },
      prefill: {
        name: user.name || '',
        email: user.email || '',
        contact: addr?.phone || '',
      },
      notes: {
        order_ids: orderIds.join(','),
        customer_id: user.id,
      },
      theme: { color: '#f43f5e' },
      modal: {
        ondismiss: async () => {
          // ✅ User closed popup — mark as failed
          for (const orderId of orderIds) {
            await supabase.from('orders').update({
              payment_status: 'failed',
              status: 'cancelled',
            }).eq('id', orderId);
          }
          await supabase.from('cart_items').delete().eq('user_id', user.id);
          push('error', 'Payment cancelled. Orders have been cancelled.');
          navigate('/orders');
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', async (response: any) => {
      for (const orderId of orderIds) {
        await supabase.from('orders').update({
          payment_status: 'failed',
          status: 'cancelled',
        }).eq('id', orderId);
      }
      push('error', `Payment failed: ${response.error.description}`);
    });
    rzp.open();
  };

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

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
                    <input placeholder="Phone" value={addrForm.phone} onChange={e => setAddrForm({ ...addrForm, phone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
                {[
                  { id: 'upi', label: 'UPI', desc: 'GPay, PhonePe, Paytm — instant payment' },
                  { id: 'card', label: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay — all cards accepted' },
                  { id: 'netbanking', label: 'Net Banking', desc: 'All major banks supported' },
                  { id: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives' },
                ].map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === p.id ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" checked={paymentMethod === p.id} onChange={() => setPaymentMethod(p.id)} className="text-rose-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.label}</p>
                      <p className="text-xs text-slate-500">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7v6c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7l-10-5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {paymentMethod === 'cod' ? 'No online payment needed. Pay cash at delivery.' : 'Secured by Razorpay · 256-bit SSL encryption · PCI DSS compliant'}
              </p>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-28">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h3>
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
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatINR(grandTotal - groups.length * 49)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium">{formatINR(groups.length * 49)}</span></div>
                <div className="border-t border-slate-100 pt-2 flex justify-between"><span className="font-semibold text-slate-900">Total</span><span className="text-lg font-bold text-rose-600">{formatINR(grandTotal)}</span></div>
              </div>
              <Button onClick={placeOrder} loading={placing} size="lg" className="w-full mt-4" disabled={!selectedAddr || placing}>
                {paymentMethod === 'cod' ? '📦 Place COD Order' : `💳 Pay ${formatINR(grandTotal)}`}
              </Button>
              {paymentMethod !== 'cod' && (
                <p className="text-center text-xs text-slate-400 mt-2">Powered by Razorpay</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
