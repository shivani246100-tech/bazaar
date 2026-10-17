import crypto from 'node:crypto';
import { env, missingConfig, getUserId, select, safeEqual, finalizePayment } from '../_lib.js';

const ID = /^[A-Za-z0-9_]{5,64}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (missingConfig().length) return res.status(503).json({ error: 'Online payment is not configured yet' });

  try {
    const uid = await getUserId(req);
    if (!uid) return res.status(401).json({ error: 'Please sign in again' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (![razorpay_order_id, razorpay_payment_id].every((v) => typeof v === 'string' && ID.test(v))
        || typeof razorpay_signature !== 'string') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const expected = crypto.createHmac('sha256', env('RAZORPAY_KEY_SECRET'))
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!safeEqual(expected, razorpay_signature)) {
      return res.status(400).json({ error: 'Payment signature is invalid' });
    }

    const rows = await select(
      `checkouts?gateway_order_id=eq.${encodeURIComponent(razorpay_order_id)}&customer_id=eq.${uid}&select=id`
    );
    if (!rows.length) return res.status(404).json({ error: 'Checkout not found' });

    const out = await finalizePayment(rows[0].id, razorpay_payment_id, razorpay_order_id);
    return res.status(200).json(out || { result: 'unknown' });
  } catch (e) {
    console.error('pay/verify error:', e.message);
    return res.status(500).json({
      error: 'We could not confirm the payment yet. If money was deducted, your order will be confirmed automatically.',
    });
  }
}
