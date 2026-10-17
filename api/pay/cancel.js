import { missingConfig, getUserId, rpc, razorpay } from '../_lib.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (missingConfig().length) return res.status(503).json({ error: 'Online payment is not configured yet' });

  const uid = await getUserId(req).catch(() => null);
  if (!uid) return res.status(401).json({ error: 'Please sign in again' });

  const orderId = (req.body && req.body.order_id) || '';
  if (!UUID.test(orderId)) return res.status(400).json({ error: 'Invalid request' });
  const reason = String((req.body && req.body.reason) || 'Cancelled by customer').slice(0, 200);

  // Step 1: cancel the order on our side (safe to repeat)
  let info;
  try {
    info = await rpc('begin_paid_cancel', { p_order: orderId, p_customer: uid, p_reason: reason });
  } catch (e) {
    console.error('pay/cancel begin error:', e.message);
    return res.status(500).json({ error: 'Could not cancel the order. Please try again.' });
  }
  if (info && info.error) return res.status(409).json({ error: info.error });

  // Step 2: refund the money (never refunds the same order twice)
  try {
    const existing = await razorpay(`/payments/${info.payment_id}/refunds?count=100`);
    let refund = (existing.items || []).find((r) => r.notes && r.notes.order_id === orderId) || null;
    if (!refund) {
      refund = await razorpay(`/payments/${info.payment_id}/refund`, 'POST', {
        amount: info.amount_paise,
        speed: 'normal',
        notes: { order_id: orderId, reason },
      });
    }
    await rpc('complete_order_refund', { p_order: orderId, p_refund_id: refund.id });
    return res.status(200).json({ result: 'refunded', order_number: info.order_number });
  } catch (e) {
    console.error('pay/cancel refund error:', e.message);
    return res.status(500).json({
      error: 'Your order is cancelled, but the refund could not be completed yet. Please press "Retry Refund" in a minute, or contact support.',
    });
  }
}
