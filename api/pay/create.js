import { env, missingConfig, getUserId, select, rpc, razorpay } from '../_lib.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (missingConfig().length) return res.status(503).json({ error: 'Online payment is not configured yet' });

  try {
    const uid = await getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Please sign in again' });

    const checkoutId = (req.body && req.body.checkout_id) || '';
    if (!UUID.test(checkoutId)) return res.status(400).json({ error: 'Invalid request' });

    // The amount always comes from OUR database, never from the browser.
    const rows = await select(
      `checkouts?id=eq.${checkoutId}&customer_id=eq.${uid}&select=id,total,status,gateway_order_id`
    );
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'Checkout not found' });
    if (c.status !== 'created') return res.status(409).json({ error: 'This checkout is no longer open. Please place the order again.' });

    const amount = Math.round(Number(c.total) * 100);
    if (!Number.isFinite(amount) || amount < 100) return res.status(400).json({ error: 'Invalid amount' });

    let gatewayOrderId = c.gateway_order_id;
    if (!gatewayOrderId) {
      const order = await razorpay('/orders', 'POST', {
        amount,
        currency: 'INR',
        receipt: checkoutId.replace(/-/g, '').slice(0, 40),
        notes: { checkout_id: checkoutId },
      });
      gatewayOrderId = order.id;
      await rpc('set_checkout_gateway_order', { p_checkout: checkoutId, p_gw_order: gatewayOrderId });
    }

    return res.status(200).json({ key: env('RAZORPAY_KEY_ID'), order_id: gatewayOrderId, amount, currency: 'INR' });
  } catch (e) {
    console.error('pay/create error:', e.message);
    return res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
}
