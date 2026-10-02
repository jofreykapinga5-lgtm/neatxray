// What a doctor can buy. Prices are in Tanzanian shillings (whole TZS; the provider's minimum is 500).
// PLACEHOLDER PRICES: edit these three lines to set your real prices.
export const CREDIT_PACKS = [
  { id: "p5", credits: 5, amount: 5000 },
  { id: "p20", credits: 20, amount: 16000 },
  { id: "p50", credits: 50, amount: 35000 },
];

// The `id` is what the payment provider expects in channel.provider.
export const NETWORKS = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "airtel", label: "Airtel Money" },
  { id: "mixx", label: "Mixx by Yas" },
  { id: "halotel", label: "Halotel" },
];

export const tsh = (n) => `TSh ${n.toLocaleString("en-US")}`;
