"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { BrandName } from "@/components/brand-name";
import { useMarketplace } from "@/components/marketplace-provider";
import {
  addressDraftFromRow,
  customerAddressError,
  customerAddressSelect,
  formatCustomerAddress,
  type CustomerAddressDraft,
  type CustomerAddressRow,
} from "@/lib/customer-addresses";
import { createClient } from "@/lib/supabase/client";

type EditorState = {
  id: string | null;
  draft: CustomerAddressDraft;
};

type Notice = {
  tone: "error" | "success";
  text: string;
};

function emptyDraft(user: NonNullable<ReturnType<typeof useMarketplace>["user"]>): CustomerAddressDraft {
  return {
    label: "Home",
    fullName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
    phone: user.phone ?? "",
    email: user.email ?? "",
    district: "",
    municipality: "",
    ward: "",
    area: "",
    streetAddress: "",
    deliveryNote: "",
    isDefault: false,
  };
}

export function CustomerAddressBook() {
  const { user, authReady, openLogin } = useMarketplace();
  const [addresses, setAddresses] = useState<CustomerAddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const sortedAddresses = useMemo(
    () => [...addresses].sort((left, right) => Number(right.is_default) - Number(left.is_default)
      || new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    [addresses],
  );

  const loadAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customer_addresses")
        .select(customerAddressSelect)
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setAddresses((data ?? []) as unknown as CustomerAddressRow[]);
    } catch (caught) {
      setNotice({ tone: "error", text: customerAddressError(caught) });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    const timer = window.setTimeout(() => void loadAddresses(), 0);
    return () => window.clearTimeout(timer);
  }, [authReady, loadAddresses]);

  const startNew = () => {
    if (!user) return;
    setNotice(null);
    setEditor({
      id: null,
      draft: {
        ...emptyDraft(user),
        isDefault: addresses.length === 0,
      },
    });
  };

  const startEdit = (address: CustomerAddressRow) => {
    setNotice(null);
    setEditor({ id: address.id, draft: addressDraftFromRow(address) });
  };

  const updateDraft = <Key extends keyof CustomerAddressDraft>(
    key: Key,
    value: CustomerAddressDraft[Key],
  ) => {
    setEditor((current) => current
      ? { ...current, draft: { ...current.draft, [key]: value } }
      : current);
  };

  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !editor) return;
    setSaving(true);
    setNotice(null);
    const payload = {
      label: editor.draft.label.trim(),
      full_name: editor.draft.fullName.trim(),
      phone: editor.draft.phone.trim(),
      email: editor.draft.email.trim(),
      district: editor.draft.district.trim(),
      municipality: editor.draft.municipality.trim(),
      ward: editor.draft.ward.trim(),
      area: editor.draft.area.trim(),
      street_address: editor.draft.streetAddress.trim(),
      delivery_note: editor.draft.deliveryNote.trim() || null,
      is_default: editor.draft.isDefault || addresses.length === 0,
    };

    try {
      const supabase = createClient();
      const request = editor.id
        ? supabase
          .from("customer_addresses")
          .update(payload)
          .eq("id", editor.id)
          .eq("user_id", user.id)
        : supabase
          .from("customer_addresses")
          .insert({ ...payload, user_id: user.id });
      const { error } = await request;
      if (error) throw error;
      setEditor(null);
      setNotice({
        tone: "success",
        text: editor.id ? "Delivery profile updated." : "Delivery profile saved.",
      });
      await loadAddresses();
    } catch (caught) {
      setNotice({ tone: "error", text: customerAddressError(caught) });
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (address: CustomerAddressRow) => {
    if (!user || address.is_default) return;
    setSaving(true);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("customer_addresses")
        .update({ is_default: true })
        .eq("id", address.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setNotice({ tone: "success", text: `${address.label} is now your default delivery profile.` });
      await loadAddresses();
    } catch (caught) {
      setNotice({ tone: "error", text: customerAddressError(caught) });
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (address: CustomerAddressRow) => {
    if (!user || !window.confirm(`Delete the “${address.label}” delivery profile?`)) return;
    setSaving(true);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", address.id)
        .eq("user_id", user.id);
      if (error) throw error;
      if (editor?.id === address.id) setEditor(null);
      setNotice({ tone: "success", text: "Delivery profile deleted." });
      await loadAddresses();
    } catch (caught) {
      setNotice({ tone: "error", text: customerAddressError(caught) });
    } finally {
      setSaving(false);
    }
  };

  if (!authReady || loading) {
    return (
      <main className="address-book-page">
        <div className="site-container address-book-loading">
          <LoaderCircle className="admin-spinner" /> Loading delivery profiles…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="simple-page">
        <div className="site-container empty-state account-guest">
          <UserRound />
          <h1>Log in to manage delivery profiles.</h1>
          <p>Saved addresses are private and are available only in your <BrandName /> account.</p>
          <button className="primary-button" type="button" onClick={openLogin}>Login or register</button>
        </div>
      </main>
    );
  }

  return (
    <main className="address-book-page">
      <div className="site-container">
        <Link className="back-link" href="/account"><ArrowLeft size={17} /> Back to account</Link>

        <section className="address-book-hero">
          <div>
            <p className="eyebrow">Customer account</p>
            <h1>Delivery profiles</h1>
            <p>Save trusted delivery details once, then select them securely during checkout.</p>
          </div>
          <button className="primary-button" type="button" onClick={startNew} disabled={saving}>
            <Plus size={18} /> Add address
          </button>
        </section>

        {notice ? (
          <p className={`address-book-notice address-book-notice-${notice.tone}`} role="status">
            {notice.tone === "success" ? <Check size={17} /> : null}
            {notice.text}
          </p>
        ) : null}

        <div className={`address-book-layout${editor ? " has-editor" : ""}`}>
          <section className="address-book-list" aria-labelledby="saved-addresses-heading">
            <div className="address-book-heading">
              <div>
                <p className="eyebrow">Saved securely</p>
                <h2 id="saved-addresses-heading">My addresses</h2>
              </div>
              <span>{addresses.length} saved</span>
            </div>

            {!sortedAddresses.length ? (
              <div className="address-book-empty">
                <MapPin />
                <h3>No saved delivery profiles</h3>
                <p>Add your home, farm, office or another regular delivery location.</p>
                <button className="secondary-button" type="button" onClick={startNew}>
                  <Plus size={17} /> Add your first address
                </button>
              </div>
            ) : (
              <div className="address-card-grid">
                {sortedAddresses.map((address) => (
                  <article className={`address-card${address.is_default ? " is-default" : ""}`} key={address.id}>
                    <header>
                      <span><MapPin /></span>
                      <div>
                        <strong>{address.label}</strong>
                        {address.is_default ? <em><Star /> Default</em> : null}
                      </div>
                    </header>
                    <h3>{address.full_name}</h3>
                    <p>{formatCustomerAddress(address)}</p>
                    <div className="address-card-contact">
                      <span>{address.phone}</span>
                      <span>{address.email}</span>
                    </div>
                    {address.delivery_note ? <small>Note: {address.delivery_note}</small> : null}
                    <footer>
                      <button type="button" onClick={() => startEdit(address)} disabled={saving}>
                        <Pencil /> Edit
                      </button>
                      {!address.is_default ? (
                        <button type="button" onClick={() => void makeDefault(address)} disabled={saving}>
                          <Star /> Make default
                        </button>
                      ) : null}
                      <button className="address-delete-button" type="button" onClick={() => void deleteAddress(address)} disabled={saving}>
                        <Trash2 /> Delete
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>

          {editor ? (
            <aside className="address-editor">
              <div className="address-editor-heading">
                <div>
                  <p className="eyebrow">{editor.id ? "Update profile" : "New profile"}</p>
                  <h2>{editor.id ? "Edit address" : "Add an address"}</h2>
                </div>
                <button type="button" aria-label="Close address editor" onClick={() => setEditor(null)} disabled={saving}>
                  <X />
                </button>
              </div>

              <form onSubmit={saveAddress}>
                <div className="address-form-grid">
                  <label>Address label<input value={editor.draft.label} onChange={(event) => updateDraft("label", event.target.value)} maxLength={40} placeholder="Home, Farm or Office" required /></label>
                  <label>Full name<input value={editor.draft.fullName} onChange={(event) => updateDraft("fullName", event.target.value)} autoComplete="name" maxLength={120} required /></label>
                  <label>Mobile number<input value={editor.draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" pattern="(?:\+977[ -]?)?9[678][0-9]{8}" title="Enter a valid Nepal mobile number, for example 98XXXXXXXX" required /></label>
                  <label>Email address<input value={editor.draft.email} onChange={(event) => updateDraft("email", event.target.value)} type="email" autoComplete="email" maxLength={254} required /></label>
                  <label>District<input value={editor.draft.district} onChange={(event) => updateDraft("district", event.target.value)} maxLength={80} required /></label>
                  <label>Municipality / city<input value={editor.draft.municipality} onChange={(event) => updateDraft("municipality", event.target.value)} maxLength={120} required /></label>
                  <label>Ward number<input value={editor.draft.ward} onChange={(event) => updateDraft("ward", event.target.value)} type="number" min="1" max="99" inputMode="numeric" required /></label>
                  <label>Area / locality<input value={editor.draft.area} onChange={(event) => updateDraft("area", event.target.value)} maxLength={160} required /></label>
                  <label className="address-span-two">Street address and landmark<textarea value={editor.draft.streetAddress} onChange={(event) => updateDraft("streetAddress", event.target.value)} rows={3} maxLength={500} required /></label>
                  <label className="address-span-two">Delivery note <span>(optional)</span><textarea value={editor.draft.deliveryNote} onChange={(event) => updateDraft("deliveryNote", event.target.value)} rows={2} maxLength={500} placeholder="Access instructions or preferred calling time" /></label>
                </div>
                <label className="address-default-toggle">
                  <input type="checkbox" checked={editor.draft.isDefault} onChange={(event) => updateDraft("isDefault", event.target.checked)} disabled={addresses.length === 0} />
                  <span><strong>Use as default</strong><small>Checkout will select this delivery profile first.</small></span>
                </label>
                <div className="address-editor-actions">
                  <button className="secondary-button" type="button" onClick={() => setEditor(null)} disabled={saving}>Cancel</button>
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? <><LoaderCircle className="admin-spinner" /> Saving…</> : <>Save delivery profile</>}
                  </button>
                </div>
              </form>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
