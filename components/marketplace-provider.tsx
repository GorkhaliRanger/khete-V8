"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { buildCategoryTree, categorySelect, type CategoryRow } from "@/lib/categories";
import { buildListings, listingSelect, listingVariantSelect, type ListingImageRow, type ListingRow, type ListingVariantRow } from "@/lib/listings";
import { isUuid, makeWishlistItemKey, parseWishlistItemKey, wishlistItemSelect, type WishlistItemRow } from "@/lib/wishlist";
import { categories as fallbackCategories, listings as fallbackListings, type Category, type Listing, type ListingVariant } from "@/data/marketplace";

export type CartLine = {
  id: string;
  listingId: string;
  variantId?: string;
  variantName?: string;
  unitPrice?: number;
  unitLabel?: string;
  quantity: number;
};
type AuthResult = { ok: boolean; message?: string };

type MarketplaceContextValue = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  wishlist: Set<string>;
  wishlistReady: boolean;
  wishlistError: string;
  toggleWishlist: (listingId: string, variantId?: string) => Promise<void>;
  cart: CartLine[];
  cartCount: number;
  addToCart: (listingId: string, quantity?: number, variant?: ListingVariant) => void;
  updateCartQuantity: (lineId: string, quantity: number) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  user: User | null;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  categories: Category[];
  categoriesReady: boolean;
  categoriesLive: boolean;
  refreshCategories: () => Promise<void>;
  listings: Listing[];
  listingsReady: boolean;
  listingsLive: boolean;
  refreshListings: () => Promise<void>;
  profilePhoto: string | null;
  setProfilePhoto: (photo: string | null) => void;
};

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

function wishlistItemExists(itemKey: string, listings: Listing[]) {
  const parsed = parseWishlistItemKey(itemKey);
  if (!parsed) return false;
  const listing = listings.find((item) => item.id === parsed.listingId);
  if (!listing) return false;
  return !parsed.variantId || Boolean(listing.variants?.some((variant) => variant.id === parsed.variantId));
}

function cartLineExists(line: CartLine, listings: Listing[]) {
  const listing = listings.find((item) => item.id === line.listingId);
  if (!listing) return false;
  return !line.variantId || Boolean(listing.variants?.some((variant) => variant.id === line.variantId));
}

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [wishlistReady, setWishlistReady] = useState(false);
  const [wishlistError, setWishlistError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [categoryTree, setCategoryTree] = useState<Category[]>(fallbackCategories);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [categoriesLive, setCategoriesLive] = useState(false);
  const [marketplaceListings, setMarketplaceListings] = useState<Listing[]>(fallbackListings);
  const [listingsReady, setListingsReady] = useState(false);
  const [listingsLive, setListingsLive] = useState(false);
  const [profilePhoto, setProfilePhotoState] = useState<string | null>(null);

  const refreshMarketplace = useCallback(async () => {
    const supabase = createClient();
    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select(categorySelect)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });

    if (categoryError || !categoryData?.length) {
      setCategoryTree(fallbackCategories);
      setCategoriesLive(false);
      setCategoriesReady(true);
      setMarketplaceListings(fallbackListings);
      setListingsLive(false);
      setListingsReady(true);
      return;
    }

    const rows = categoryData as unknown as CategoryRow[];
    setCategoryTree(buildCategoryTree(rows));
    setCategoriesLive(true);
    setCategoriesReady(true);

    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select(listingSelect)
      .eq("status", "active")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false });

    if (listingError || !listingData?.length) {
      setMarketplaceListings(fallbackListings);
      setListingsLive(false);
      setListingsReady(true);
      return;
    }

    const listingRows = listingData as unknown as ListingRow[];
    const listingIds = listingRows.map((listing) => listing.id);
    const [{ data: imageData }, { data: variantData }] = await Promise.all([
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
        .order("sort_order", { ascending: true }),
    ]);
    // Site-local image paths (starting with "/") are served from /public directly;
    // everything else is treated as a marketplace-media storage object path.
    const publicImageUrl = (path: string) =>
      path.startsWith("/")
        ? path
        : supabase.storage.from("marketplace-media").getPublicUrl(path).data.publicUrl;
    setMarketplaceListings(buildListings(
      listingRows,
      rows,
      (imageData ?? []) as unknown as ListingImageRow[],
      publicImageUrl,
      (variantData ?? []) as unknown as ListingVariantRow[],
    ));
    setListingsLive(true);
    setListingsReady(true);
  }, []);

  const refreshCategories = refreshMarketplace;
  const refreshListings = refreshMarketplace;

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshMarketplace(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshMarketplace]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setWishlist(new Set());
        setWishlistError("");
        setWishlistReady(true);
        localStorage.removeItem("khete-wishlist-owner");
        localStorage.setItem("khete-wishlist", "[]");
      }
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedWishlist = JSON.parse(localStorage.getItem("khete-wishlist") ?? "[]") as string[];
        const storedCart = JSON.parse(localStorage.getItem("khete-cart") ?? "[]") as Array<Partial<CartLine> & { id: string; quantity: number }>;
        const savedCart = storedCart.map((line) => ({
          ...line,
          listingId: line.listingId ?? line.id.split(":")[0],
          quantity: Math.max(1, Number(line.quantity) || 1),
        })) as CartLine[];
        setWishlist(new Set(savedWishlist));
        setCart(savedCart);
        setProfilePhotoState(localStorage.getItem("khete-profile-photo"));
      } catch {
        localStorage.removeItem("khete-wishlist");
        localStorage.removeItem("khete-cart");
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("khete-cart", JSON.stringify(cart));
  }, [cart, ready]);

  const visibleWishlist = useMemo(() => {
    if (!listingsReady) return new Set<string>();
    return new Set([...wishlist].filter((itemKey) => wishlistItemExists(itemKey, marketplaceListings)));
  }, [listingsReady, marketplaceListings, wishlist]);

  const visibleCart = useMemo(() => {
    if (!listingsReady) return [];
    return cart.filter((line) => cartLineExists(line, marketplaceListings));
  }, [cart, listingsReady, marketplaceListings]);

  useEffect(() => {
    if (!ready || !listingsReady || !listingsLive) return;
    const timer = window.setTimeout(() => {
      setCart((current) => {
        const next = current.filter((line) => cartLineExists(line, marketplaceListings));
        return next.length === current.length ? current : next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [listingsLive, listingsReady, marketplaceListings, ready]);

  useEffect(() => {
    if (!ready || !authReady) return;
    let cancelled = false;

    if (!userId) {
      const timer = window.setTimeout(() => {
        setWishlistError("");
        setWishlistReady(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const syncWishlist = async () => {
      setWishlistReady(false);
      setWishlistError("");

      try {
        const owner = localStorage.getItem("khete-wishlist-owner");
        const cachedKeys = owner && owner !== userId
          ? []
          : JSON.parse(localStorage.getItem("khete-wishlist") ?? "[]") as string[];
        const rowsToMerge = cachedKeys.flatMap((itemKey) => {
          const parsed = parseWishlistItemKey(itemKey);
          if (!parsed || !isUuid(parsed.listingId) || (parsed.variantId && !isUuid(parsed.variantId))) return [];
          return [{
            user_id: userId,
            listing_id: parsed.listingId,
            variant_id: parsed.variantId ?? null,
            item_key: itemKey,
          }];
        });
        const localOnlyKeys = cachedKeys.filter((itemKey) => {
          const parsed = parseWishlistItemKey(itemKey);
          return !parsed || !isUuid(parsed.listingId) || Boolean(parsed.variantId && !isUuid(parsed.variantId));
        });
        const supabase = createClient();

        if (rowsToMerge.length) {
          const { error: mergeError } = await supabase
            .from("wishlist_items")
            .upsert(rowsToMerge, { onConflict: "user_id,item_key", ignoreDuplicates: true });
          if (mergeError) throw mergeError;
        }

        const { data, error } = await supabase
          .from("wishlist_items")
          .select(wishlistItemSelect)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;

        const syncedKeys = (data ?? []).map((row) => (row as WishlistItemRow).item_key);
        const next = new Set([...syncedKeys, ...localOnlyKeys]);
        setWishlist(next);
        localStorage.setItem("khete-wishlist", JSON.stringify([...next]));
        localStorage.setItem("khete-wishlist-owner", userId);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Wishlist sync is unavailable.";
        setWishlistError(
          message.includes("wishlist_items") || message.includes("schema cache") || message.includes("relation")
            ? "Run the Wishlist migration in Supabase to activate account syncing."
            : message,
        );
      } finally {
        if (!cancelled) setWishlistReady(true);
      }
    };

    void syncWishlist();
    return () => {
      cancelled = true;
    };
  }, [authReady, ready, userId]);

  useEffect(() => {
    if (!ready || !authReady || !wishlistReady) return;
    localStorage.setItem("khete-wishlist", JSON.stringify([...wishlist]));
    if (userId) localStorage.setItem("khete-wishlist-owner", userId);
    else localStorage.removeItem("khete-wishlist-owner");
  }, [authReady, ready, userId, wishlist, wishlistReady]);

  useEffect(() => {
    if (!ready || !authReady || !wishlistReady || !listingsReady || !listingsLive) return;
    const staleKeys = [...wishlist].filter((itemKey) => !wishlistItemExists(itemKey, marketplaceListings));
    if (!staleKeys.length) return;

    const databaseKeys = staleKeys.filter((itemKey) => {
      const parsed = parseWishlistItemKey(itemKey);
      return Boolean(parsed && isUuid(parsed.listingId) && (!parsed.variantId || isUuid(parsed.variantId)));
    });
    const timer = window.setTimeout(() => {
      setWishlist((current) => {
        const next = new Set(current);
        staleKeys.forEach((itemKey) => next.delete(itemKey));
        return next;
      });

      if (!userId || !databaseKeys.length) return;
      const removeStaleItems = async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("user_id", userId)
          .in("item_key", databaseKeys);
        if (error) setWishlistError(error.message);
      };
      void removeStaleItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    authReady,
    listingsLive,
    listingsReady,
    marketplaceListings,
    ready,
    userId,
    wishlist,
    wishlistReady,
  ]);

  const toggleWishlist = useCallback(async (listingId: string, variantId?: string) => {
    const itemKey = makeWishlistItemKey(listingId, variantId);
    const wasSaved = wishlist.has(itemKey);
    setWishlistError("");
    setWishlist((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });

    if (!userId || !isUuid(listingId) || (variantId && !isUuid(variantId))) return;

    const supabase = createClient();
    const { error } = wasSaved
      ? await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("item_key", itemKey)
      : await supabase
        .from("wishlist_items")
        .upsert({
          user_id: userId,
          listing_id: listingId,
          variant_id: variantId ?? null,
          item_key: itemKey,
        }, { onConflict: "user_id,item_key", ignoreDuplicates: true });

    if (!error) return;
    setWishlist((current) => {
      const next = new Set(current);
      if (wasSaved) next.add(itemKey);
      else next.delete(itemKey);
      return next;
    });
    setWishlistError(
      error.message.includes("wishlist_items") || error.message.includes("schema cache") || error.message.includes("relation")
        ? "Run the Wishlist migration in Supabase to activate account syncing."
        : error.message,
    );
  }, [userId, wishlist]);

  const addToCart = useCallback((listingId: string, quantity = 1, variant?: ListingVariant) => {
    if (variant && !variant.available) return;
    const lineId = variant ? `${listingId}:${variant.id}` : listingId;
    const maximum = variant ? Math.max(0, Math.floor(variant.stockQuantity)) : Number.MAX_SAFE_INTEGER;
    const safeQuantity = Math.min(maximum, Math.max(1, Math.floor(quantity)));
    if (safeQuantity < 1) return;
    setCart((current) => {
      const existing = current.find((line) => line.id === lineId);
      if (!existing) return [...current, {
        id: lineId,
        listingId,
        variantId: variant?.id,
        variantName: variant?.name,
        unitPrice: variant?.price,
        unitLabel: variant?.unit,
        quantity: safeQuantity,
      }];
      return current.map((line) => (line.id === lineId ? { ...line, quantity: Math.min(maximum, line.quantity + safeQuantity) } : line));
    });
  }, []);

  const updateCartQuantity = useCallback((lineId: string, quantity: number) => {
    const requestedQuantity = Math.floor(Number(quantity) || 0);
    setCart((current) => current.flatMap((line) => {
      if (line.id !== lineId) return [line];
      if (requestedQuantity < 1) return [];

      const listing = marketplaceListings.find((item) => item.id === line.listingId);
      const variant = line.variantId
        ? listing?.variants?.find((item) => item.id === line.variantId)
        : undefined;
      const maximum = variant ? Math.max(0, Math.floor(variant.stockQuantity)) : Number.MAX_SAFE_INTEGER;

      if (maximum < 1) return [];
      return [{ ...line, quantity: Math.min(maximum, requestedQuantity) }];
    }));
  }, [marketplaceListings]);

  const removeFromCart = useCallback((lineId: string) => {
    setCart((current) => current.filter((line) => line.id !== lineId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { ok: false, message: error.message };
    setLoginOpen(false);
    return { ok: true };
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<AuthResult> => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (error) return { ok: false, message: error.message };
    if (!data.session) {
      return {
        ok: true,
        message: "Account created. Check your email and confirm the account, then return here to log in.",
      };
    }

    setLoginOpen(false);
    return { ok: true };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const supabase = createClient();
    const next = `${window.location.pathname}${window.location.search}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) return { ok: false, message: error.message };
    setWishlist(new Set());
    setWishlistError("");
    setWishlistReady(true);
    localStorage.removeItem("khete-wishlist-owner");
    localStorage.setItem("khete-wishlist", "[]");
    setUser(null);
    return { ok: true };
  }, []);

  const setProfilePhoto = useCallback((photo: string | null) => {
    setProfilePhotoState(photo);
    try {
      if (photo) localStorage.setItem("khete-profile-photo", photo);
      else localStorage.removeItem("khete-profile-photo");
    } catch {
      // Photo is kept in memory even if local storage is full.
    }
  }, []);

  const value = useMemo(
    () => ({
      profilePhoto,
      setProfilePhoto,
      searchQuery,
      setSearchQuery,
      loginOpen,
      openLogin,
      closeLogin,
      wishlist: visibleWishlist,
      wishlistReady: wishlistReady && listingsReady,
      wishlistError,
      toggleWishlist,
      cart: visibleCart,
      cartCount: visibleCart.reduce((total, line) => total + line.quantity, 0),
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      user,
      authReady,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      categories: categoryTree,
      categoriesReady,
      categoriesLive,
      refreshCategories,
      listings: marketplaceListings,
      listingsReady,
      listingsLive,
      refreshListings,
    }),
    [
      profilePhoto,
      setProfilePhoto,
      searchQuery,
      loginOpen,
      visibleWishlist,
      wishlistReady,
      wishlistError,
      visibleCart,
      listingsReady,
      user,
      authReady,
      openLogin,
      closeLogin,
      toggleWishlist,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      categoryTree,
      categoriesReady,
      categoriesLive,
      refreshCategories,
      marketplaceListings,
      listingsLive,
      refreshListings,
    ],
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error("useMarketplace must be used inside MarketplaceProvider");
  return context;
}
