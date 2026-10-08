"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CircleDollarSign,
  HandCoins,
  Link2,
  PackageCheck,
  Pencil,
  RefreshCw,
  Save,
  Search,
  UserRound,
} from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { formatNpr } from "@/data/marketplace";
import {
  allowedOfferingKinds,
  defaultOfferingKind,
  labelProfessionalActivityStatus,
  labelProfessionalEarningStatus,
  labelProfessionalOfferingKind,
  labelProfessionalOfferingStatus,
  professionalAccountProfileSelect,
  professionalActivityStatuses,
  professionalDate,
  professionalEarningSelect,
  professionalEarningStatuses,
  professionalFinanceError,
  professionalOfferingSelect,
  professionalOfferingStatuses,
  type ProfessionalAccountProfile,
  type ProfessionalActivityStatus,
  type ProfessionalEarning,
  type ProfessionalEarningStatus,
  type ProfessionalOffering,
  type ProfessionalOfferingKind,
  type ProfessionalOfferingStatus,
} from "@/lib/professional-finance";
import { labelProfessionalRole } from "@/lib/professional-network";
import { createClient } from "@/lib/supabase/client";

type FinanceTab = "earnings" | "offerings" | "account";

type OfferingForm = {
  id: string;
  kind: ProfessionalOfferingKind;
  title: string;
  description: string;
  price: string;
  unitLabel: string;
  status: ProfessionalOfferingStatus;
};

type EarningForm = {
  id: string;
  offeringId: string;
  reference: string;
  kind: ProfessionalOfferingKind;
  title: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  commission: string;
  paymentFee: string;
  shipping: string;
  otherDeduction: string;
  activityStatus: ProfessionalActivityStatus;
  earningStatus: ProfessionalEarningStatus;
  activityDate: string;
  payoutReference: string;
  internalNote: string;
};

const financeRoles = new Set(["super_admin", "finance_manager", "order_delivery_manager"]);
const today = () => new Date().toISOString().slice(0, 10);

function emptyOffering(kind: ProfessionalOfferingKind): OfferingForm {
  return {
    id: "",
    kind,
    title: "",
    description: "",
    price: "",
    unitLabel: "service",
    status: "active",
  };
}

function emptyEarning(kind: ProfessionalOfferingKind): EarningForm {
  return {
    id: "",
    offeringId: "",
    reference: "",
    kind,
    title: "",
    quantity: "1",
    unitPrice: "",
    discount: "0",
    commission: "0",
    paymentFee: "0",
    shipping: "0",
    otherDeduction: "0",
    activityStatus: "booked",
    earningStatus: "pending",
    activityDate: today(),
    payoutReference: "",
    internalNote: "",
  };
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminProfessionalFinancePage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [profiles, setProfiles] = useState<ProfessionalAccountProfile[]>([]);
  const [offerings, setOfferings] = useState<ProfessionalOffering[]>([]);
  const [earnings, setEarnings] = useState<ProfessionalEarning[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FinanceTab>("earnings");
  const [linkEmail, setLinkEmail] = useState("");
  const [offeringForm, setOfferingForm] = useState<OfferingForm>(emptyOffering("advisory_service"));
  const [earningForm, setEarningForm] = useState<EarningForm>(emptyEarning("advisory_service"));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const [
        { data: profileData, error: profileError },
        { data: linkData, error: linkError },
        { data: offeringData, error: offeringError },
        { data: earningData, error: earningError },
      ] = await Promise.all([
        supabase
          .from("professional_profiles")
          .select(professionalAccountProfileSelect)
          .order("name", { ascending: true }),
        supabase
          .from("professional_account_links")
          .select("profile_id,user_id"),
        supabase
          .from("professional_offerings")
          .select(professionalOfferingSelect)
          .order("created_at", { ascending: false }),
        supabase
          .from("professional_earnings")
          .select(professionalEarningSelect)
          .order("activity_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (profileError || linkError || offeringError || earningError) {
        throw profileError ?? linkError ?? offeringError ?? earningError;
      }
      const linkedIds = new Set((linkData ?? []).map((item) => String(item.profile_id)));
      const profileRows = ((profileData ?? []) as unknown as Omit<ProfessionalAccountProfile, "account_linked">[])
        .map((profile) => ({ ...profile, account_linked: linkedIds.has(profile.id) }));
      setProfiles(profileRows);
      setOfferings((offeringData ?? []) as unknown as ProfessionalOffering[]);
      setEarnings((earningData ?? []) as unknown as ProfessionalEarning[]);
      setSelectedProfileId((current) =>
        current && profileRows.some((profile) => profile.id === current)
          ? current
          : profileRows[0]?.id ?? "",
      );
    } catch (caught) {
      setError(professionalFinanceError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        if (mounted) setCurrentOrigin(window.location.origin);
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (mounted) setAccess("signed-out");
          return;
        }
        if (mounted) {
          setAccountEmail(authData.user.email ?? "");
          setUserId(authData.user.id);
        }
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const roles = (roleData ?? []).map((item) => String(item.role));
        if (mounted) setDetectedRoles(roles);
        if (!roles.some((role) => financeRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setAccess("allowed");
        await loadWorkspace();
      } catch (caught) {
        if (!mounted) return;
        setError(professionalFinanceError(caught));
        setAccess("error");
      }
    };
    void checkAccess();
    return () => {
      mounted = false;
    };
  }, [loadWorkspace]);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null;
  const selectedProfileRole = selectedProfile?.role;
  const profileOfferings = useMemo(
    () => offerings.filter((offering) => offering.profile_id === selectedProfile?.id),
    [offerings, selectedProfile?.id],
  );
  const profileEarnings = useMemo(
    () => earnings.filter((earning) => earning.profile_id === selectedProfile?.id),
    [earnings, selectedProfile?.id],
  );
  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter((profile) =>
      [
        profile.name,
        profile.organization_name ?? "",
        profile.position_title,
        labelProfessionalRole(profile.role),
      ].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [profiles, query]);

  const summary = useMemo(() => {
    const included = profileEarnings.filter(
      (earning) => !["cancelled", "refunded"].includes(earning.activity_status),
    );
    const received = profileEarnings
      .filter((earning) => earning.earning_status === "paid")
      .reduce((total, earning) => total + Number(earning.net_amount), 0);
    const pending = profileEarnings
      .filter((earning) =>
        ["pending", "available", "scheduled", "withheld"].includes(earning.earning_status),
      )
      .reduce((total, earning) => total + Number(earning.net_amount), 0);
    return {
      gross: included.reduce((total, earning) => total + Number(earning.gross_amount), 0),
      net: included.reduce((total, earning) => total + Number(earning.net_amount), 0),
      received,
      pending,
    };
  }, [profileEarnings]);

  useEffect(() => {
    if (!selectedProfileRole) return;
    const kind = defaultOfferingKind(selectedProfileRole);
    queueMicrotask(() => {
      setOfferingForm(emptyOffering(kind));
      setEarningForm(emptyEarning(kind));
      setLinkEmail("");
      setError("");
      setSuccess("");
    });
  }, [selectedProfileId, selectedProfileRole]);

  const earningGross = numberValue(earningForm.quantity) * numberValue(earningForm.unitPrice);
  const earningDeductions =
    numberValue(earningForm.discount) +
    numberValue(earningForm.commission) +
    numberValue(earningForm.paymentFee) +
    numberValue(earningForm.shipping) +
    numberValue(earningForm.otherDeduction);
  const earningNet = Math.max(0, earningGross - earningDeductions);

  function selectOffering(offeringId: string) {
    const offering = profileOfferings.find((item) => item.id === offeringId);
    setEarningForm((current) => ({
      ...current,
      offeringId,
      kind: offering?.kind ?? current.kind,
      title: offering?.title ?? current.title,
      unitPrice: offering ? String(offering.price) : current.unitPrice,
    }));
  }

  function editOffering(offering: ProfessionalOffering) {
    setTab("offerings");
    setOfferingForm({
      id: offering.id,
      kind: offering.kind,
      title: offering.title,
      description: offering.description ?? "",
      price: String(offering.price),
      unitLabel: offering.unit_label,
      status: offering.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editEarning(earning: ProfessionalEarning) {
    setTab("earnings");
    setEarningForm({
      id: earning.id,
      offeringId: earning.offering_id ?? "",
      reference: earning.reference_number ?? "",
      kind: earning.activity_kind,
      title: earning.title,
      quantity: String(earning.quantity),
      unitPrice: String(earning.unit_price),
      discount: String(earning.discount_amount),
      commission: String(earning.platform_commission),
      paymentFee: String(earning.payment_fee),
      shipping: String(earning.shipping_deduction),
      otherDeduction: String(earning.other_deduction),
      activityStatus: earning.activity_status,
      earningStatus: earning.earning_status,
      activityDate: earning.activity_date,
      payoutReference: earning.payout_reference ?? "",
      internalNote: earning.internal_note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function linkAccount(emailOverride?: string) {
    if (!selectedProfile) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const requestedEmail = emailOverride ?? linkEmail.trim();
      const { error: linkError } = await supabase.rpc("link_professional_account", {
        p_profile_id: selectedProfile.id,
        p_account_email: requestedEmail,
      });
      if (linkError) throw linkError;
      setSuccess(
        requestedEmail
          ? `Professional Account linked to ${requestedEmail}.`
          : "Professional Account access was removed.",
      );
      await loadWorkspace();
    } catch (caught) {
      setError(professionalFinanceError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveOffering() {
    if (!selectedProfile) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (offeringForm.title.trim().length < 2) throw new Error("Enter the product or service name.");
      if (numberValue(offeringForm.price) < 0) throw new Error("The price cannot be negative.");
      const payload = {
        profile_id: selectedProfile.id,
        kind: offeringForm.kind,
        title: offeringForm.title.trim(),
        description: offeringForm.description.trim() || null,
        price: numberValue(offeringForm.price),
        unit_label: offeringForm.unitLabel.trim() || "service",
        status: offeringForm.status,
        updated_by: userId,
      };
      const supabase = createClient();
      if (offeringForm.id) {
        const { error: updateError } = await supabase
          .from("professional_offerings")
          .update(payload)
          .eq("id", offeringForm.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("professional_offerings")
          .insert({ ...payload, created_by: userId });
        if (insertError) throw insertError;
      }
      setSuccess(offeringForm.id ? "Offering updated." : "Offering added.");
      setOfferingForm(emptyOffering(defaultOfferingKind(selectedProfile.role)));
      await loadWorkspace();
    } catch (caught) {
      setError(professionalFinanceError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveEarning() {
    if (!selectedProfile) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (earningForm.title.trim().length < 2) throw new Error("Enter the service or sale description.");
      if (numberValue(earningForm.quantity) <= 0) throw new Error("Quantity must be greater than zero.");
      if (earningDeductions > earningGross) throw new Error("Deductions cannot exceed the gross amount.");
      if (earningForm.earningStatus === "paid" && !earningForm.payoutReference.trim()) {
        throw new Error("Enter a payout reference before marking this earning Paid.");
      }
      const payload = {
        profile_id: selectedProfile.id,
        offering_id: earningForm.offeringId || null,
        reference_number: earningForm.reference.trim() || null,
        activity_kind: earningForm.kind,
        title: earningForm.title.trim(),
        quantity: numberValue(earningForm.quantity),
        unit_price: numberValue(earningForm.unitPrice),
        gross_amount: earningGross,
        discount_amount: numberValue(earningForm.discount),
        platform_commission: numberValue(earningForm.commission),
        payment_fee: numberValue(earningForm.paymentFee),
        shipping_deduction: numberValue(earningForm.shipping),
        other_deduction: numberValue(earningForm.otherDeduction),
        activity_status: earningForm.activityStatus,
        earning_status: earningForm.earningStatus,
        activity_date: earningForm.activityDate,
        completed_at: earningForm.activityStatus === "completed" ? new Date().toISOString() : null,
        payout_reference:
          earningForm.earningStatus === "paid" ? earningForm.payoutReference.trim() : null,
        paid_at: earningForm.earningStatus === "paid" ? new Date().toISOString() : null,
        internal_note: earningForm.internalNote.trim() || null,
        updated_by: userId,
      };
      const supabase = createClient();
      if (earningForm.id) {
        const { error: updateError } = await supabase
          .from("professional_earnings")
          .update(payload)
          .eq("id", earningForm.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("professional_earnings")
          .insert({ ...payload, created_by: userId });
        if (insertError) throw insertError;
      }
      setSuccess(earningForm.id ? "Earning record updated." : "Service or sale recorded.");
      setEarningForm(emptyEarning(defaultOfferingKind(selectedProfile.role)));
      await loadWorkspace();
    } catch (caught) {
      setError(professionalFinanceError(caught));
    } finally {
      setSaving(false);
    }
  }

  if (access !== "allowed") {
    return (
      <AdminAccessCard
        access={access}
        error={error}
        email={accountEmail}
        roles={detectedRoles}
        origin={currentOrigin}
        resource="Professional Finance"
        requirement="the Super Admin, Finance Manager or Order & Delivery Manager role"
        returnTo="/admin/professional-finance"
      />
    );
  }

  return (
    <main className="admin-shell">
      <AdminSidebar active="professional-finance" />
      <section className="admin-main">
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">Professional Network</p>
            <h1>Accounts & Finance</h1>
            <p>Link professional logins, manage offerings, record earnings and confirm payouts.</p>
          </div>
          <button className="secondary-button professional-admin-refresh" type="button" onClick={() => void loadWorkspace()} disabled={loading}>
            <RefreshCw className={loading ? "admin-spinner" : ""} /> Refresh
          </button>
        </div>

        {error ? <div className="admin-notice admin-error-notice">{error}</div> : null}
        {success ? <div className="admin-notice">{success}</div> : null}

        <section className="professional-admin-stats" aria-label="Professional finance totals">
          <article><UserRound /><span><small>Profiles</small><strong>{profiles.length}</strong></span></article>
          <article><BriefcaseBusiness /><span><small>Offerings</small><strong>{offerings.length}</strong></span></article>
          <article><HandCoins /><span><small>Net earnings</small><strong>{formatNpr(earnings.reduce((total, earning) => total + Number(earning.net_amount), 0))}</strong></span></article>
          <article><Banknote /><span><small>Paid</small><strong>{formatNpr(earnings.filter((earning) => earning.earning_status === "paid").reduce((total, earning) => total + Number(earning.net_amount), 0))}</strong></span></article>
        </section>

        <div className="professional-admin-layout">
          <aside className="professional-admin-providers">
            <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search professional…" /></label>
            <div>
              {filteredProfiles.map((profile) => (
                <button className={selectedProfile?.id === profile.id ? "selected" : ""} type="button" onClick={() => setSelectedProfileId(profile.id)} key={profile.id}>
                  <span className={`professional-admin-provider-image${profile.role === "associate_partner" ? " brand-image" : ""}`} style={profile.profile_image_url ? { backgroundImage: `url("${profile.profile_image_url}")` } : undefined}>
                    {!profile.profile_image_url ? <UserRound /> : null}
                  </span>
                  <span>
                    <strong>{profile.name}</strong>
                    <small>{labelProfessionalRole(profile.role)}</small>
                    <em>{profile.account_linked ? "Account linked" : "Not linked"}</em>
                  </span>
                </button>
              ))}
              {!filteredProfiles.length ? <p>No matching professional profile.</p> : null}
            </div>
          </aside>

          <section className="professional-admin-workspace">
            {!selectedProfile ? (
              <div className="professional-dashboard-empty"><UserRound /><strong>No professional profile</strong><p>Create or approve a profile in Professional Network first.</p></div>
            ) : (
              <>
                <header className="professional-admin-profile-head">
                  <div>
                    <p className="eyebrow">{labelProfessionalRole(selectedProfile.role)}</p>
                    <h2>{selectedProfile.name}</h2>
                    <span>{selectedProfile.position_title}</span>
                  </div>
                  <span className={`professional-link-state ${selectedProfile.account_linked ? "linked" : ""}`}>
                    {selectedProfile.account_linked ? <BadgeCheck /> : <Link2 />}
                    {selectedProfile.account_linked ? "Professional Account linked" : "Login not linked"}
                  </span>
                </header>

                <section className="professional-admin-summary">
                  <div><small>Gross value</small><strong>{formatNpr(summary.gross)}</strong></div>
                  <div><small>Net earnings</small><strong>{formatNpr(summary.net)}</strong></div>
                  <div><small>Pending</small><strong>{formatNpr(summary.pending)}</strong></div>
                  <div><small>Received</small><strong>{formatNpr(summary.received)}</strong></div>
                </section>

                <div className="professional-admin-tabs">
                  <button className={tab === "earnings" ? "active" : ""} type="button" onClick={() => setTab("earnings")}><CircleDollarSign /> Earnings <span>{profileEarnings.length}</span></button>
                  <button className={tab === "offerings" ? "active" : ""} type="button" onClick={() => setTab("offerings")}><PackageCheck /> Offerings <span>{profileOfferings.length}</span></button>
                  <button className={tab === "account" ? "active" : ""} type="button" onClick={() => setTab("account")}><Link2 /> Account access</button>
                </div>

                {tab === "account" ? (
                  <section className="professional-admin-form-card">
                    <header><Link2 /><div><h3>Link the Professional Account</h3><p>The professional must first register a normal khetE account using this email.</p></div></header>
                    <div className="professional-link-form">
                      <label>Registered email address<input type="email" value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} placeholder="professional@example.com" /></label>
                      <button className="primary-button" type="button" onClick={() => void linkAccount()} disabled={saving || !linkEmail.trim()}><Link2 /> Link account</button>
                      {selectedProfile.account_linked ? <button className="secondary-button" type="button" onClick={() => void linkAccount("")} disabled={saving}>Remove access</button> : null}
                    </div>
                    <p className="professional-admin-help">After linking, this person can open <strong>/professional</strong> and see only records belonging to their approved profile.</p>
                  </section>
                ) : null}

                {tab === "offerings" ? (
                  <>
                    <section className="professional-admin-form-card">
                      <header><PackageCheck /><div><h3>{offeringForm.id ? "Edit offering" : "Add product or service"}</h3><p>Advisors and Experts receive service options; Partners may have products and services.</p></div></header>
                      <div className="form-grid">
                        <label>Offering type<select value={offeringForm.kind} onChange={(event) => setOfferingForm((current) => ({ ...current, kind: event.target.value as ProfessionalOfferingKind }))}>{allowedOfferingKinds(selectedProfile.role).map((kind) => <option value={kind} key={kind}>{labelProfessionalOfferingKind(kind)}</option>)}</select></label>
                        <label>Status<select value={offeringForm.status} onChange={(event) => setOfferingForm((current) => ({ ...current, status: event.target.value as ProfessionalOfferingStatus }))}>{professionalOfferingStatuses.map((status) => <option value={status} key={status}>{labelProfessionalOfferingStatus(status)}</option>)}</select></label>
                        <label className="span-two">Name<input value={offeringForm.title} onChange={(event) => setOfferingForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Farm planning consultation" /></label>
                        <label>Price (NPR)<input type="number" min="0" step="0.01" value={offeringForm.price} onChange={(event) => setOfferingForm((current) => ({ ...current, price: event.target.value }))} /></label>
                        <label>Unit<input value={offeringForm.unitLabel} onChange={(event) => setOfferingForm((current) => ({ ...current, unitLabel: event.target.value }))} placeholder="session, item, hour…" /></label>
                        <label className="span-two">Description<textarea rows={3} value={offeringForm.description} onChange={(event) => setOfferingForm((current) => ({ ...current, description: event.target.value }))} /></label>
                      </div>
                      <div className="admin-form-actions">
                        <button className="primary-button" type="button" onClick={() => void saveOffering()} disabled={saving}><Save /> {offeringForm.id ? "Update offering" : "Add offering"}</button>
                        {offeringForm.id ? <button type="button" onClick={() => setOfferingForm(emptyOffering(defaultOfferingKind(selectedProfile.role)))}>Cancel edit</button> : null}
                      </div>
                    </section>
                    <div className="professional-admin-record-list">
                      {profileOfferings.map((offering) => <article key={offering.id}><div><span>{labelProfessionalOfferingKind(offering.kind)}</span><strong>{offering.title}</strong><small>{formatNpr(Number(offering.price))} / {offering.unit_label}</small></div><em className={`professional-status professional-offering-${offering.status}`}>{labelProfessionalOfferingStatus(offering.status)}</em><button type="button" onClick={() => editOffering(offering)}><Pencil /> Edit</button></article>)}
                      {!profileOfferings.length ? <div className="professional-dashboard-empty"><PackageCheck /><strong>No offerings yet</strong><p>Add the first approved product or service above.</p></div> : null}
                    </div>
                  </>
                ) : null}

                {tab === "earnings" ? (
                  <>
                    <section className="professional-admin-form-card">
                      <header><CircleDollarSign /><div><h3>{earningForm.id ? "Edit earning record" : "Record a service or sale"}</h3><p>Use the full breakdown so the professional can understand the amount received.</p></div></header>
                      <div className="form-grid">
                        <label className="span-two">Approved offering<select value={earningForm.offeringId} onChange={(event) => selectOffering(event.target.value)}><option value="">Manual activity</option>{profileOfferings.map((offering) => <option value={offering.id} key={offering.id}>{offering.title}</option>)}</select></label>
                        <label>Activity type<select value={earningForm.kind} onChange={(event) => setEarningForm((current) => ({ ...current, kind: event.target.value as ProfessionalOfferingKind }))}>{allowedOfferingKinds(selectedProfile.role).map((kind) => <option value={kind} key={kind}>{labelProfessionalOfferingKind(kind)}</option>)}</select></label>
                        <label>Order / booking reference<input value={earningForm.reference} onChange={(event) => setEarningForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                        <label className="span-two">Description<input value={earningForm.title} onChange={(event) => setEarningForm((current) => ({ ...current, title: event.target.value }))} placeholder="Service or product sold" /></label>
                        <label>Quantity<input type="number" min="0.001" step="0.001" value={earningForm.quantity} onChange={(event) => setEarningForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
                        <label>Unit price (NPR)<input type="number" min="0" step="0.01" value={earningForm.unitPrice} onChange={(event) => setEarningForm((current) => ({ ...current, unitPrice: event.target.value }))} /></label>
                        <label>Discount<input type="number" min="0" step="0.01" value={earningForm.discount} onChange={(event) => setEarningForm((current) => ({ ...current, discount: event.target.value }))} /></label>
                        <label>khetE commission<input type="number" min="0" step="0.01" value={earningForm.commission} onChange={(event) => setEarningForm((current) => ({ ...current, commission: event.target.value }))} /></label>
                        <label>Payment fee<input type="number" min="0" step="0.01" value={earningForm.paymentFee} onChange={(event) => setEarningForm((current) => ({ ...current, paymentFee: event.target.value }))} /></label>
                        <label>Shipping deduction<input type="number" min="0" step="0.01" value={earningForm.shipping} onChange={(event) => setEarningForm((current) => ({ ...current, shipping: event.target.value }))} /></label>
                        <label>Other deduction<input type="number" min="0" step="0.01" value={earningForm.otherDeduction} onChange={(event) => setEarningForm((current) => ({ ...current, otherDeduction: event.target.value }))} /></label>
                        <label>Activity date<input type="date" value={earningForm.activityDate} onChange={(event) => setEarningForm((current) => ({ ...current, activityDate: event.target.value }))} /></label>
                        <label>Service / order status<select value={earningForm.activityStatus} onChange={(event) => setEarningForm((current) => ({ ...current, activityStatus: event.target.value as ProfessionalActivityStatus }))}>{professionalActivityStatuses.map((status) => <option value={status} key={status}>{labelProfessionalActivityStatus(status)}</option>)}</select></label>
                        <label>Payout status<select value={earningForm.earningStatus} onChange={(event) => setEarningForm((current) => ({ ...current, earningStatus: event.target.value as ProfessionalEarningStatus }))}>{professionalEarningStatuses.map((status) => <option value={status} key={status}>{labelProfessionalEarningStatus(status)}</option>)}</select></label>
                        {earningForm.earningStatus === "paid" ? <label className="span-two">Payout reference<input value={earningForm.payoutReference} onChange={(event) => setEarningForm((current) => ({ ...current, payoutReference: event.target.value }))} placeholder="Bank transfer or payout reference" /></label> : null}
                        <label className="span-two">Internal finance note<textarea rows={2} value={earningForm.internalNote} onChange={(event) => setEarningForm((current) => ({ ...current, internalNote: event.target.value }))} /></label>
                      </div>
                      <div className="professional-earning-preview">
                        <div><small>Gross</small><strong>{formatNpr(earningGross)}</strong></div>
                        <div><small>Total deductions</small><strong>{formatNpr(earningDeductions)}</strong></div>
                        <div><small>Professional earning</small><strong>{formatNpr(earningNet)}</strong></div>
                      </div>
                      <div className="admin-form-actions">
                        <button className="primary-button" type="button" onClick={() => void saveEarning()} disabled={saving}><Save /> {earningForm.id ? "Update record" : "Record activity"}</button>
                        {earningForm.id ? <button type="button" onClick={() => setEarningForm(emptyEarning(defaultOfferingKind(selectedProfile.role)))}>Cancel edit</button> : null}
                      </div>
                    </section>
                    <div className="professional-admin-record-list professional-admin-earning-list">
                      {profileEarnings.map((earning) => <article key={earning.id}><div><span>{earning.reference_number || earning.earning_number}</span><strong>{earning.title}</strong><small>{professionalDate(earning.activity_date)} · {labelProfessionalActivityStatus(earning.activity_status)}</small></div><div><small>Net earning</small><strong>{formatNpr(Number(earning.net_amount))}</strong></div><em className={`professional-status professional-earning-${earning.earning_status}`}>{labelProfessionalEarningStatus(earning.earning_status)}</em><button type="button" onClick={() => editEarning(earning)}><Pencil /> Edit</button></article>)}
                      {!profileEarnings.length ? <div className="professional-dashboard-empty"><CircleDollarSign /><strong>No earnings recorded</strong><p>Add the first service, product sale or partner service above.</p></div> : null}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
