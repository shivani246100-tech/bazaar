import crypto from 'node:crypto';

export const env = (name) => process.env[name] || '';

const supabaseBase = () => env('SUPABASE_URL').replace(/\/$/, '');

export function missingConfig() {
  return ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']
    .filter((k) => !env(k));
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Who is calling? Ask Supabase to verify the login token. Never trust the browser's word.
export async function getUserId(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const r = await fetch(`${supabaseBase()}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u.id : null;
}

async function supabaseFetch(path, options = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${supabaseBase()}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Database call ${path.split('?')[0]} failed (${r.status})`);
  return text ? JSON.parse(text) : null;
}

export const rpc = (name, args) =>
  supabaseFetch(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });

export const select = (query) => supabaseFetch(`/rest/v1/${query}`);

export async function razorpay(path, method = 'GET', body) {
  const auth = Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64');
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Razorpay ${path.split('?')[0]} failed (${r.status})`);
  return j;
}

// Ask Razorpay (the trusted source) what really happened, then update the order.
// Safe to run many times for the same payment.
export async function finalizePayment(checkoutId, paymentId, expectedOrderId) {
  let p = await razorpay(`/payments/${paymentId}`);
  if (p.order_id !== expectedOrderId) return { result: 'order_mismatch' };
  if (p.status === 'authorized') {
    p = await razorpay(`/payments/${paymentId}/capture`, 'POST', { amount: p.amount, currency: p.currency });
  }
  if (p.status !== 'captured') return { result: 'not_captured', status: p.status };

  const out = await rpc('mark_checkout_paid', {
    p_checkout: checkoutId,
    p_gw_payment: paymentId,
    p_method: p.method || 'online',
    p_amount_paise: p.amount,
  });

  if (out && out.result === 'needs_refund') {
    const refund = await razorpay(`/payments/${paymentId}/refund`, 'POST', {
      amount: p.amount,
      notes: { reason: 'order cancelled or expired before payment', checkout: checkoutId },
    });
    await rpc('mark_checkout_refunded', { p_checkout: checkoutId, p_gw_payment: paymentId, p_refund_id: refund.id });
    return { result: 'refunded' };
  }
  return out;
}
