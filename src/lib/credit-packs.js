// What a doctor can buy. Prices are in Tanzanian shillings (whole TZS; the provider's minimum is 500).
// 1 credit = TSh 100. The provider's minimum payment is TSh 500, which is exactly 5 credits.
// To add bigger packs later, add a line here (each id must stay the same once people have bought it).
export const CREDIT_PACKS = [{ id: "p5", credits: 5, amount: 500 }];

// The `id` is what the payment provider expects in channel.provider.
export const NETWORKS = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "airtel", label: "Airtel Money" },
  { id: "mixx", label: "Mixx by Yas" },
  { id: "halotel", label: "Halotel" },
];

export const tsh = (n) => `TSh ${n.toLocaleString("en-US")}`;
