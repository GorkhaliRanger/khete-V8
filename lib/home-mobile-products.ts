import type { Listing } from "@/data/marketplace";

const merchandiseTypes = new Set<Listing["type"]>(["product", "produce", "livestock"]);

/** Keep only unique, tangible goods that have not already appeared in homepage rows. */
export function selectMoreMobileProducts(listings: Listing[], excludeIds: readonly string[]): Listing[] {
  const excluded = new Set(excludeIds);
  const seen = new Set<string>();
  return listings.filter((listing) => {
    if (!merchandiseTypes.has(listing.type) || excluded.has(listing.id) || seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}
