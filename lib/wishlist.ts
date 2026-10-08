export type WishlistItemRow = {
  user_id: string;
  listing_id: string;
  variant_id: string | null;
  item_key: string;
  created_at: string;
};

export const wishlistItemSelect = "user_id,listing_id,variant_id,item_key,created_at";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function makeWishlistItemKey(listingId: string, variantId?: string) {
  return variantId ? `${listingId}:${variantId}` : listingId;
}

export function parseWishlistItemKey(itemKey: string) {
  const [listingId, variantId, ...extra] = itemKey.split(":");
  if (!listingId || extra.length) return null;
  return {
    listingId,
    variantId: variantId || undefined,
  };
}
