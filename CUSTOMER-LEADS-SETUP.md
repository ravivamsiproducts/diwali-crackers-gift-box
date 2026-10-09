# Customer enquiry workflow setup

This feature collects delivery enquiries, not paid orders. It does not enable Razorpay or reserve stock.

## 1. Apply the database migration
In the Supabase Dashboard for project `zauxvekgomywxmgtaife`, open **SQL Editor**, run the complete contents of `supabase/migrations/202610090001_customer_leads.sql`, and verify it completes. The migration seeds the 95 PIN codes currently listed in the storefront. Check those codes against actual delivery routes before accepting enquiries.

## 2. Deploy the Edge Function
From the repository root, with the Supabase CLI authenticated to the correct project, run:

```sh
supabase link --project-ref zauxvekgomywxmgtaife
supabase functions deploy submit-lead --project-ref zauxvekgomywxmgtaife
```

The checked-in `supabase/config.toml` marks this one function as public because storefront visitors are not signed in. The function validates the PIN, contact fields, product availability and totals on the server; the service-role key is used only by the deployed function and must never be copied into frontend code. A small honeypot helps reject simple bots but is not a substitute for production rate-limiting or CAPTCHA if abuse appears.

## 3. Verify admin access
The existing admin sign-in depends on the `public.is_admin()` RPC. Only users for whom it returns true can read or update customer enquiries under the new RLS policies. Test with a non-admin account to confirm access is denied.

## 4. Test before announcing
Submit a test enquiry with a serviceable PIN, then confirm it appears in Admin. Test an unsupported PIN, invalid phone, unavailable product and a non-admin session. Delete test customer data after verification. A submitted enquiry is **not** an order confirmation, stock reservation or payment.
