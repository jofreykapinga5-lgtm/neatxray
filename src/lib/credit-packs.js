// What a doctor can buy. Prices are in Tanzanian shillings (whole TZS; the provider's minimum is 500).
// 1 credit = TSh 100. The provider's minimum payment is TSh 500, which is exactly 5 credits,
// so that is also the smallest purchase. Doctors can pick a pack or type their own number of credits.
export const PRICE_PER_CREDIT = 100;
export const MIN_CREDITS = 5;
export const MAX_CREDITS = 1000;
export const CUSTOM_PACK_ID = "custom";

// Keep each id the same once people have bought it.
export const CREDIT_PACKS = [5, 20, 50].map((credits) => ({ id: `p${credits}`, credits, amount: credits * PRICE_PER_CREDIT }));

// Works out what a purchase is from what the browser sent. Never trusts a price from the browser:
// the amount is always credits x price here on the server.
export function resolvePurchase(packId, customCredits) {
  if (packId === CUSTOM_PACK_ID) {
    const credits = Number(customCredits);
    if (!Number.isInteger(credits) || credits < MIN_CREDITS || credits > MAX_CREDITS) return null;
    return { id: CUSTOM_PACK_ID, credits, amount: credits * PRICE_PER_CREDIT };
  }
  return CREDIT_PACKS.find((p) => p.id === packId) || null;
}

// The `id` is what the payment provider expects in channel.provider.
export const NETWORKS = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "airtel", label: "Airtel Money" },
  { id: "mixx", label: "Mixx by Yas" },
  { id: "halotel", label: "Halotel" },
];

export const tsh = (n) => `TSh ${n.toLocaleString("en-US")}`;
