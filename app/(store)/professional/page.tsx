"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  HandCoins,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  PackageCheck,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { BrandName } from "@/components/brand-name";
import { useMarketplace } from "@/components/marketplace-provider";
import { formatNpr } from "@/data/marketplace";
import {
  labelProfessionalActivityStatus,
  labelProfessionalEarningStatus,
  labelProfessionalOfferingKind,
  labelProfessionalOfferingStatus,
  professionalAccountProfileSelect,
  professionalDate,
  professionalEarningSelect,
  professionalFinanceError,
  professionalOfferingSelect,
  type ProfessionalAccountProfile,
  type ProfessionalEarning,
  type ProfessionalEarningStatus,
  type ProfessionalOffering,
} from "@/lib/professional-finance";
import { labelProfessionalRole } from "@/lib/professional-network";
import {
  labelProfessionalServiceRequestStatus,
  professionalRequestActions,
  professionalServiceDate,
  professionalServiceError,
  professionalServiceRequestSelect,
  type ProfessionalServiceRequest,
  type ProfessionalServiceRequestStatus,
} from "@/lib/professional-services";
import { createClient } from "@/lib/supabase/client";

type DashboardTab = "requests" | "activity" | "payouts" | "offerings";
type StatusFilter = "all" | ProfessionalEarningStatus;

const earningFilters: StatusFilter[] = [
  "all",
  "pending",
  "available",
  "scheduled",
  "paid",
  "withheld",
  "reversed",
];

function sum(rows: ProfessionalEarning[], key: keyof ProfessionalEarning) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

export default function ProfessionalDashboardPage() {
  const { user, authReady, openLogin } = useMarketplace();
  const [profiles, setProfiles] = useState<ProfessionalAccountProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [offerings, setOfferings] = useState<ProfessionalOffering[]>([]);
  const [earnings, setEarnings] = useState<ProfessionalEarning[]>([]);
  const [requests, setRequests] = useState<ProfessionalServiceRequest[]>([]);
  const [tab, setTab] = useState<DashboardTab>("requests");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState("");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: linkData, error: linkError } = await supabase
        .from("professional_account_links")
        .select("profile_id")
        .eq("user_id", user.id);
      if (linkError) throw linkError;
      const linkedProfileIds = (linkData ?? []).map((item) => String(item.profile_id));
      if (!linkedProfileIds.length) {
        setProfiles([]);
        setOfferings([]);
        setEarnings([]);
        setRequests([]);
        setProfileId("");
        return;
      }
      const { data: profileData, error: profileError } = await supabase
        .from("professional_profiles")
        .select(professionalAccountProfileSelect)
        .in("id", linkedProfileIds)
        .order("created_at", { ascending: true });
      if (profileError) throw profileError;
      const profileRows = ((profileData ?? []) as unknown as Omit<ProfessionalAccountProfile, "account_linked">[])
        .map((profile) => ({ ...profile, account_linked: true }));
      setProfiles(profileRows);
      const ids = profileRows.map((profile) => profile.id);
      setProfileId((current) => (current && ids.includes(current) ? current : ids[0] ?? ""));
      if (!ids.length) {
        setOfferings([]);
        setEarnings([]);
        setRequests([]);
        return;
      }
      const [
        { data: offeringData, error: offeringError },
        { data: earningData, error: earningError },
        { data: requestData, error: requestError },
      ] =
        await Promise.all([
          supabase
            .from("professional_offerings")
            .select(professionalOfferingSelect)
            .in("profile_id", ids)
            .order("created_at", { ascending: false }),
          supabase
            .from("professional_earnings")
            .select(professionalEarningSelect)
            .in("profile_id", ids)
            .order("activity_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("professional_service_requests")
            .select(professionalServiceRequestSelect)
            .in("profile_id", ids)
            .order("created_at", { ascending: false }),
        ]);
      if (offeringError || earningError || requestError) {
        throw offeringError ?? earningError ?? requestError;
      }
      setOfferings((offeringData ?? []) as unknown as ProfessionalOffering[]);
      setEarnings((earningData ?? []) as unknown as ProfessionalEarning[]);
      setRequests((requestData ?? []) as unknown as ProfessionalServiceRequest[]);
    } catch (caught) {
      const serviceMessage = professionalServiceError(caught);
      setError(
        serviceMessage.startsWith("Run the Professional Services")
          ? serviceMessage
          : professionalFinanceError(caught),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void loadDashboard());
  }, [loadDashboard]);

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0] ?? null;
  const profileOfferings = useMemo(
    () => offerings.filter((item) => item.profile_id === profile?.id),
    [offerings, profile?.id],
  );
  const profileEarnings = useMemo(
    () => earnings.filter((item) => item.profile_id === profile?.id),
    [earnings, profile?.id],
  );
  const profileRequests = useMemo(
    () => requests.filter((item) => item.profile_id === profile?.id),
    [profile?.id, requests],
  );
  const filteredEarnings = useMemo(
    () =>
      profileEarnings.filter(
        (item) => statusFilter === "all" || item.earning_status === statusFilter,
      ),
    [profileEarnings, statusFilter],
  );
  const paidRows = useMemo(
    () => profileEarnings.filter((item) => item.earning_status === "paid"),
    [profileEarnings],
  );

  const metrics = useMemo(() => {
    const counted = profileEarnings.filter(
      (item) => !["cancelled", "refunded"].includes(item.activity_status),
    );
    const pendingRows = profileEarnings.filter((item) =>
      ["pending", "available", "scheduled", "withheld"].includes(item.earning_status),
    );
    return {
      gross: sum(counted, "gross_amount"),
      net: sum(counted, "net_amount"),
      received: sum(paidRows, "net_amount"),
      pending: sum(pendingRows, "net_amount"),
      commission: sum(counted, "platform_commission"),
      deductions:
        sum(counted, "discount_amount") +
        sum(counted, "payment_fee") +
        sum(counted, "shipping_deduction") +
        sum(counted, "other_deduction"),
      completed: profileEarnings.filter((item) => item.activity_status === "completed").length,
    };
  }, [paidRows, profileEarnings]);

  const updateRequest = async (
    request: ProfessionalServiceRequest,
    status: ProfessionalServiceRequestStatus,
  ) => {
    const needsNote = ["reschedule_requested", "declined", "cancelled"].includes(status);
    const note = needsNote
      ? window.prompt(
          status === "reschedule_requested"
            ? "Describe the schedule change you need. The customer will see this note."
            : "Add a short note for the customer.",
          request.professional_note ?? "",
        )
      : request.professional_note;
    if (needsNote && note === null) return;

    setUpdatingRequestId(request.id);
    setError("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc(
        "update_professional_service_request",
        {
          p_request_id: request.id,
          p_status: status,
          p_note: note?.trim() || null,
        },
      );
      if (updateError) throw updateError;
      await loadDashboard();
    } catch (caught) {
      setError(professionalServiceError(caught));
    } finally {
      setUpdatingRequestId("");
    }
  };

  if (!authReady) {
    return (
      <main className="professional-dashboard-page">
        <div className="site-container professional-dashboard-state">
          <LoaderCircle className="admin-spinner" />
          Loading Professional Account…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="professional-dashboard-page">
        <div className="site-container professional-dashboard-state">
          <UserRound />
          <h1>Log in to your Professional Account.</h1>
          <p>
            Advisors, Expert Professionals and Associate Partners use this separate dashboard to
            track services, sales, earnings and payouts.
          </p>
          <button className="primary-button" type="button" onClick={openLogin}>
            Login to dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!loading && !error && !profiles.length) {
    return (
      <main className="professional-dashboard-page">
        <div className="site-container professional-dashboard-state">
          <BriefcaseBusiness />
          <h1>No Professional Account is linked yet.</h1>
          <p>
            Your approved Advisor, Expert or Associate Partner profile must be linked to this
            email address by the khetE team.
          </p>
          <div>
            <Link className="primary-button" href="/experts/apply">
              View my application
            </Link>
            <Link className="secondary-button" href="/support?type=partner_application">
              Contact support
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="professional-dashboard-page">
      <section className="professional-dashboard-hero">
        <div className="site-container">
          <div
            className={`professional-dashboard-avatar${profile?.role === "associate_partner" ? " brand-image" : ""}`}
            style={
              profile?.profile_image_url
                ? { backgroundImage: `url("${profile.profile_image_url}")` }
                : undefined
            }
            aria-hidden="true"
          >
            {!profile?.profile_image_url ? <BriefcaseBusiness /> : null}
          </div>
          <div className="professional-dashboard-identity">
            <p className="eyebrow">Professional Account</p>
            <h1>{profile?.name ?? "Professional dashboard"}</h1>
            <p>
              {profile ? labelProfessionalRole(profile.role) : "Professional"} ·{" "}
              {profile?.position_title}
            </p>
            <span>
              <BadgeCheck /> Verified khetE profile
            </span>
          </div>
          <div className="professional-dashboard-actions">
            {profiles.length > 1 ? (
              <label>
                Dashboard
                <select value={profile?.id ?? ""} onChange={(event) => setProfileId(event.target.value)}>
                  {profiles.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {labelProfessionalRole(item.role)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" onClick={() => void loadDashboard()} disabled={loading}>
              <RefreshCw className={loading ? "admin-spinner" : ""} /> Refresh
            </button>
            {profile ? (
              <Link href={`/experts/${profile.slug}`}>
                <UserRound /> Public profile
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="site-container professional-dashboard-content">
        {error ? <div className="professional-dashboard-error">{error}</div> : null}
        <section className="professional-metric-grid" aria-label="Professional account summary">
          <article className="professional-metric-primary">
            <span><Banknote /></span>
            <div>
              <small>Amount received</small>
              <strong>{formatNpr(metrics.received)}</strong>
              <p>Verified payouts marked Paid by khetE Finance.</p>
            </div>
          </article>
          <article>
            <span><Clock3 /></span>
            <div>
              <small>Pending earnings</small>
              <strong>{formatNpr(metrics.pending)}</strong>
              <p>Pending, available, scheduled or held.</p>
            </div>
          </article>
          <article>
            <span><PackageCheck /></span>
            <div>
              <small>{profile?.role === "associate_partner" ? "Completed sales/services" : "Completed services"}</small>
              <strong>{metrics.completed}</strong>
              <p>{profileEarnings.length} total recorded activit{profileEarnings.length === 1 ? "y" : "ies"}.</p>
            </div>
          </article>
          <article>
            <span><HandCoins /></span>
            <div>
              <small>Net earnings</small>
              <strong>{formatNpr(metrics.net)}</strong>
              <p>After discounts, commission and deductions.</p>
            </div>
          </article>
        </section>

        <section className="professional-finance-strip" aria-label="Earning breakdown">
          <div><span>Gross value</span><strong>{formatNpr(metrics.gross)}</strong></div>
          <div><span>khetE commission</span><strong>{formatNpr(metrics.commission)}</strong></div>
          <div><span>Other deductions</span><strong>{formatNpr(metrics.deductions)}</strong></div>
          <div><span>Active offerings</span><strong>{profileOfferings.filter((item) => item.status === "active").length}</strong></div>
        </section>

        <div className="professional-dashboard-tabs" role="tablist" aria-label="Dashboard sections">
          <button className={tab === "requests" ? "active" : ""} type="button" onClick={() => setTab("requests")}>
            <CalendarClock /> Service requests
            {profileRequests.filter((request) => ["submitted", "reschedule_requested"].includes(request.status)).length ? (
              <span className="professional-tab-count">
                {profileRequests.filter((request) => ["submitted", "reschedule_requested"].includes(request.status)).length}
              </span>
            ) : null}
          </button>
          <button className={tab === "activity" ? "active" : ""} type="button" onClick={() => setTab("activity")}>
            <BriefcaseBusiness /> Activity & earnings
          </button>
          <button className={tab === "payouts" ? "active" : ""} type="button" onClick={() => setTab("payouts")}>
            <CircleDollarSign /> Payments received
          </button>
          <button className={tab === "offerings" ? "active" : ""} type="button" onClick={() => setTab("offerings")}>
            <FileText /> Products & services
          </button>
        </div>

        {tab === "requests" ? (
          <section className="professional-dashboard-panel">
            <header>
              <div>
                <p className="eyebrow">Professional workspace</p>
                <h2>Customer service requests</h2>
              </div>
              <span>
                {profileRequests.length} request{profileRequests.length === 1 ? "" : "s"}
              </span>
            </header>
            <div className="professional-request-list">
              {!profileRequests.length ? (
                <div className="professional-dashboard-empty">
                  <CalendarClock />
                  <strong>No customer requests yet</strong>
                  <p>New requests for your active services will appear here.</p>
                </div>
              ) : (
                profileRequests.map((request) => {
                  const actions = professionalRequestActions(request.status);
                  return (
                    <article key={request.id}>
                      <header>
                        <div>
                          <span>{request.request_number}</span>
                          <h3>{request.professional_offerings.title}</h3>
                          <p>
                            Requested {professionalServiceDate(request.submitted_at)} ·{" "}
                            {request.customer_name}
                          </p>
                        </div>
                        <em className={`professional-request-status request-${request.status}`}>
                          {labelProfessionalServiceRequestStatus(request.status)}
                        </em>
                      </header>
                      <div className="professional-request-detail-grid">
                        <span>
                          <CalendarClock />
                          <small>Requested schedule</small>
                          <strong>
                            {professionalServiceDate(request.preferred_date)} ·{" "}
                            {request.preferred_time_slot}
                          </strong>
                        </span>
                        <span>
                          <MapPin />
                          <small>Service location</small>
                          <strong>{request.service_location}</strong>
                        </span>
                        <span>
                          <UserRound />
                          <small>Customer contact</small>
                          <strong>{request.customer_phone}</strong>
                          <a href={`mailto:${request.customer_email}`}>{request.customer_email}</a>
                        </span>
                        <span>
                          <CircleDollarSign />
                          <small>Service value</small>
                          <strong>{formatNpr(Number(request.total_amount))}</strong>
                          <small>
                            {Number(request.quantity)} × {formatNpr(Number(request.unit_price))}
                          </small>
                        </span>
                      </div>
                      {request.customer_note || request.professional_note ? (
                        <div className="professional-request-notes">
                          {request.customer_note ? (
                            <p>
                              <MessageSquareText />
                              <span>
                                <strong>Customer request</strong>
                                {request.customer_note}
                              </span>
                            </p>
                          ) : null}
                          {request.professional_note ? (
                            <p>
                              <MessageSquareText />
                              <span>
                                <strong>Your note</strong>
                                {request.professional_note}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {actions.length ? (
                        <footer className="professional-request-actions">
                          {actions.map((action) => {
                            const labels: Record<ProfessionalServiceRequestStatus, string> = {
                              submitted: "Submit",
                              accepted: "Accept request",
                              reschedule_requested: "Request schedule change",
                              in_progress: "Start service",
                              completed: "Mark completed",
                              declined: "Decline",
                              cancelled: "Cancel",
                            };
                            const Icon =
                              action === "completed" || action === "accepted"
                                ? CheckCircle2
                                : action === "in_progress"
                                  ? PlayCircle
                                  : action === "declined" || action === "cancelled"
                                    ? XCircle
                                    : CalendarClock;
                            return (
                              <button
                                className={
                                  action === "accepted" || action === "completed"
                                    ? "primary-action"
                                    : action === "declined" || action === "cancelled"
                                      ? "danger-action"
                                      : ""
                                }
                                type="button"
                                onClick={() => void updateRequest(request, action)}
                                disabled={updatingRequestId === request.id}
                                key={action}
                              >
                                {updatingRequestId === request.id ? (
                                  <LoaderCircle className="admin-spinner" />
                                ) : (
                                  <Icon />
                                )}
                                {labels[action]}
                              </button>
                            );
                          })}
                        </footer>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}

        {tab === "activity" ? (
          <section className="professional-dashboard-panel">
            <header>
              <div>
                <p className="eyebrow">Earning ledger</p>
                <h2>Services and sales</h2>
              </div>
              <label>
                Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  {earningFilters.map((status) => (
                    <option value={status} key={status}>
                      {status === "all" ? "All payout states" : labelProfessionalEarningStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
            </header>
            <div className="professional-activity-list">
              {!filteredEarnings.length ? (
                <div className="professional-dashboard-empty">
                  <CalendarDays />
                  <strong>No activity in this view</strong>
                  <p>Verified service and partner-sale activity will appear here.</p>
                </div>
              ) : (
                filteredEarnings.map((earning) => (
                  <article key={earning.id}>
                    <div className="professional-activity-title">
                      <span>{labelProfessionalOfferingKind(earning.activity_kind)}</span>
                      <strong>{earning.title}</strong>
                      <small>
                        {earning.reference_number || earning.earning_number} · {professionalDate(earning.activity_date)}
                      </small>
                    </div>
                    <div>
                      <span>Gross</span>
                      <strong>{formatNpr(Number(earning.gross_amount))}</strong>
                    </div>
                    <div>
                      <span>Deductions</span>
                      <strong>
                        {formatNpr(
                          Number(earning.discount_amount) +
                            Number(earning.platform_commission) +
                            Number(earning.payment_fee) +
                            Number(earning.shipping_deduction) +
                            Number(earning.other_deduction),
                        )}
                      </strong>
                    </div>
                    <div className="professional-activity-net">
                      <span>Net earning</span>
                      <strong>{formatNpr(Number(earning.net_amount))}</strong>
                    </div>
                    <footer>
                      <span className={`professional-status professional-activity-${earning.activity_status}`}>
                        {labelProfessionalActivityStatus(earning.activity_status)}
                      </span>
                      <span className={`professional-status professional-earning-${earning.earning_status}`}>
                        {labelProfessionalEarningStatus(earning.earning_status)}
                      </span>
                    </footer>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {tab === "payouts" ? (
          <section className="professional-dashboard-panel">
            <header>
              <div>
                <p className="eyebrow">Payment history</p>
                <h2>Amounts received</h2>
              </div>
              <strong className="professional-panel-total">{formatNpr(metrics.received)}</strong>
            </header>
            <div className="professional-payout-list">
              {!paidRows.length ? (
                <div className="professional-dashboard-empty">
                  <CircleDollarSign />
                  <strong>No paid payouts yet</strong>
                  <p>Completed payouts and their references will appear here.</p>
                </div>
              ) : (
                paidRows.map((earning) => (
                  <article key={earning.id}>
                    <span><ShieldCheck /></span>
                    <div>
                      <strong>{earning.payout_reference}</strong>
                      <small>{earning.title} · {earning.earning_number}</small>
                    </div>
                    <div>
                      <strong>{formatNpr(Number(earning.net_amount))}</strong>
                      <small>Paid {professionalDate(earning.paid_at)}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {tab === "offerings" ? (
          <section className="professional-dashboard-panel">
            <header>
              <div>
                <p className="eyebrow">Your catalogue</p>
                <h2>{profile?.role === "associate_partner" ? "Partner products and services" : "Professional services"}</h2>
              </div>
              <span>{profileOfferings.length} offering{profileOfferings.length === 1 ? "" : "s"}</span>
            </header>
            <div className="professional-offering-grid">
              {!profileOfferings.length ? (
                <div className="professional-dashboard-empty">
                  <FileText />
                  <strong>No offering has been added yet</strong>
                  <p>Contact the khetE team to add your approved services or partner products.</p>
                </div>
              ) : (
                profileOfferings.map((offering) => (
                  <article key={offering.id}>
                    <span>{labelProfessionalOfferingKind(offering.kind)}</span>
                    <h3>{offering.title}</h3>
                    <p>{offering.description || "No public description has been added."}</p>
                    <footer>
                      <strong>{formatNpr(Number(offering.price))} <small>/ {offering.unit_label}</small></strong>
                      <em className={`professional-status professional-offering-${offering.status}`}>
                        {labelProfessionalOfferingStatus(offering.status)}
                      </em>
                    </footer>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        <aside className="professional-dashboard-note">
          <ShieldCheck />
          <div>
            <strong>Verified financial records</strong>
            <p>
              Payment gateway collection is not active yet. Until it is connected, these figures
              reflect entries reviewed by <BrandName /> Finance. Use Support if any service, sale
              or payout needs correction.
            </p>
          </div>
          <Link href="/support?type=payment_issue">Contact support</Link>
        </aside>
      </div>
    </main>
  );
}
