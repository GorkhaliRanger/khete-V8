export type OfferType = "amount" | "percentage";

export function calculateOfferPrice(
  regularPrice: number,
  offerType?: OfferType | null,
  offerValue?: number | null,
) {
  if (!Number.isFinite(regularPrice) || regularPrice < 0 || !offerType || offerValue === null || offerValue === undefined || !Number.isFinite(offerValue) || offerValue <= 0) {
    return regularPrice;
  }

  const reduction = offerType === "percentage"
    ? regularPrice * Math.min(offerValue, 100) / 100
    : Math.min(offerValue, regularPrice);
  return Math.max(0, Math.round((regularPrice - reduction + Number.EPSILON) * 100) / 100);
}

export function offerSummary(offerType: OfferType, offerValue: number) {
  return offerType === "percentage"
    ? `${offerValue}% off`
    : `NPR ${new Intl.NumberFormat("en-NP", { maximumFractionDigits: 2 }).format(offerValue)} off`;
}
