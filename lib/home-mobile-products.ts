import type { Listing } from "@/data/marketplace";

/** Show the whole published catalog, including items promoted elsewhere on the home page. */
export function selectMoreMobileProducts(listings: Listing[]): Listing[] {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}
