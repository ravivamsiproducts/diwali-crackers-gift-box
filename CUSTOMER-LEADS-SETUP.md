# Customer enquiry workflow setup

This feature collects delivery enquiries, not paid orders. It does not enable Razorpay or reserve stock.

## 1. Apply the database migration
In the Supabase Dashboard for project `zauxvekgomywxmgtaife`, open **SQL Editor**, run the complete contents of `supabase/migrations/202610090001_customer_leads.sql`, and verify it completes. The migration seeds the PIN codes already listed in the storefront. Check those codes against real delivery routes before accepting enquiries.

## 2. Deploy the Edge Function
Deploy `supabase/functions/submit-lead/index.ts` as the function named `submit-lead` in the same Supabase project. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions; keep the service-role key server-side only. Keep the publishable key in the storefront; never put service-role keys or payment secrets in frontend code.

## 3. Verify admin access
The existing admin sign-in depends on the `public.is_admin()` RPC. Only users for whom it returns true can read or update customer enquiries under the new RLS policies. Test with a non-admin account to confirm access is denied.

## 4. Test before announcing
Submit a test enquiry with a serviceable PIN, then confirm it appears in Admin. Test an unsupported PIN, invalid phone, unavailable product and a non-admin session. Delete test customer data after verification. A submitted enquiry is **not** an order confirmation, stock reservation or payment.
