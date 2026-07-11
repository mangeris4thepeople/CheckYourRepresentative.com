// =============================================================================
// POST /api/checkout - creates a Stripe Checkout session for one product
// -----------------------------------------------------------------------------
// Body: { productKey, size }
// Returns: { url } to redirect the buyer to Stripe's hosted checkout.
// Stripe collects card + shipping address. You see every order in the Stripe
// dashboard, then place the matching Printful order to that address.
// Fulfillment automation can come later. Money works today.
//
// SETUP (one time, in Vercel -> Settings -> Environment Variables):
//   STRIPE_SECRET_KEY = sk_live_... (from dashboard.stripe.com -> Developers -> API keys)
// Until that key exists, this endpoint returns 503 and the site stays in
// waitlist mode automatically. Nothing breaks either way.
// =============================================================================

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.SITE_URL || "https://checkyourrepresentative.com";

// Prices in cents. Keys must match PRODUCT_KEYS in Merch.jsx.
const CATALOG = {
  impeachment_ballot: { name: "Impeachment Is On The Ballot Tee", amount: 3400 },
  we_the_people:      { name: "We The People Demand Accountability Tee", amount: 3200 },
  work_for_us:        { name: "They Work For Us. Not The Donors. Tee", amount: 3200 },
  watching_your_rep:  { name: "We're Watching Your Rep Tee", amount: 3400 },
  not_partisan:       { name: "Accountability Is Not Partisan Tee", amount: 3000 },
  article_impeach:    { name: "Article Of Impeachment Tee", amount: 3400 },
};
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!STRIPE_KEY) return res.status(503).json({ error: "payments_not_configured" });

  try {
    const { productKey, size } = req.body || {};
    const product = CATALOG[productKey];
    if (!product) return res.status(400).json({ error: "unknown_product" });
    if (!SIZES.includes(size)) return res.status(400).json({ error: "unknown_size" });

    // Stripe REST API directly, no SDK dependency needed.
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${SITE_URL}/?purchase=success`);
    params.append("cancel_url", `${SITE_URL}/?purchase=cancelled`);
    params.append("shipping_address_collection[allowed_countries][0]", "US");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][unit_amount]", String(product.amount));
    params.append("line_items[0][price_data][product_data][name]", `${product.name} (${size})`);
    params.append("metadata[product_key]", productKey);
    params.append("metadata[size]", size);
    // Flat shipping. Change the amount here if your Printful shipping differs.
    params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "599");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    params.append("shipping_options[0][shipping_rate_data][display_name]", "Standard shipping");

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await r.json();
    if (!r.ok || !session.url) {
      console.error("Stripe error:", session.error?.message || session);
      return res.status(502).json({ error: "stripe_error" });
    }
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("checkout fatal:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
