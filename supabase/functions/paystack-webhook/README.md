# Paystack webhook (verified payments)

Records every successful Paystack payment and refund in the `fp_payments` table so the dashboard can show revenue that Paystack itself confirmed.

Set up (about 10 minutes, all in your browser):
1. Supabase -> SQL Editor: run `dash/migration-b.sql` (if not already) then `dash/migration-d.sql`.
2. Supabase -> Edge Functions -> Create a new function named `paystack-webhook`. Paste the contents of `index.ts`. Turn **Verify JWT** OFF for this function (Paystack cannot send one; the signature check replaces it). Deploy.
3. Supabase -> Edge Functions -> Secrets: add `PAYSTACK_SECRET_KEY` with your Paystack secret key (Paystack dashboard -> Developers). Do not put the key anywhere else.
4. Paystack dashboard -> Developers -> API keys & Webhooks: set the **Live webhook URL** to `https://<your-project-ref>.supabase.co/functions/v1/paystack-webhook` and save.
5. Make one real payment (or use Paystack's webhook test) and check the dashboard's "Verified payments" section.

Safe by design: a call is only accepted if its signature matches your secret key; the table has no names, emails or phone numbers; the website never sees the key.
