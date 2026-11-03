import { NextRequest, NextResponse } from "next/server";
import { categoryDescendants, toHubCategory } from "@/lib/category-hub";
import { categorySelect, type CategoryRow } from "@/lib/categories";
import {
  buildListings,
  listingSelect,
  listingVariantSelect,
  type ListingImageRow,
  type ListingRow,
  type ListingVariantRow,
} from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 36;

function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}

function matchesCategory(row: CategoryRow, value: string | null) {
  if (!value) return false;
  return row.id === value || row.slug === value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  const page = positiveInteger(request.nextUrl.searchParams.get("page"), 1);
  const pageSize = positiveInteger(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  try {
    const supabase = await createClient();
    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select(categorySelect)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });

    if (categoryError) throw categoryError;

    const rows = (categoryData ?? []) as unknown as CategoryRow[];
    const requestedCategory = rows.find((row) => matchesCategory(row, decodeURIComponent(categoryId)));

    if (!requestedCategory) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const descendants = categoryDescendants(rows, requestedCategory.id);
    const descendantIds = new Set(descendants.map((row) => row.id));
    const requestedChild = request.nextUrl.searchParams.get("child");
    const requestedGrandchild = request.nextUrl.searchParams.get("grandchild");

    const child = descendants.find((row) =>
      matchesCategory(row, requestedChild) && row.parent_id === requestedCategory.id,
    );
    const grandchild = descendants.find((row) =>
      matchesCategory(row, requestedGrandchild) &&
      row.parent_id === child?.id &&
      descendantIds.has(row.id),
    );
    const selectedCategory = grandchild ?? child ?? requestedCategory;
    const selectedDescendants = categoryDescendants(rows, selectedCategory.id);
    const productCategoryIds = [selectedCategory.id, ...selectedDescendants.map((row) => row.id)];
    const rangeStart = (page - 1) * pageSize;
    const rangeEnd = rangeStart + pageSize - 1;

    const { data: listingData, error: listingError, count } = await supabase
      .from("listings")
      .select(listingSelect, { count: "exact" })
      .in("category_id", productCategoryIds)
      .eq("status", "active")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    if (listingError) throw listingError;

    const listingRows = (listingData ?? []) as unknown as ListingRow[];
    let imageRows: ListingImageRow[] = [];
    let variantRows: ListingVariantRow[] = [];

    if (listingRows.length) {
      const listingIds = listingRows.map((listing) => listing.id);
      const [imageResult, variantResult] = await Promise.all([
        supabase
          .from("listing_images")
          .select("id,listing_id,storage_path,alt_text_en,alt_text_ne,sort_order,is_primary")
          .in("listing_id", listingIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true }),
        supabase
          .from("listing_variants")
          .select(listingVariantSelect)
          .in("listing_id", listingIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name_en", { ascending: true }),
      ]);

      if (imageResult.error) throw imageResult.error;
      if (variantResult.error) throw variantResult.error;
      imageRows = (imageResult.data ?? []) as unknown as ListingImageRow[];
      variantRows = (variantResult.data ?? []) as unknown as ListingVariantRow[];
    }

    const publicImageUrl = (path: string) =>
      supabase.storage.from("marketplace-media").getPublicUrl(path).data.publicUrl;
    const total = count ?? 0;

    let products = buildListings(listingRows, rows, imageRows, publicImageUrl, variantRows);

    // Homepage highlight deep-link: /shop/<category>?pin=<listing-slug> shows the
    // pinned product first, then the rest of the category.
    const pinSlug = request.nextUrl.searchParams.get("pin");
    let pinnedSlug: string | null = null;
    if (pinSlug && page === 1) {
      let pinnedRow = listingRows.find((row) => row.slug === pinSlug);
      if (!pinnedRow) {
        const { data: pinData } = await supabase
          .from("listings")
          .select(listingSelect)
          .in("category_id", productCategoryIds)
          .eq("status", "active")
          .eq("slug", pinSlug)
          .maybeSingle();
        pinnedRow = (pinData as unknown as ListingRow | null) ?? undefined;
        if (pinnedRow) {
          const [{ data: pinImages }, { data: pinVariants }] = await Promise.all([
            supabase
              .from("listing_images")
              .select("id,listing_id,storage_path,alt_text_en,alt_text_ne,sort_order,is_primary")
              .eq("listing_id", pinnedRow.id)
              .order("is_primary", { ascending: false })
              .order("sort_order", { ascending: true }),
            supabase
              .from("listing_variants")
              .select(listingVariantSelect)
              .eq("listing_id", pinnedRow.id)
              .eq("is_active", true)
              .order("sort_order", { ascending: true }),
          ]);
          const pinnedListing = buildListings(
            [pinnedRow],
            rows,
            (pinImages ?? []) as unknown as ListingImageRow[],
            publicImageUrl,
            (pinVariants ?? []) as unknown as ListingVariantRow[],
          )[0];
          if (pinnedListing) products = [pinnedListing, ...products];
        }
      } else {
        products = [...products].sort((a, b) => (a.slug === pinSlug ? -1 : b.slug === pinSlug ? 1 : 0));
      }
      if (products[0]?.slug === pinSlug) pinnedSlug = pinSlug;
    }

    return NextResponse.json({
      category: toHubCategory(requestedCategory),
      selectedCategory: toHubCategory(selectedCategory),
      subcategories: descendants.map(toHubCategory),
      products,
      pinnedSlug,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Category hub API failed", error);
    return NextResponse.json(
      { error: "The marketplace could not load this category. Please try again." },
      { status: 500 },
    );
  }
}
