"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Gift, LoaderCircle, LogIn, MapPin, Minus, Package, Plus, ShieldCheck, Smartphone, Truck, X } from "lucide-react";
import { formatNpr } from "@/data/marketplace";
import {
  customerAddressError,
  customerAddressSelect,
  formatCustomerAddress,
  type CustomerAddressRow,
} from "@/lib/customer-addresses";
import { createClient } from "@/lib/supabase/client";
import { useMarketplace } from "./marketplace-provider";
import { ProductVisual } from "./product-visual";

type CheckoutMessage = { tone: "error" | "info" | "success"; text: string };
type SubmittedOrder = { orderNumber: string; total: number };
type CheckoutContact = {
  fullName: string;
  phone: string;
  email: string;
  district: string;
  municipality: string;
  ward: string;
  area: string;
  address: string;
  deliveryNote: string;
};

const emptyCheckoutContact: CheckoutContact = {
  fullName: "",
  phone: "",
  email: "",
  district: "",
  municipality: "",
  ward: "",
  area: "",
  address: "",
  deliveryNote: "",
};

const paymentMethods = [
  { id: "esewa", name: "eSewa", copy: "Will become available after the eSewa gateway is connected.", icon: Smartphone },
  { id: "khalti", name: "Khalti", copy: "Will become available after the Khalti gateway is connected.", icon: Smartphone },
  { id: "bank", name: "Card / bank payment", copy: "Will become available through an approved payment gateway.", icon: CreditCard },
];

export function CheckoutView() {
  const { cart, listings, listingsLive, user, openLogin, updateCartQuantity, removeFromCart, clearCart } = useMarketplace();
  const [message, setMessage] = useState<CheckoutMessage | null>(null);
  const [contact, setContact] = useState<CheckoutContact>(emptyCheckoutContact);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddressRow[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressBookError, setAddressBookError] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [newAddress, setNewAddress] = useState({ label: "", ...emptyCheckoutContact });
  const [orderKind, setOrderKind] = useState<"self" | "gift">("self");
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftNote, setGiftNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);

  const lines = useMemo(() => cart.flatMap((line) => {
    const listing = listings.find((item) => item.id === line.listingId);
    return listing ? [{ ...line, listing }] : [];
  }), [cart, listings]);

  const quoteLines = lines.filter((line) => line.unitPrice === undefined && line.listing.price === undefined);
  const subtotal = lines.reduce((total, line) => {
    const price = line.unitPrice ?? line.listing.price;
    return price === undefined ? total : total + price * line.quantity;
  }, 0);
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);

  const restrictedDistrictLists = useMemo(() => lines
    .map((line) => line.listing.district)
    .filter((districtList) => districtList.length > 0), [lines]);
  const compatibleDistricts = useMemo(() => restrictedDistrictLists.length
    ? [...new Set(restrictedDistrictLists[0])]
      .filter((candidate) => restrictedDistrictLists.every((districtList) => districtList.includes(candidate)))
      .sort((left, right) => left.localeCompare(right))
    : [], [restrictedDistrictLists]);
  const deliveryConflict = restrictedDistrictLists.length > 1 && compatibleDistricts.length === 0;
  const district = contact.district;
  const unsupportedLines = district
    ? lines.filter((line) => line.listing.district.length > 0 && !line.listing.district.includes(district))
    : [];
  const unavailableLines = lines.filter((line) => {
    const variant = line.variantId ? line.listing.variants?.find((item) => item.id === line.variantId) : undefined;
    return !line.listing.available || (variant ? !variant.available || line.quantity > Math.floor(variant.stockQuantity) : false);
  });

  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId) ?? null;

  const blockers = [
    user && !selectedAddress ? "Select a delivery address to continue." : "",
    deliveryConflict ? "The items in this cart do not share a supported delivery district. Split the cart into separate orders." : "",
    unsupportedLines.length ? `Some items cannot be delivered to ${district}.` : "",
    quoteLines.length ? `${quoteLines.length} item${quoteLines.length === 1 ? " requires" : "s require"} a quotation before online payment.` : "",
    unavailableLines.length ? `${unavailableLines.length} item${unavailableLines.length === 1 ? " is" : "s are"} unavailable or exceeds current stock.` : "",
  ].filter(Boolean);

  const loadAddresses = async (preferredId?: string) => {
    if (!user) return;
    setAddressesLoading(true);
    setAddressBookError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customer_addresses")
        .select(customerAddressSelect)
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as CustomerAddressRow[];
      setSavedAddresses(rows);
      const compatible = (address: CustomerAddressRow) => !deliveryConflict
        && (!restrictedDistrictLists.length || compatibleDistricts.includes(address.district));
      const preferred = preferredId ? rows.find((address) => address.id === preferredId && compatible(address)) : undefined;

      if (preferred) {
        setSelectedAddressId(preferred.id);
        setContact({
          fullName: preferred.full_name,
          phone: preferred.phone,
          email: preferred.email,
          district: preferred.district,
          municipality: preferred.municipality,
          ward: preferred.ward,
          area: preferred.area,
          address: preferred.street_address,
          deliveryNote: preferred.delivery_note ?? "",
        });
      } else {
        setSelectedAddressId(null);
        setContact({
          ...emptyCheckoutContact,
          fullName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
          phone: user.phone ?? "",
          email: user.email ?? "",
        });
      }
    } catch (caught) {
      setSavedAddresses([]);
      setAddressBookError(customerAddressError(caught));
      setSelectedAddressId(null);
      setContact({
        ...emptyCheckoutContact,
        fullName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
        phone: user.phone ?? "",
        email: user.email ?? "",
      });
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setSavedAddresses([]);
        setAddressBookError("");
        setSelectedAddressId(null);
        setContact(emptyCheckoutContact);
      });
      return;
    }
    void loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, compatibleDistricts, deliveryConflict, restrictedDistrictLists.length]);

  const applySavedAddress = (address: CustomerAddressRow) => {
    const supported = !deliveryConflict
      && (!restrictedDistrictLists.length || compatibleDistricts.includes(address.district));
    if (!supported) return;
    setSelectedAddressId(address.id);
    setContact({
      fullName: address.full_name,
      phone: address.phone,
      email: address.email,
      district: address.district,
      municipality: address.municipality,
      ward: address.ward,
      area: address.area,
      address: address.street_address,
      deliveryNote: address.delivery_note ?? "",
    });
    setMessage(null);
  };

  const useAnotherAddress = () => {
    setNewAddress({
      label: "",
      ...emptyCheckoutContact,
      fullName: typeof user?.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
    });
    setModalError("");
    setAddressModalOpen(true);
  };

  const updateNewAddress = (field: keyof typeof newAddress, value: string) => {
    setNewAddress((current) => ({ ...current, [field]: value }));
  };

  const saveModalAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setAddressModalOpen(false);
      openLogin();
      return;
    }
    setModalSaving(true);
    setModalError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customer_addresses")
        .insert({
          user_id: user.id,
          label: newAddress.label.trim() || `${newAddress.district} address`,
          full_name: newAddress.fullName.trim(),
          phone: newAddress.phone.trim(),
          email: newAddress.email.trim(),
          district: newAddress.district,
          municipality: newAddress.municipality.trim(),
          ward: newAddress.ward,
          area: newAddress.area.trim(),
          street_address: newAddress.address.trim(),
          delivery_note: newAddress.deliveryNote.trim() || null,
          is_default: savedAddresses.length === 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      setAddressModalOpen(false);
      setMessage(null);
      await loadAddresses((data as { id: string } | null)?.id);
    } catch (caught) {
      setModalError(customerAddressError(caught));
    } finally {
      setModalSaving(false);
    }
  };

  const updateContact = (field: keyof CheckoutContact, value: string) => {
    setContact((current) => ({ ...current, [field]: value }));
  };

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!user) {
      openLogin();
      setMessage({ tone: "info", text: "Sign in or create an account. This checkout page will remain open behind the sign-in window." });
      return;
    }
    if (blockers.length) {
      setMessage({ tone: "error", text: blockers.join(" ") });
      return;
    }
    if (!listingsLive) {
      setMessage({ tone: "error", text: "The live Supabase catalogue is not connected, so this fallback catalogue cannot create an order." });
      return;
    }

    const form = new FormData(event.currentTarget);
    const giftDetails = [
      orderKind === "gift" ? "Gift order" : "",
      orderKind === "gift" && giftWrap ? "Gift wrap requested" : "",
      orderKind === "gift" && giftNote.trim() ? `Gift note: ${giftNote.trim()}` : "",
    ].filter(Boolean).join(" · ");
    const deliveryNote = [contact.deliveryNote, giftDetails].filter(Boolean).join(" · ");
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_marketplace_order", {
        p_contact: {
          full_name: String(form.get("fullName") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          district: contact.district,
          municipality: contact.municipality,
          ward: contact.ward,
          area: contact.area,
          address: contact.address,
          delivery_note: deliveryNote,
        },
        p_items: lines.map((line) => ({
          listing_id: line.listing.id,
          variant_id: line.variantId ?? null,
          quantity: line.quantity,
        })),
      });
      if (error) throw error;
      const created = (data as Array<{ order_number: string; order_total: number | string }> | null)?.[0];
      if (!created) throw new Error("The order was not returned after submission.");
      setSubmittedOrder({ orderNumber: created.order_number, total: Number(created.order_total) });
      clearCart();
    } catch (caught) {
      setMessage({
        tone: "error",
        text: caught instanceof Error ? caught.message : "The order could not be submitted. Please review the cart and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedOrder) {
    return (
      <main className="simple-page">
        <div className="site-container checkout-confirmation">
          <CheckCircle2 />
          <p className="eyebrow">Order request received</p>
          <h1>{submittedOrder.orderNumber}</h1>
          <p>Your order request for <strong>{formatNpr(submittedOrder.total)}</strong> is saved. No payment has been taken. Its current status is <strong>Awaiting payment</strong> until an approved gateway is connected or the khetE team updates the order.</p>
          <div><Link className="primary-button" href={`/account/orders/${encodeURIComponent(submittedOrder.orderNumber)}`}>Track this order</Link><Link className="secondary-button" href="/products">Continue shopping</Link></div>
        </div>
      </main>
    );
  }

  if (!lines.length) {
    return <main className="simple-page"><div className="site-container empty-state cart-empty"><CreditCard /><h1>Your checkout is empty.</h1><p>Add products to the cart before continuing.</p><Link className="primary-button" href="/products">Explore products <ArrowRight size={18} /></Link></div></main>;
  }

  return (
    <main className="checkout-page">
      <div className="site-container">
        <Link className="back-link" href="/cart"><ArrowLeft size={17} /> Return to cart</Link>
        <div className="checkout-heading"><div><p className="eyebrow">Secure checkout</p><h1>Delivery and payment</h1><p>Confirm the destination and review every quantity before payment.</p></div><div className="checkout-trust"><ShieldCheck /><span>Payment details will be handled by the connected gateway, not stored by the marketplace.</span></div></div>

        <form className="checkout-layout" onSubmit={submitCheckout}>
          <div className="checkout-main">
            {blockers.length ? <section className="checkout-blockers" aria-live="polite"><AlertTriangle /><div><strong>Checkout needs your attention</strong><ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div></section> : null}

            <section className="checkout-card">
              <div className="checkout-section-heading"><span>1</span><div><h2>Contact information</h2><p>We will use these details for confirmations and delivery updates.</p></div></div>
              {user ? (
                <div className="checkout-address-book">
                  <div className="checkout-address-book-heading">
                    <div><MapPin /><span><strong>Where should this order be delivered?</strong><small>Choose one of your saved profiles, or add a new one.</small></span></div>
                    <Link href="/account/addresses">Manage addresses</Link>
                  </div>
                  {addressesLoading ? <p className="checkout-address-state"><LoaderCircle className="admin-spinner" /> Loading saved addresses…</p> : null}
                  {addressBookError ? <p className="checkout-address-state checkout-address-error">{addressBookError}</p> : null}
                  {!addressesLoading && !addressBookError ? (
                    <div className="checkout-saved-addresses">
                      {savedAddresses.map((address) => {
                        const supported = !deliveryConflict
                          && (!restrictedDistrictLists.length || compatibleDistricts.includes(address.district));
                        return (
                          <label className={`${selectedAddressId === address.id ? "selected " : ""}${supported ? "" : "unavailable"}`} key={address.id}>
                            <input type="radio" name="savedAddress" checked={selectedAddressId === address.id} onChange={() => applySavedAddress(address)} disabled={!supported} />
                            <span>
                              <strong>{address.label}{address.is_default ? <em>Default</em> : null}</strong>
                              <small>{address.full_name} · {formatCustomerAddress(address)}</small>
                              {!supported ? <b>Not available for this cart</b> : null}
                            </span>
                            {selectedAddressId === address.id ? <Check /> : <MapPin />}
                          </label>
                        );
                      })}
                      <button className={selectedAddressId === null ? "selected" : ""} type="button" onClick={useAnotherAddress}>
                        <Plus /><span><strong>Use another address</strong><small>Add and use a new delivery profile.</small></span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="checkout-form-grid">
                <label>Full name<input name="fullName" value={contact.fullName} onChange={(event) => updateContact("fullName", event.target.value)} autoComplete="name" required /></label>
                <label>Mobile number<input name="phone" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" pattern="(?:\+977[ -]?)?9[678][0-9]{8}" title="Enter a valid Nepal mobile number, for example 98XXXXXXXX" required /></label>
                <label className="checkout-span-two">Email address<input name="email" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} type="email" autoComplete="email" required /></label>
              </div>
            </section>

            <section className="checkout-card">
              <div className="checkout-section-heading"><span>2</span><div><h2>Delivery address</h2><p>The final delivery charge and timing will be confirmed for this address.</p></div></div>
              {deliveryConflict ? <div className="checkout-warning">No single district supports every item in this cart. Return to the cart and place separate orders.</div> : null}
              {!deliveryConflict && selectedAddress ? (
                <div className="checkout-selected-address">
                  <span className="checkout-selected-check"><Check size={17} /></span>
                  <div>
                    <strong>{selectedAddress.label}{selectedAddress.is_default ? <em>Default</em> : null}</strong>
                    <small>{selectedAddress.full_name} · {formatCustomerAddress(selectedAddress)}</small>
                    {selectedAddress.delivery_note ? <small>Delivery note: {selectedAddress.delivery_note}</small> : null}
                  </div>
                  <span className="checkout-selected-badge">Delivering here</span>
                </div>
              ) : null}
              {!deliveryConflict && !selectedAddress ? (
                user ? (
                  <div className="checkout-address-prompt"><MapPin /><div><strong>No delivery address selected</strong><small>Choose one of your saved profiles above, or add a new one with “Use another address”, to continue.</small></div></div>
                ) : (
                  <div className="checkout-address-prompt"><LogIn /><div><strong>Sign in to choose a delivery address</strong><small>Your saved delivery profiles will appear in step 1 after you sign in.</small></div></div>
                )
              ) : null}
              <input type="hidden" name="district" value={contact.district} />
              <input type="hidden" name="municipality" value={contact.municipality} />
              <input type="hidden" name="ward" value={contact.ward} />
              <input type="hidden" name="area" value={contact.area} />
              <input type="hidden" name="address" value={contact.address} />
              <input type="hidden" name="deliveryNote" value={contact.deliveryNote} />
              {unsupportedLines.length ? <div className="checkout-warning">Not available in {district}: {unsupportedLines.map((line) => line.listing.name).join(", ")}.</div> : null}
            </section>

            <section className="checkout-card">
              <div className="checkout-section-heading"><span>3</span><div><h2>Order options</h2><p>Is this order for you, or a gift for someone else?</p></div></div>
              <div className="checkout-order-kind">
                <label className={orderKind === "self" ? "selected" : ""}>
                  <input type="radio" name="orderKind" checked={orderKind === "self"} onChange={() => setOrderKind("self")} />
                  <Package />
                  <span><strong>For myself</strong><small>A standard delivery to my address.</small></span>
                </label>
                <label className={orderKind === "gift" ? "selected" : ""}>
                  <input type="radio" name="orderKind" checked={orderKind === "gift"} onChange={() => setOrderKind("gift")} />
                  <Gift />
                  <span><strong>Send as a gift</strong><small>Wrapped and delivered to someone special.</small></span>
                </label>
              </div>
              {orderKind === "gift" ? (
                <div className="checkout-gift-options">
                  <label className="checkout-gift-wrap">
                    <input type="checkbox" checked={giftWrap} onChange={(event) => setGiftWrap(event.target.checked)} />
                    <span className="checkout-gift-wrap-icon"><Gift size={17} /></span>
                    <span><strong>Add gift wrap</strong><small>Items are wrapped before dispatch.</small></span>
                  </label>
                  <label className="checkout-gift-note">Special note for the gift <span>(optional)</span><textarea name="giftNote" rows={2} value={giftNote} onChange={(event) => setGiftNote(event.target.value)} placeholder="A short message to include with the gift" /></label>
                </div>
              ) : null}
            </section>

            <section className="checkout-card">
              <div className="checkout-section-heading"><span>4</span><div><h2>Payment method</h2><p>Cash on delivery is disabled. Submit the order request now; it will stay marked Awaiting payment until an approved online gateway is connected.</p></div></div>
              <div className="payment-methods">
                {paymentMethods.map((method) => { const Icon = method.icon; return <div className="payment-method-unavailable" key={method.id}><Icon /><span><strong>{method.name}</strong><small>{method.copy}</small></span><em>Not connected</em></div>; })}
              </div>
            </section>
          </div>

          <aside className="checkout-review">
            <div className="checkout-review-heading"><div><p className="eyebrow">Order review</p><h2>{itemCount} items</h2></div><Link href="/cart">Edit cart</Link></div>
            <div className="checkout-review-lines">
              {lines.map((line) => {
                const price = line.unitPrice ?? line.listing.price;
                const variant = line.variantId ? line.listing.variants?.find((item) => item.id === line.variantId) : undefined;
                const maximum = variant ? Math.max(0, Math.floor(variant.stockQuantity)) : undefined;
                const updateQuantity = (next: number) => updateCartQuantity(line.id, maximum === undefined ? Math.max(1, next) : Math.min(maximum, Math.max(1, next)));
                return <article key={line.id}><Link href={`/products/${line.listing.slug}`}><ProductVisual listing={line.listing} /></Link><div><strong>{line.listing.name}</strong>{line.variantName ? <small>{line.variantName}</small> : null}<div className="quantity-stepper"><button type="button" aria-label={`Decrease ${line.listing.name} quantity`} disabled={line.quantity <= 1} onClick={() => updateQuantity(line.quantity - 1)}><Minus size={14} /></button><input aria-label={`${line.listing.name} quantity`} type="number" min="1" max={maximum} value={line.quantity} onChange={(event) => updateQuantity(Number(event.target.value) || 1)} /><button type="button" aria-label={`Increase ${line.listing.name} quantity`} disabled={maximum !== undefined && line.quantity >= maximum} onClick={() => updateQuantity(line.quantity + 1)}><Plus size={14} /></button></div><button className="checkout-remove" type="button" onClick={() => removeFromCart(line.id)}>Remove</button></div><b>{price !== undefined ? formatNpr(price * line.quantity) : "Quotation"}</b></article>;
              })}
            </div>
            <div className="checkout-totals"><div><span>Priced-item subtotal</span><strong>{formatNpr(subtotal)}</strong></div>{quoteLines.length ? <div className="checkout-quote-total"><span>Quotation items</span><strong>{quoteLines.length} excluded</strong></div> : null}<div><span>Delivery</span><span>Calculated after address review</span></div><div><span>Estimated total before delivery</span><strong>{formatNpr(subtotal)}</strong></div></div>
            <button className="primary-button checkout-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="admin-spinner" size={18} /> Submitting order…</> : <>{user ? "Submit order request" : "Sign in to continue"} <ArrowRight size={18} /></>}</button>
            {message ? <p className={`checkout-message checkout-message-${message.tone}`} role="status">{message.text}</p> : null}
            <p className="checkout-fine-print"><Truck size={15} /> The order will be saved, but no payment, invoice, email or SMS is created until those services are connected.</p>
          </aside>
        </form>
      </div>

      {addressModalOpen ? (
        <div className="checkout-modal-overlay" role="presentation" onClick={() => setAddressModalOpen(false)}>
          <div className="checkout-modal" role="dialog" aria-modal="true" aria-label="Add a new delivery address" onClick={(event) => event.stopPropagation()}>
            <header className="checkout-modal-heading">
              <div><p className="eyebrow">New delivery profile</p><h2>Use another address</h2><p>The address is saved to your delivery profiles and selected for this order.</p></div>
              <button className="checkout-modal-close" type="button" aria-label="Close" onClick={() => setAddressModalOpen(false)}><X size={18} /></button>
            </header>
            <form className="checkout-form-grid" onSubmit={saveModalAddress}>
              <label>Profile label<input name="modalLabel" value={newAddress.label} onChange={(event) => updateNewAddress("label", event.target.value)} placeholder="e.g. Farm, Office, Rental house" /></label>
              <label>District{restrictedDistrictLists.length > 0
                ? <select name="modalDistrict" value={newAddress.district} onChange={(event) => updateNewAddress("district", event.target.value)} required><option value="">Select a supported district</option>{compatibleDistricts.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                : <input name="modalDistrict" value={newAddress.district} onChange={(event) => updateNewAddress("district", event.target.value)} placeholder="Enter district" required />}
              </label>
              <label>Full name<input name="modalFullName" value={newAddress.fullName} onChange={(event) => updateNewAddress("fullName", event.target.value)} autoComplete="name" required /></label>
              <label>Mobile number<input name="modalPhone" value={newAddress.phone} onChange={(event) => updateNewAddress("phone", event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" pattern="(?:\+977[ -]?)?9[678][0-9]{8}" title="Enter a valid Nepal mobile number, for example 98XXXXXXXX" required /></label>
              <label>Email address<input name="modalEmail" value={newAddress.email} onChange={(event) => updateNewAddress("email", event.target.value)} type="email" autoComplete="email" required /></label>
              <label>Municipality / city<input name="modalMunicipality" value={newAddress.municipality} onChange={(event) => updateNewAddress("municipality", event.target.value)} required /></label>
              <label>Ward number<input name="modalWard" value={newAddress.ward} onChange={(event) => updateNewAddress("ward", event.target.value)} type="number" min="1" max="99" inputMode="numeric" required /></label>
              <label>Area / locality<input name="modalArea" value={newAddress.area} onChange={(event) => updateNewAddress("area", event.target.value)} required /></label>
              <label className="checkout-span-two">Street address and landmark<textarea name="modalAddress" value={newAddress.address} onChange={(event) => updateNewAddress("address", event.target.value)} rows={2} required /></label>
              <label className="checkout-span-two">Delivery note <span>(optional)</span><textarea name="modalDeliveryNote" value={newAddress.deliveryNote} onChange={(event) => updateNewAddress("deliveryNote", event.target.value)} rows={2} placeholder="Access instructions, preferred calling time or other useful details" /></label>
              {modalError ? <p className="checkout-span-two checkout-modal-error" role="alert">{modalError}</p> : null}
              <div className="checkout-span-two checkout-modal-actions">
                <button className="secondary-button" type="button" onClick={() => setAddressModalOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit" disabled={modalSaving}>{modalSaving ? <><LoaderCircle className="admin-spinner" size={17} /> Saving address…</> : <><Check size={17} /> Save and use this address</>}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
