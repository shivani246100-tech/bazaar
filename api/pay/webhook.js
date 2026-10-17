import crypto from 'node:crypto';
import { env, missingConfig, select, rpc, safeEqual, finalizePayment } from '../_lib.js';

export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = env('RAZORPAY_WEBHOOK_SECRET');
  if (!secret || missingConfig().length) return res.status(503).json({ error: 'Webhook not configured' });

  const raw = await readRaw(req);
  const signature = req.headers['x-razorpay-signature'] || '';
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!safeEqual(expected, signature)) return res.status(400).json({ error: 'Invalid signature' });

  let evt;
  try { evt = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Bad body' }); }

  try {
    const type = evt.event;
    const pay = evt.payload && evt.payload.payment && evt.payload.payment.entity;

    if (['payment.captured', 'payment.authorized', 'order.paid'].includes(type) && pay && pay.order_id && pay.id) {
      const rows = await select(`checkouts?gateway_order_id=eq.${encodeURIComponent(pay.order_id)}&select=id`);
      if (rows.length) await finalizePayment(rows[0].id, pay.id, pay.order_id);
    }

    const eventId = req.headers['x-razorpay-event-id'];
    if (eventId) {
      await rpc('log_payment_event', {
        p_event: String(eventId),
        p_type: String(type || ''),
        p_payload: { payment_id: pay && pay.id, order_id: pay && pay.order_id, status: pay && pay.status },
      });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('pay/webhook error:', e.message);
    return res.status(500).json({ error: 'Processing failed' });
  }
}
