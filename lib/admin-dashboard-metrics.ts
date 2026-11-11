import { calculateOfferPrice, type OfferType } from "./offers";

type Money = number | string | null;

/** Short summary amounts; the full currency amount remains available beside details/on hover. */
export function formatCompactNpr(value: number) {
  if (!Number.isFinite(value) || value < 0) return "Unavailable";
  const format = value >= 10_000
    ? { notation: "compact" as const, maximumFractionDigits: 1 }
    : { maximumFractionDigits: 2 };
  return `NPR ${new Intl.NumberFormat("en-NP", format).format(value)}`;
}

export type StockListing = {
  id: string;
  kind: string;
  status: string;
  stock_managed: boolean;
  base_price: Money;
  offer_title: string | null;
  offer_type: OfferType | null;
  offer_value: Money;
};

export type StockInventory = { listing_id: string; quantity: Money; reserved_quantity: Money };
export type StockVariant = {
  listing_id: string;
  price: Money;
  stock_quantity: Money;
  is_active: boolean;
  offer_title: string | null;
  offer_type: OfferType | null;
  offer_value: Money;
};
export type DueOrder = { total: Money; status: string; payment_status: string };

function nonNegative(value: Money) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sellingPrice(price: Money, title: string | null, offerType: OfferType | null, offerValue: Money) {
  const regularPrice = nonNegative(price);
  if (regularPrice === null) return null;
  return title && offerType
    ? calculateOfferPrice(regularPrice, offerType, nonNegative(offerValue))
    : regularPrice;
}

/** Available sale goods at current selling prices; services and rental fees are excluded. */
export function calculateProductStockValue(
  listings: readonly StockListing[],
  inventory: readonly StockInventory[],
  variants: readonly StockVariant[],
) {
  const inventoryByListing = new Map(inventory.map((row) => [row.listing_id, row]));
  const variantsByListing = new Map<string, StockVariant[]>();
  for (const row of variants) {
    const rows = variantsByListing.get(row.listing_id) ?? [];
    rows.push(row);
    variantsByListing.set(row.listing_id, rows);
  }
  let value = 0;
  for (const listing of listings) {
    if (listing.status !== "active" || !listing.stock_managed || !["product", "produce", "livestock"].includes(listing.kind)) continue;
    const options = variantsByListing.get(listing.id);
    if (options?.length) {
      // Variant stock replaces parent stock, including when every option is inactive.
      for (const option of options) {
        if (!option.is_active) continue;
        const price = sellingPrice(option.price, option.offer_title, option.offer_type, option.offer_value);
        if (price !== null) value += price * (nonNegative(option.stock_quantity) ?? 0);
      }
    } else {
      const price = sellingPrice(listing.base_price, listing.offer_title, listing.offer_type, listing.offer_value);
      const stock = inventoryByListing.get(listing.id);
      const available = Math.max(0, (nonNegative(stock?.quantity ?? null) ?? 0) - (nonNegative(stock?.reserved_quantity ?? null) ?? 0));
      if (price !== null) value += price * available;
    }
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Payments still collectible; cancelled/returned/refunded orders are no longer receivables. */
export function calculateCustomerDues(orders: readonly DueOrder[]) {
  const value = orders.reduce((sum, order) => {
    if (["cancelled", "returned", "refunded"].includes(order.status)) return sum;
    if (!["unpaid", "pending", "failed"].includes(order.payment_status)) return sum;
    return sum + (nonNegative(order.total) ?? 0);
  }, 0);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
