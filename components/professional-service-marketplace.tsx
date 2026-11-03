"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace-provider";
import { BrandName } from "@/components/brand-name";
import { ServiceGuidanceCallout } from "@/components/service-guidance-callout";
import { EntityCertificates } from "@/components/entity-certificates";
import { formatNpr } from "@/data/marketplace";
import { labelProfessionalOfferingKind } from "@/lib/professional-finance";
import {
  labelProfessionalRole,
  pluralProfessionalRole,
  professionalRoles,
  type ProfessionalRole,
} from "@/lib/professional-network";
import {
  professionalServiceError,
  professionalServiceOfferingSelect,
  type ProfessionalServiceOfferingSummary,
} from "@/lib/professional-services";
import { createClient } from "@/lib/supabase/client";

type RoleFilter = "all" | ProfessionalRole;

type RequestForm = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceLocation: string;
  preferredDate: string;
  preferredTimeSlot: string;
  quantity: string;
  customerNote: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyRequestForm(): RequestForm {
  return {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    serviceLocation: "",
    preferredDate: today(),
    preferredTimeSlot: "Morning (8:00–12:00)",
    quantity: "1",
    customerNote: "",
  };
}

export function ProfessionalServiceMarketplace({
  initialProviderId = "",
}: {
  initialProviderId?: string;
}) {
  const { user, openLogin } = useMarketplace();
  const [offerings, setOfferings] = useState<ProfessionalServiceOfferingSummary[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [providerFilter, setProviderFilter] = useState(initialProviderId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProfessionalServiceOfferingSummary | null>(null);
  const [form, setForm] = useState<RequestForm>(emptyRequestForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successNumber, setSuccessNumber] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from("professional_offerings")
          .select(professionalServiceOfferingSelect)
          .eq("status", "active")
          .neq("kind", "partner_product")
          .eq("professional_profiles.status", "active")
          .order("created_at", { ascending: false });
        if (loadError) throw loadError;
        if (mounted) {
          setOfferings((data ?? []) as unknown as ProfessionalServiceOfferingSummary[]);
        }
      } catch (caught) {
        if (mounted) setError(professionalServiceError(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !selected) return;
    const fullName =
      typeof user.user_metadata.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";
    queueMicrotask(() =>
      setForm((current) => ({
        ...current,
        customerName: current.customerName || fullName,
        customerEmail: current.customerEmail || user.email || "",
      })),
    );
  }, [selected, user]);

  const providers = useMemo(() => {
    const byId = new Map<string, ProfessionalServiceOfferingSummary["professional_profiles"]>();
    offerings.forEach((offering) => {
      byId.set(offering.professional_profiles.id, offering.professional_profiles);
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [offerings]);

  const visibleOfferings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return offerings.filter((offering) => {
      const provider = offering.professional_profiles;
      if (roleFilter !== "all" && provider.role !== roleFilter) return false;
      if (providerFilter && provider.id !== providerFilter) return false;
      if (!needle) return true;
      return [
        offering.title,
        offering.description ?? "",
        provider.name,
        provider.organization_name ?? "",
        provider.position_title,
        provider.location,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [offerings, providerFilter, query, roleFilter]);

  const quantity = Math.max(1, Number(form.quantity) || 1);
  const requestTotal = selected ? Number(selected.price) * quantity : 0;

  const closeDialog = () => {
    setSelected(null);
    setSuccessNumber("");
    setError("");
    setForm(emptyRequestForm());
  };

  const openRequest = (offering: ProfessionalServiceOfferingSummary) => {
    const fullName =
      user && typeof user.user_metadata.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";
    setSelected(offering);
    setSuccessNumber("");
    setError("");
    setForm({
      ...emptyRequestForm(),
      customerName: fullName,
      customerEmail: user?.email || "",
    });
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !user) return;
    setSubmitting(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: submitError } = await supabase.rpc(
        "create_professional_service_request",
        {
          p_offering_id: selected.id,
          p_customer_name: form.customerName.trim(),
          p_customer_email: form.customerEmail.trim(),
          p_customer_phone: form.customerPhone.trim(),
          p_service_location: form.serviceLocation.trim(),
          p_preferred_date: form.preferredDate,
          p_preferred_time_slot: form.preferredTimeSlot,
          p_quantity: quantity,
          p_customer_note: form.customerNote.trim() || null,
        },
      );
      if (submitError) throw submitError;
      setSuccessNumber(String(data));
    } catch (caught) {
      setError(professionalServiceError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="professional-services-section" id="professional-services">
      <div className="site-container">
        <header className="professional-services-heading">
          <div>
            <p className="eyebrow">Advisors & experts for hire</p>
            <h2>Hire a professional for your farm</h2>
            <p>
              Request a service from an approved Advisor, Expert Professional or Associate
              Partner. The price shown is verified when the request is submitted.
            </p>
          </div>
          <div className="professional-services-heading-actions">
            <Link className="secondary-button" href="/experts/apply">
              Become a <BrandName /> Pro
            </Link>
            <Link className="secondary-button" href="/account/service-requests">
              My service requests <ArrowRight />
            </Link>
          </div>
        </header>

        <ServiceGuidanceCallout />

        <div className="professional-service-toolbar">
          <label className="professional-service-search">
            <Search />
            <span className="sr-only">Search professional services</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search service, provider or location…"
            />
          </label>
          <label>
            <span>Professional type</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            >
              <option value="all">All professionals</option>
              {professionalRoles.map((role) => (
                <option value={role} key={role}>
                  {pluralProfessionalRole(role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Provider</span>
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
              <option value="">All providers</option>
              {providers.map((provider) => (
                <option value={provider.id} key={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          {providerFilter || roleFilter !== "all" || query ? (
            <button
              type="button"
              onClick={() => {
                setProviderFilter("");
                setRoleFilter("all");
                setQuery("");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="professional-service-grid" aria-live="polite">
          {loading ? (
            <div className="professional-service-empty">
              <LoaderCircle className="admin-spinner" />
              <strong>Loading verified services…</strong>
            </div>
          ) : null}
          {!loading && error ? (
            <div className="professional-service-empty professional-service-error">
              <ShieldCheck />
              <strong>Professional services are being prepared.</strong>
              <p>{error}</p>
            </div>
          ) : null}
          {!loading && !error && !visibleOfferings.length ? (
            <div className="professional-service-empty">
              <CalendarClock />
              <strong>No matching services yet</strong>
              <p>Change the filters or ask Support to help find the right professional.</p>
              <Link href="/support?type=custom_request">Contact Support</Link>
            </div>
          ) : null}
          {visibleOfferings.map((offering) => {
            const provider = offering.professional_profiles;
            return (
              <article className="professional-service-card" key={offering.id}>
                <Link
                  className="professional-service-card-main"
                  href={`/experts/${provider.slug}`}
                  aria-label={`View ${provider.name}'s profile`}
                >
                  <header>
                    <span
                      className={`professional-service-provider-image${provider.role === "associate_partner" ? " brand-image" : ""}`}
                      style={
                        provider.profile_image_url
                          ? { backgroundImage: `url("${provider.profile_image_url}")` }
                          : undefined
                      }
                    >
                      {!provider.profile_image_url
                        ? provider.role === "associate_partner"
                          ? <Building2 />
                          : <UserRound />
                        : null}
                    </span>
                    <span>
                      <strong>{provider.name}</strong>
                      <small>
                        <BadgeCheck /> {labelProfessionalRole(provider.role)}
                      </small>
                    </span>
                  </header>
                  <div className="professional-service-body">
                    <span>{labelProfessionalOfferingKind(offering.kind)}</span>
                    <h3>{offering.title}</h3>
                    <p>{offering.description || "Contact the professional through a verified khetE request."}</p>
                  </div>
                  <div className="professional-service-location">
                    <MapPin /> {provider.location}
                  </div>
                </Link>
                <EntityCertificates targetType="offering" targetId={offering.id} compact />
                <footer>
                  <div>
                    <small>Starting price</small>
                    <strong>
                      {formatNpr(Number(offering.price))} <span>/ {offering.unit_label}</span>
                    </strong>
                  </div>
                  <button className="primary-button" type="button" onClick={() => openRequest(offering)}>
                    {provider.role === "advisor" ? "Hire advisor" : provider.role === "expert_professional" ? "Hire expert" : "Request service"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="modal-backdrop professional-service-modal" role="presentation" onMouseDown={closeDialog}>
          <div
            className="professional-service-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="professional-service-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={closeDialog} aria-label="Close">
              <X />
            </button>
            {successNumber ? (
              <div className="professional-request-success">
                <CheckCircle2 />
                <p className="eyebrow">Request received</p>
                <h2 id="professional-service-dialog-title">Your request is confirmed.</h2>
                <p>
                  Reference <strong>{successNumber}</strong>. The professional can now review the
                  service, schedule and location you requested.
                </p>
                <div>
                  <Link className="primary-button" href="/account/service-requests">
                    Track my request
                  </Link>
                  <button className="secondary-button" type="button" onClick={closeDialog}>
                    Continue browsing
                  </button>
                </div>
              </div>
            ) : !user ? (
              <div className="professional-request-login">
                <UserRound />
                <p className="eyebrow">Customer account required</p>
                <h2 id="professional-service-dialog-title">Log in to request this service.</h2>
                <p>
                  Signing in keeps the request, replies, schedule and status private in your
                  customer account.
                </p>
                <button className="primary-button" type="button" onClick={openLogin}>
                  Login or register
                </button>
              </div>
            ) : (
              <>
                <header className="professional-service-dialog-heading">
                  <p className="eyebrow">Request a verified service</p>
                  <h2 id="professional-service-dialog-title">{selected.title}</h2>
                  <p>
                    {selected.professional_profiles.name} ·{" "}
                    {formatNpr(Number(selected.price))} / {selected.unit_label}
                  </p>
                </header>
                <form onSubmit={submitRequest}>
                  {error ? <div className="professional-service-form-error">{error}</div> : null}
                  <div className="form-grid">
                    <label>
                      Full name
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={form.customerName}
                        onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        required
                        type="email"
                        maxLength={180}
                        value={form.customerEmail}
                        onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        required
                        minLength={7}
                        maxLength={40}
                        value={form.customerPhone}
                        onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
                      />
                    </label>
                    <label>
                      Service quantity
                      <input
                        required
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={form.quantity}
                        onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                      />
                    </label>
                    <label>
                      Preferred date
                      <input
                        required
                        type="date"
                        min={today()}
                        value={form.preferredDate}
                        onChange={(event) => setForm((current) => ({ ...current, preferredDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      Preferred time
                      <select
                        value={form.preferredTimeSlot}
                        onChange={(event) => setForm((current) => ({ ...current, preferredTimeSlot: event.target.value }))}
                      >
                        <option>Morning (8:00–12:00)</option>
                        <option>Afternoon (12:00–16:00)</option>
                        <option>Evening (16:00–19:00)</option>
                        <option>Professional to confirm</option>
                      </select>
                    </label>
                    <label className="span-two">
                      Service location
                      <input
                        required
                        minLength={3}
                        maxLength={240}
                        value={form.serviceLocation}
                        onChange={(event) => setForm((current) => ({ ...current, serviceLocation: event.target.value }))}
                        placeholder="Municipality, district or online"
                      />
                    </label>
                    <label className="span-two">
                      What support do you need?
                      <textarea
                        rows={4}
                        maxLength={1600}
                        value={form.customerNote}
                        onChange={(event) => setForm((current) => ({ ...current, customerNote: event.target.value }))}
                        placeholder="Add useful details for the professional."
                      />
                    </label>
                  </div>
                  <div className="professional-request-total">
                    <span>
                      <Clock3 /> Payment is not collected online yet
                    </span>
                    <div>
                      <small>Estimated total</small>
                      <strong>{formatNpr(requestTotal)}</strong>
                    </div>
                  </div>
                  <button className="primary-button professional-request-submit" type="submit" disabled={submitting}>
                    {submitting ? <LoaderCircle className="admin-spinner" /> : <CalendarClock />}
                    Submit service request
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
