"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarClock, FileText, Heart, LoaderCircle, LogOut, MapPin, PackageCheck, RotateCcw, ShoppingBag, Star, UserRound } from "lucide-react";
import { BrandName } from "@/components/brand-name";
import { useMarketplace } from "@/components/marketplace-provider";
import { formatNpr } from "@/data/marketplace";
import { formatOrderDate, labelOrderStatus, labelPaymentStatus, orderItemSelect, orderSelect, type OrderItemRow, type OrderRow, type OrderWithItems } from "@/lib/orders";
import { professionalAccountProfileSelect, type ProfessionalAccountProfile } from "@/lib/professional-finance";
import { createClient } from "@/lib/supabase/client";

const accountSections = [
  { icon: ShoppingBag, title: "Orders & tracking", copy: "Open full order details, delivery progress and recorded updates.", href: "/account/orders" },
  { icon: CalendarClock, title: "Service requests", copy: "Track professional requests, schedules and provider updates.", href: "/account/service-requests" },
  { icon: Heart, title: "Wishlist", copy: "Keep useful products and services ready for later.", href: "/wishlist" },
  { icon: Star, title: "Reviews & ratings", copy: "Review delivered products and completed professional services.", href: "/account/reviews" },
  { icon: FileText, title: "Invoices & documents", copy: "Access printable order confirmations and invoices when issued.", href: "/account/orders?view=documents" },
  { icon: RotateCcw, title: "Cancellations & returns", copy: "Submit and follow cancellation, return and refund requests.", href: "/support?type=return_request" },
  { icon: MapPin, title: "Addresses", copy: "Manage saved delivery profiles and your default checkout address.", href: "/account/addresses" },
];

export default function AccountPage() {
  const router = useRouter();
  const { user, authReady, openLogin, signOut, wishlist, wishlistReady, profilePhoto, setProfilePhoto } = useMarketplace();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [professionalProfiles, setProfessionalProfiles] = useState<ProfessionalAccountProfile[]>([]);

  useEffect(() => {
    if (!authReady || !user) return;
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) router.replace(next);
  }, [authReady, router, user]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const supabase = createClient();
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(orderSelect)
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });
        if (orderError) throw orderError;
        const rows = (orderData ?? []) as unknown as OrderRow[];
        const ids = rows.map((order) => order.id);
        let itemRows: OrderItemRow[] = [];
        if (ids.length) {
          const { data: itemData, error: itemError } = await supabase
            .from("order_items")
            .select(orderItemSelect)
            .in("order_id", ids)
            .order("created_at", { ascending: true });
          if (itemError) throw itemError;
          itemRows = (itemData ?? []) as unknown as OrderItemRow[];
        }
        if (mounted) setOrders(rows.map((order) => ({ ...order, items: itemRows.filter((item) => item.order_id === order.id) })));
      } catch (caught) {
        if (mounted) setOrdersError(caught instanceof Error ? caught.message : "Your orders could not be loaded.");
      } finally {
        if (mounted) setOrdersLoading(false);
      }
    };
    void loadOrders();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setProfessionalProfiles([]));
      return;
    }
    let mounted = true;
    const loadProfessionalAccess = async () => {
      const supabase = createClient();
      const { data: linkData } = await supabase
        .from("professional_account_links")
        .select("profile_id")
        .eq("user_id", user.id);
      const profileIds = (linkData ?? []).map((item) => String(item.profile_id));
      if (!profileIds.length) {
        if (mounted) setProfessionalProfiles([]);
        return;
      }
      const { data } = await supabase
        .from("professional_profiles")
        .select(professionalAccountProfileSelect)
        .in("id", profileIds);
      if (mounted) {
        setProfessionalProfiles(
          ((data ?? []) as unknown as Omit<ProfessionalAccountProfile, "account_linked">[])
            .map((profile) => ({ ...profile, account_linked: true })),
        );
      }
    };
    void loadProfessionalAccess();
    return () => {
      mounted = false;
    };
  }, [user]);

  const handlePhotoFile = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("invalid image"));
      element.src = dataUrl;
    });
    const size = 256;
    const scale = Math.min(1, size / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    setProfilePhoto(canvas.toDataURL("image/jpeg", 0.85));
  };

  if (!authReady) {
    return <main className="simple-page"><div className="site-container account-loading">Loading your account…</div></main>;
  }

  if (!user) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state account-guest">
          <UserRound />
          <h1>Log in to your <BrandName /> account.</h1>
          <p>Your orders, invoices, wishlist and delivery details will be kept together here.</p>
          <button className="primary-button" type="button" onClick={openLogin}>Login or register</button>
        </div>
      </main>
    );
  }

  const fullName = typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name
    : "Customer";

  return (
    <main className="account-page">
      <div className="site-container">
        <section className="account-hero">
          <div className="account-avatar-wrap">
            <div className="account-avatar" aria-hidden={profilePhoto ? undefined : true}>
              {profilePhoto ? <img className="account-avatar-img" src={profilePhoto} alt="Your profile photo" /> : <UserRound />}
            </div>
            <div className="account-avatar-actions">
              <button className="account-avatar-edit" type="button" onClick={() => photoInputRef.current?.click()}>{profilePhoto ? "Change photo" : "Add photo"}</button>
              {profilePhoto ? <button className="account-avatar-remove" type="button" onClick={() => setProfilePhoto(null)}>Remove</button> : null}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="sr-only" aria-label="Upload profile photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handlePhotoFile(file); event.target.value = ""; }} />
          </div>
          <div>
            <p className="eyebrow">Customer account</p>
            <h1>{fullName}</h1>
            <p>{user.email}</p>
          </div>
          <button className="secondary-button account-signout" type="button" onClick={() => void signOut()}><LogOut /> Log out</button>
        </section>

        <section className="account-orders" aria-labelledby="account-orders-heading">
          <div className="account-section-heading">
            <div><p className="eyebrow">Order history</p><h2 id="account-orders-heading">My orders</h2></div>
            <Link href="/account/orders">{orders.length} order{orders.length === 1 ? "" : "s"} · Open order centre <ArrowRight /></Link>
          </div>
          {ordersLoading ? <div className="account-orders-state"><LoaderCircle className="admin-spinner" /> Loading orders…</div> : null}
          {ordersError ? <div className="account-orders-state account-orders-error">{ordersError.includes("relation") || ordersError.includes("schema cache") || ordersError.includes("return_window_ends_at") ? "Run the latest Order Tracking & Documents migration in Supabase to activate the upgraded order centre." : ordersError}</div> : null}
          {!ordersLoading && !ordersError && !orders.length ? <div className="account-orders-state"><PackageCheck /><div><strong>No orders yet</strong><p>Your submitted order requests will appear here.</p></div></div> : null}
          {orders.length ? <div className="account-order-list">{orders.map((order) => (
            <article className="account-order-card" key={order.id}>
              <header><div><strong>{order.order_number}</strong><span>{formatOrderDate(order.placed_at)}</span></div><div className="account-order-badges"><span className={`order-status order-status-${order.status}`}>{labelOrderStatus(order.status)}</span><span>{labelPaymentStatus(order.payment_status)}</span></div></header>
              <div className="account-order-items">{order.items.map((item) => <div key={item.id}><span><strong>{item.listing_name}</strong>{item.variant_name ? <small>{item.variant_name}</small> : null}</span><span>{Number(item.quantity)} × {formatNpr(Number(item.unit_price))}</span><b>{formatNpr(Number(item.line_total))}</b></div>)}</div>
              <footer><span>Delivery: {order.area}, {order.municipality}, {order.district}</span><strong>{formatNpr(Number(order.total))}</strong></footer>
              {order.tracking_reference || order.estimated_delivery_date ? <p className="account-order-tracking">{order.tracking_reference ? `Tracking: ${order.tracking_reference}` : ""}{order.tracking_reference && order.estimated_delivery_date ? " · " : ""}{order.estimated_delivery_date ? `Estimated delivery: ${new Intl.DateTimeFormat("en-NP", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${order.estimated_delivery_date}T00:00:00`))}` : ""}</p> : null}
              <Link className="account-order-open" href={`/account/orders/${encodeURIComponent(order.order_number)}`}>View tracking, documents and support <ArrowRight /></Link>
            </article>
          ))}</div> : null}
        </section>

        {professionalProfiles.length ? (
          <Link className="account-professional-card" href="/professional">
            <span><BriefcaseBusiness /></span>
            <div>
              <p className="eyebrow">Separate workspace</p>
              <h2>Open Professional Account</h2>
              <p>View your services or partner sales, gross value, deductions, net earnings and received payouts.</p>
            </div>
            <strong>{professionalProfiles.length} linked profile{professionalProfiles.length === 1 ? "" : "s"} →</strong>
          </Link>
        ) : null}

        <section className="account-grid" aria-label="Account sections">
          {accountSections.map(({ icon: Icon, title, copy, href }) => {
            const content = <>
              <span><Icon /></span>
              <h2>{title}</h2>
              <p>{copy}</p>
              <small>{title === "Wishlist" ? wishlistReady ? `${wishlist.size} saved item${wishlist.size === 1 ? "" : "s"} · Open wishlist` : "Loading saved items…" : title === "Addresses" ? "Open delivery profiles" : "Available in your account"}</small>
            </>;
            return href
              ? <Link className="account-card account-card-link" href={href} key={title}>{content}</Link>
              : <article className="account-card" key={title}>{content}</article>;
          })}
        </section>

        <div className="account-continue">
          <p>Continue exploring listings while your customer account stays signed in.</p>
          <Link className="primary-button" href="/products">Browse marketplace</Link>
        </div>
      </div>
    </main>
  );
}
