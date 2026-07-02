// =============================================================================
// Merch.jsx - CYR Merch Store tab
// Displays all shirt/hat designs with buy buttons
// Printful store URL wired in via STORE_URL constant below
// =============================================================================
import React, { useState } from "react";

const C = {
  crimson: "#C41E3A", navy: "#0A1A3F", gold: "#C9A227",
  black: "#0A0A0A", parchment: "#F5F0E8", muted: "#5C5347",
  line: "#D8C9A0", panel: "#FBF7EC", ink: "#1A1A1A",
};
const serif = "Georgia, 'Times New Roman', serif";
const impact = "'Arial Black', Impact, sans-serif";
const mono = "'Courier New', Courier, monospace";

// ── SWAP THIS URL when Printful store is live ──
const STORE_URL = "https://checkyourrepresentative.com/merch";

const PRODUCTS = [
  {
    id: 1,
    name: "IMPEACHMENT IS ON THE BALLOT",
    sub: "The shirt that makes reps sweat",
    color: "Black heavyweight tee",
    price: "$34",
    tag: "BESTSELLER",
    tagColor: C.crimson,
    bg: "#0A0A0A",
    textColor: "#FFFFFF",
    accentColor: C.crimson,
    goldColor: "#D4A843",
    design: "impeachment",
    description: "Wear this to your rep's next town hall. Article II §4 citation on the back. They know exactly what it means.",
  },
  {
    id: 2,
    name: "WE THE PEOPLE DEMAND ACCOUNTABILITY",
    sub: "The flagship. Left, right, center - everyone wears this.",
    color: "Black heavyweight tee",
    price: "$32",
    tag: "MOST POPULAR",
    tagColor: "#D4A843",
    bg: "#0A0A0A",
    textColor: "#FFFFFF",
    accentColor: "#D4A843",
    goldColor: "#D4A843",
    design: "demand",
    description: "The statement that unites every American who's tired of being ignored. Bold. Unapologetic. Undeniable.",
  },
  {
    id: 3,
    name: "THEY WORK FOR US. NOT THE DONORS.",
    sub: "Hits left AND right. Nobody argues with this.",
    color: "Cream/natural tee",
    price: "$32",
    tag: null,
    bg: "#F5F0E0",
    textColor: "#0A0A0A",
    accentColor: C.crimson,
    goldColor: C.crimson,
    design: "donors",
    description: "Everyone hates donor-bought politicians. This shirt says it out loud. Starts conversations everywhere you go.",
  },
  {
    id: 4,
    name: "WE'RE WATCHING YOUR REP.",
    sub: "Conspiratorial energy. Goes viral.",
    color: "Midnight navy tee",
    price: "$34",
    tag: "GOES VIRAL",
    tagColor: "#1A3A6B",
    bg: "#1A1A2E",
    textColor: "#FFFFFF",
    accentColor: "#D4A843",
    goldColor: "#D4A843",
    design: "watching",
    description: "The eye design hits different. Progressives AND patriots will wear this. Post it on X and watch it spread.",
  },
  {
    id: 5,
    name: "ACCOUNTABILITY IS NOT PARTISAN.",
    sub: "The crossover piece. Nobody can argue with it.",
    color: "White tee · Navy left / Red right wash",
    price: "$30",
    tag: null,
    bg: "#F0F0F0",
    textColor: "#0A0A0A",
    accentColor: C.crimson,
    goldColor: "#1A3A6B",
    design: "partisan",
    description: "The one shirt that crosses every aisle. Blue or red - they answer to us.",
  },
  {
    id: 6,
    name: "ARTICLE OF IMPEACHMENT",
    sub: "In the Court of Public Opinion.",
    color: "Cream parchment tee",
    price: "$34",
    tag: "TOWN HALL READY",
    tagColor: "#8B6914",
    bg: "#F5F0E0",
    textColor: "#0A0A0A",
    accentColor: C.crimson,
    goldColor: C.crimson,
    design: "article",
    description: "Legal document aesthetic. 'We the People find you in contempt.' Unsettling because it looks official.",
  },
  {
    id: 7,
    name: "ELECTION DAY IS COMING.",
    sub: "No words needed. They know what it means.",
    color: "Black tee · Red clock",
    price: "$34",
    tag: null,
    bg: "#0A0A0A",
    textColor: "#FFFFFF",
    accentColor: C.crimson,
    goldColor: C.crimson,
    design: "clock",
    description: "A clock almost at midnight. Every rep sees this at a town hall and feels it in their gut.",
  },
  {
    id: 8,
    name: "WE HAVE THE RECEIPTS.",
    sub: "Their actual voting record. On a shirt.",
    color: "Black tee · Data print",
    price: "$34",
    tag: "LIMITED",
    tagColor: "#333",
    bg: "#0A0A0A",
    textColor: "#FFFFFF",
    accentColor: "#4CAF50",
    goldColor: "#D4A843",
    design: "receipts",
    description: "Real voting data printed on the shirt. Bring it to a town hall. Imagine the look on their face.",
  },
  {
    id: 9,
    name: "HOLD THE LINE",
    sub: "Black snapback · Embroidered",
    color: "Structured snapback hat",
    price: "$38",
    tag: "HAT",
    tagColor: "#333",
    bg: "#0A0A0A",
    textColor: "#FFFFFF",
    accentColor: C.crimson,
    goldColor: "#D4A843",
    design: "hat",
    description: "Black snapback. White + red embroidery. Wear it everywhere. Let the hat do the talking.",
  },
];

// ── Mini shirt SVG previews ──
function ShirtPreview({ product }) {
  const { bg, textColor, accentColor, goldColor, design } = product;

  const shirtPath = "M32,16 L0,32 L11,44 L11,120 L109,120 L109,44 L120,32 L88,16 Q76,4 65,7 Q60,1 54,1 Q48,1 43,7 Q31,4 32,16Z";

  const designs = {
    impeachment: (
      <>
        <rect x="18" y="28" width="84" height="10" fill={accentColor}/>
        <text x="60" y="37" textAnchor="middle" fontFamily={mono} fontSize="5" fill="#fff" letterSpacing="1">VOTE AGAINST US AGAIN.</text>
        <text x="60" y="54" textAnchor="middle" fontFamily={impact} fontSize="13" fill={textColor} letterSpacing="-0.5">IMPEACHMENT</text>
        <text x="60" y="65" textAnchor="middle" fontFamily={impact} fontSize="7" fill="#888" letterSpacing="1">IS ON THE</text>
        <text x="60" y="82" textAnchor="middle" fontFamily={impact} fontSize="18" fill={accentColor}>BALLOT.</text>
        <text x="60" y="100" textAnchor="middle" fontFamily={mono} fontSize="4" fill="#444" letterSpacing="1">ARTICLE II · §4 · WE THE PEOPLE</text>
      </>
    ),
    demand: (
      <>
        <text x="60" y="46" textAnchor="middle" fontFamily={impact} fontSize="14" fill={textColor} letterSpacing="-0.5">WE THE</text>
        <text x="60" y="62" textAnchor="middle" fontFamily={impact} fontSize="14" fill={textColor} letterSpacing="-0.5">PEOPLE</text>
        <rect x="18" y="66" width="84" height="3" fill={accentColor}/>
        <text x="60" y="80" textAnchor="middle" fontFamily={impact} fontSize="8" fill={accentColor} letterSpacing="1">DEMAND</text>
        <text x="60" y="93" textAnchor="middle" fontFamily={impact} fontSize="7" fill={accentColor} letterSpacing="0.5">ACCOUNTABILITY</text>
        <text x="60" y="108" textAnchor="middle" fontFamily={mono} fontSize="4" fill="#444" letterSpacing="1">CHECKYOURREPRESENTATIVE.COM</text>
      </>
    ),
    donors: (
      <>
        <text x="60" y="52" textAnchor="middle" fontFamily={impact} fontSize="18" fill={textColor}>↓</text>
        <text x="60" y="68" textAnchor="middle" fontFamily={impact} fontSize="9" fill={textColor} letterSpacing="1">THEY WORK</text>
        <text x="60" y="82" textAnchor="middle" fontFamily={impact} fontSize="14" fill={textColor}>FOR US.</text>
        <text x="60" y="94" textAnchor="middle" fontFamily={impact} fontSize="8" fill="#888" letterSpacing="1">NOT THE</text>
        <text x="60" y="108" textAnchor="middle" fontFamily={impact} fontSize="14" fill={accentColor}>DONORS.</text>
      </>
    ),
    watching: (
      <>
        <ellipse cx="60" cy="58" rx="28" ry="14" fill="none" stroke={goldColor} strokeWidth="1.5"/>
        <circle cx="60" cy="58" r="9" fill="none" stroke={accentColor} strokeWidth="1.2"/>
        <circle cx="60" cy="58" r="3.5" fill={accentColor}/>
        <text x="60" y="84" textAnchor="middle" fontFamily={mono} fontSize="5" fill={goldColor} letterSpacing="2">WE'RE WATCHING</text>
        <text x="60" y="97" textAnchor="middle" fontFamily={impact} fontSize="13" fill={textColor}>YOUR REP.</text>
        <text x="60" y="110" textAnchor="middle" fontFamily={mono} fontSize="4" fill="#333" letterSpacing="1">CHECKYOURREPRESENTATIVE.COM</text>
      </>
    ),
    partisan: (
      <>
        <text x="60" y="54" textAnchor="middle" fontFamily={impact} fontSize="7" fill="#1A3A6B" letterSpacing="1">ACCOUNTABILITY</text>
        <text x="60" y="70" textAnchor="middle" fontFamily={impact} fontSize="12" fill={textColor}>IS NOT</text>
        <text x="60" y="88" textAnchor="middle" fontFamily={impact} fontSize="14" fill={accentColor}>PARTISAN.</text>
        <line x1="20" y1="96" x2="100" y2="96" stroke="#333" strokeWidth="1"/>
        <text x="38" y="108" textAnchor="middle" fontFamily={impact} fontSize="8" fill="#1A3A6B">BLUE</text>
        <text x="60" y="108" textAnchor="middle" fontFamily={mono} fontSize="6" fill="#888">OR</text>
        <text x="82" y="108" textAnchor="middle" fontFamily={impact} fontSize="8" fill={accentColor}>RED</text>
      </>
    ),
    article: (
      <>
        <text x="60" y="48" textAnchor="middle" fontFamily={serif} fontSize="5" fontStyle="italic" fill="#888">IN THE COURT OF PUBLIC OPINION</text>
        <line x1="22" y1="52" x2="98" y2="52" stroke="#CCC" strokeWidth="0.5"/>
        <text x="60" y="64" textAnchor="middle" fontFamily={impact} fontSize="7" fill={textColor} letterSpacing="1">ARTICLE OF</text>
        <text x="60" y="82" textAnchor="middle" fontFamily={impact} fontSize="14" fill={accentColor}>IMPEACH-</text>
        <text x="60" y="98" textAnchor="middle" fontFamily={impact} fontSize="14" fill={accentColor}>MENT</text>
        <line x1="22" y1="102" x2="98" y2="102" stroke={accentColor} strokeWidth="0.8"/>
        <text x="60" y="112" textAnchor="middle" fontFamily={serif} fontSize="5" fontStyle="italic" fill="#888">We find you in contempt.</text>
      </>
    ),
    clock: (
      <>
        <circle cx="60" cy="66" r="32" fill="none" stroke={accentColor} strokeWidth="1.5"/>
        <line x1="60" y1="66" x2="50" y2="44" stroke={textColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="60" y1="66" x2="60" y2="38" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="60" cy="66" r="3" fill={accentColor}/>
        <text x="60" y="108" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill={accentColor} letterSpacing="1">YOUR TIME IS RUNNING OUT.</text>
      </>
    ),
    receipts: (
      <>
        <text x="60" y="44" textAnchor="middle" fontFamily={mono} fontSize="5" fill="#888" letterSpacing="2">YOUR REP'S RECORD</text>
        <rect x="22" y="48" width="76" height="52" fill="#111" stroke="#333" strokeWidth="0.5"/>
        <rect x="22" y="48" width="76" height="10" fill="#1A1A1A"/>
        <text x="45" y="56" textAnchor="middle" fontFamily={mono} fontSize="4" fill="#555">BILL</text>
        <text x="73" y="56" textAnchor="middle" fontFamily={mono} fontSize="4" fill="#555">PEOPLE</text>
        <text x="93" y="56" textAnchor="middle" fontFamily={mono} fontSize="4" fill="#555">REP</text>
        <text x="32" y="68" fontFamily={mono} fontSize="4" fill="#666">H.R.485</text>
        <text x="73" y="68" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill="#4CAF50">YES</text>
        <text x="93" y="68" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill={accentColor}>NO</text>
        <text x="32" y="80" fontFamily={mono} fontSize="4" fill="#666">S.100</text>
        <text x="73" y="80" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill="#4CAF50">YES</text>
        <text x="93" y="80" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill={accentColor}>NO</text>
        <text x="32" y="92" fontFamily={mono} fontSize="4" fill="#666">H.R.22</text>
        <text x="73" y="92" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill="#4CAF50">YES</text>
        <text x="93" y="92" textAnchor="middle" fontFamily={mono} fontSize="4.5" fill={accentColor}>NO</text>
        <text x="60" y="112" textAnchor="middle" fontFamily={impact} fontSize="9" fill={textColor}>WE HAVE THE RECEIPTS.</text>
      </>
    ),
    hat: (
      <>
        <path d="M20,72 Q20,40 60,40 Q100,40 100,72 L94,90 L26,90 Z" fill="#0A0A0A" stroke="#1A1A1A" strokeWidth="1"/>
        <rect x="16" y="88" width="88" height="10" rx="3" fill="#111" stroke="#1A1A1A" strokeWidth="0.5"/>
        <line x1="60" y1="41" x2="60" y2="88" stroke="#1A1A1A" strokeWidth="0.5" strokeDasharray="2,3"/>
        <circle cx="60" cy="40" r="2.5" fill="#D4A843"/>
        <text x="60" y="64" textAnchor="middle" fontFamily={impact} fontSize="9" fill="#FFFFFF" letterSpacing="0.5">HOLD THE</text>
        <text x="60" y="78" textAnchor="middle" fontFamily={impact} fontSize="9" fill={accentColor} letterSpacing="0.5">LINE</text>
        <text x="60" y="87" textAnchor="middle" fontSize="6" fill="#D4A843" letterSpacing="3">★★★</text>
      </>
    ),
  };

  return (
    <svg viewBox="0 0 120 130" width="160" height="173" style={{ display: "block", margin: "0 auto" }}>
      <path d={shirtPath} fill={bg} stroke={bg === "#F5F0E0" || bg === "#F0F0F0" ? "#DDD" : "#1A1A1A"} strokeWidth="1"/>
      {designs[design]}
    </svg>
  );
}

// ── Main Merch Component ──
export default function Merch() {
  const [notify, setNotify] = useState(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleNotify(productId) {
    setNotify(productId);
    setSubmitted(false);
    setEmail("");
  }

  function handleSubmit(productName) {
    if (!email) return;
    setSubmitted(true);
    // In production: POST to /api/notify or Formspree
    fetch("https://formspree.io/f/xlgkwwyl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, product: productName, _subject: `Merch interest: ${productName}` }),
    }).catch(() => {});
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink }}>

      {/* Header banner */}
      <div style={{
        background: C.black, padding: "32px 20px 28px",
        textAlign: "center", borderBottom: `3px solid ${C.gold}`,
        marginBottom: 32,
      }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: "#555", letterSpacing: 4, marginBottom: 8 }}>
          PAID FOR BY WE THE PEOPLE INC.
        </div>
        <div style={{
          fontFamily: impact, fontSize: "clamp(24px, 4vw, 40px)",
          color: "#FFFFFF", letterSpacing: 2, lineHeight: 1.1, marginBottom: 8,
        }}>
          WEAR THE MISSION.
        </div>
        <div style={{ fontFamily: impact, fontSize: "clamp(18px, 3vw, 28px)", color: C.crimson, letterSpacing: 2 }}>
          SCARE THE REPS.
        </div>
        <p style={{ fontFamily: serif, fontSize: 14, color: "#666", marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
          Every purchase funds the platform. Every shirt worn at a town hall sends a message.
          Show up. Be seen. Hold them accountable.
        </p>
        <div style={{ marginTop: 16, fontFamily: mono, fontSize: 11, color: "#444", letterSpacing: 2 }}>
          ★ STORE LAUNCHING JULY 1, 2026 ★
        </div>
      </div>

      {/* Product grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 24,
      }}>
        {PRODUCTS.map(product => (
          <div key={product.id} style={{
            background: "#fff", border: `1px solid ${C.line}`,
            borderRadius: 4, overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            {/* Tag */}
            {product.tag && (
              <div style={{
                background: product.tagColor, color: "#fff",
                fontFamily: mono, fontSize: 10, fontWeight: 700,
                padding: "5px 14px", letterSpacing: 2, textAlign: "center",
              }}>
                {product.tag}
              </div>
            )}

            {/* Preview */}
            <div style={{
              background: product.bg === "#F5F0E0" || product.bg === "#F0F0F0"
                ? "#E8E4D8" : "#111",
              padding: "28px 20px 20px",
              display: "flex", justifyContent: "center", alignItems: "center",
            }}>
              <ShirtPreview product={product} />
            </div>

            {/* Info */}
            <div style={{ padding: "18px 20px 20px" }}>
              <div style={{
                fontFamily: impact, fontSize: 15, letterSpacing: 1,
                color: C.black, lineHeight: 1.2, marginBottom: 6,
              }}>
                {product.name}
              </div>
              <div style={{ fontFamily: serif, fontSize: 12.5, color: C.muted, fontStyle: "italic", marginBottom: 10 }}>
                {product.description}
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "#AAA", marginBottom: 14 }}>
                {product.color}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: impact, fontSize: 28, color: C.black, letterSpacing: 1 }}>
                  {product.price}
                </div>
                <button
                  onClick={() => handleNotify(product.id)}
                  style={{
                    fontFamily: impact, fontSize: 13, letterSpacing: 1,
                    background: C.crimson, color: "#fff", border: "none",
                    padding: "10px 20px", borderRadius: 2, cursor: "pointer",
                  }}>
                  NOTIFY ME →
                </button>
              </div>

              {/* Notify form */}
              {notify === product.id && !submitted && (
                <div style={{
                  marginTop: 14, padding: "14px", background: C.parchment,
                  border: `1px solid ${C.line}`, borderRadius: 2,
                }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 8 }}>
                    GET NOTIFIED WHEN STORE LAUNCHES:
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        flex: 1, fontFamily: serif, fontSize: 13,
                        padding: "8px 12px", border: `1px solid ${C.line}`,
                        borderRadius: 2, background: "#fff",
                      }}
                    />
                    <button
                      onClick={() => handleSubmit(product.name)}
                      style={{
                        fontFamily: impact, fontSize: 12,
                        background: C.navy, color: "#fff", border: "none",
                        padding: "8px 16px", borderRadius: 2, cursor: "pointer",
                      }}>
                      SUBMIT
                    </button>
                  </div>
                </div>
              )}
              {notify === product.id && submitted && (
                <div style={{
                  marginTop: 14, padding: "10px 14px", background: "#E8F5E9",
                  border: "1px solid #A5D6A7", borderRadius: 2,
                  fontFamily: mono, fontSize: 11, color: "#1B5E20", letterSpacing: 1,
                }}>
                  ✓ YOU'RE ON THE LIST. WE'LL EMAIL YOU LAUNCH DAY.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{
        marginTop: 48, padding: "32px 20px", background: C.black,
        borderRadius: 4, textAlign: "center",
      }}>
        <div style={{ fontFamily: impact, fontSize: 22, color: "#FFFFFF", letterSpacing: 2, marginBottom: 8 }}>
          BULK ORDERS FOR TOWN HALLS?
        </div>
        <p style={{ fontFamily: serif, fontSize: 14, color: "#666", maxWidth: 500, margin: "0 auto 16px" }}>
          Organizing a group? Showing up to a rep's event with 20 people in matching shirts?
          Contact us for bulk pricing and custom district-specific prints.
        </p>
        <a href="mailto:info@checkyourrepresentative.com" style={{
          fontFamily: impact, fontSize: 14, letterSpacing: 2,
          color: C.gold, textDecoration: "none",
          border: `1px solid ${C.gold}`, padding: "10px 28px", borderRadius: 2,
          display: "inline-block",
        }}>
          CONTACT FOR BULK ORDERS →
        </a>
        <div style={{ marginTop: 20, fontFamily: mono, fontSize: 10, color: "#333", letterSpacing: 2 }}>
          PAID FOR BY WE THE PEOPLE INC. · CHECKYOURREPRESENTATIVE.COM
        </div>
      </div>
    </div>
  );
}
