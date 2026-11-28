// Paystack webhook -> records VERIFIED payments in the fp_payments table.
// Paystack calls this address after every successful payment and refund. We only trust a call if its
// signature matches your secret key, so nobody can fake a sale by calling this address themselves.
// Secrets needed (set in Supabase, never in the website): PAYSTACK_SECRET_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const enc = new TextEncoder();

export async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string): boolean {            // constant-time compare
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function handle(req: Request, env: { get(k: string): string | undefined }, doFetch: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });
  const secret = env.get('PAYSTACK_SECRET_KEY');
  const url = env.get('SUPABASE_URL');
  const svc = env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !svc) return new Response('not configured', { status: 500 });

  const raw = await req.text();
  const given = (req.headers.get('x-paystack-signature') || '').toLowerCase();
  if (!given || !same(given, await sign(secret, raw))) return new Response('bad signature', { status: 401 });

  let evt: any;
  try { evt = JSON.parse(raw); } catch (_) { return new Response('bad json', { status: 400 }); }
  const d = evt.data || {};
  const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
  const T = url + '/rest/v1/fp_payments';

  if (evt.event === 'charge.success' && d.status === 'success' && d.reference) {
    const row: any = {
      reference: String(d.reference), status: 'success', currency: d.currency || 'NGN',
      amount_ngn: Number(d.amount || 0) / 100, channel: d.channel || null,
    };
    if (d.paid_at || d.paidAt) row.paid_at = d.paid_at || d.paidAt;       // otherwise the database stamps the time it arrived
    const r = await doFetch(T + '?on_conflict=reference', { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) return new Response('db error', { status: 500 });          // Paystack will retry
  } else if (evt.event === 'refund.processed') {
    const ref = String(d.transaction_reference || (d.transaction && d.transaction.reference) || '');
    const amt = Number(d.amount || 0) / 100;
    if (ref && amt > 0) {
      const g = await doFetch(T + '?reference=eq.' + encodeURIComponent(ref) + '&select=refunded_ngn', { headers: H });
      const cur = g.ok ? ((await g.json())[0] || null) : null;
      if (cur) {
        const r = await doFetch(T + '?reference=eq.' + encodeURIComponent(ref), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ refunded_ngn: Number(cur.refunded_ngn || 0) + amt }) });
        if (!r.ok) return new Response('db error', { status: 500 });
      }
    }
  }
  return new Response('ok', { status: 200 });
}

// @ts-ignore Deno is provided by Supabase
if (typeof Deno !== 'undefined' && (Deno as any).serve) (Deno as any).serve((req: Request) => handle(req, (Deno as any).env));
