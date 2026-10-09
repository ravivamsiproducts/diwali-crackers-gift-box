import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const allowedMapsUrl = (value: string) => {
  if (!value) return true;
  try {
    const u = new URL(value), host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (host === "google.com" || host.endsWith(".google.com") || host === "maps.app.goo.gl" || host === "goo.gl");
  } catch { return false; }
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { success: false, error: "Method not allowed." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply(500, { success: false, error: "Server configuration is incomplete." });
  try {
    const body = await req.json();
    if (text(body.company_website, 200)) return reply(200, { success: true, reference: "received" });
    const customer_name = text(body.customer_name, 100), phone = text(body.phone, 10), address = text(body.address, 500);
    const locality = text(body.locality, 100), pincode = text(body.pincode, 6), delivery_notes = text(body.delivery_notes, 300);
    const maps_url = body.maps_url == null ? null : text(body.maps_url, 1000);
    if (customer_name.length < 2 || !/^[0-9]{10}$/.test(phone) || address.length < 5 || locality.length < 2 || !/^[0-9]{6}$/.test(pincode))
      return reply(400, { success: false, error: "Please check the name, 10-digit phone, address, area and PIN code." });
    if (!allowedMapsUrl(maps_url || "")) return reply(400, { success: false, error: "Please provide a valid HTTPS Google Maps link." });
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return reply(400, { success: false, error: "Please add at least one gift box." });
    const seen = new Set<string>(), requested: { product_id: string; quantity: number }[] = [];
    for (const item of body.items) {
      if (!item || typeof item.product_id !== "string" || !/^[0-9a-f-]{36}$/i.test(item.product_id) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || seen.has(item.product_id))
        return reply(400, { success: false, error: "One or more gift box quantities are invalid." });
      seen.add(item.product_id); requested.push({ product_id: item.product_id, quantity: item.quantity });
    }
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: pin, error: pinError } = await db.from("serviceable_pincodes").select("pincode").eq("pincode", pincode).eq("is_active", true).maybeSingle();
    if (pinError) throw pinError;
    if (!pin) return reply(400, { success: false, error: "Delivery is not available for this PIN code." });
    const { data: products, error: productsError } = await db.from("products").select("id,name,price_paise,stock_quantity,is_active").in("id", requested.map(x => x.product_id));
    if (productsError) throw productsError;
    const byId = new Map((products || []).map(p => [p.id, p]));
    let subtotal_paise = 0; const items = [];
    for (const item of requested) {
      const p = byId.get(item.product_id);
      if (!p || !p.is_active || Number(p.stock_quantity) < item.quantity || !Number.isSafeInteger(Number(p.price_paise)) || Number(p.price_paise) < 0)
        return reply(400, { success: false, error: "A selected gift box is unavailable or has insufficient stock. Refresh the catalogue and try again." });
      subtotal_paise += Number(p.price_paise) * item.quantity;
      if (!Number.isSafeInteger(subtotal_paise)) return reply(400, { success: false, error: "The requested total is too large." });
      items.push({ product_id: p.id, name: p.name, unit_price_paise: Number(p.price_paise), quantity: item.quantity });
    }
    const reference = "LEAD-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const { error: insertError } = await db.from("customer_leads").insert({
      reference, customer_name, phone, address, locality, pincode, delivery_notes, maps_url: maps_url || null,
      items, subtotal_paise, status: "new_lead"
    });
    if (insertError) throw insertError;
    return reply(200, { success: true, reference });
  } catch (error) {
    console.error("submit-lead failed:", error);
    return reply(500, { success: false, error: "We could not submit your enquiry right now. Please try again later." });
  }
});
