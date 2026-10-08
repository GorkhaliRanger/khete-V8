"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace-provider";
import { formatNpr } from "@/data/marketplace";
import {
  labelProfessionalServiceRequestStatus,
  professionalServiceDate,
  professionalServiceError,
  professionalServiceRequestSelect,
  professionalServiceRequestStatuses,
  type ProfessionalServiceRequest,
  type ProfessionalServiceRequestStatus,
} from "@/lib/professional-services";
import { createClient } from "@/lib/supabase/client";

type RequestFilter = "all" | ProfessionalServiceRequestStatus;

export function CustomerServiceRequests() {
  const { user, authReady, openLogin } = useMarketplace();
  const [requests, setRequests] = useState<ProfessionalServiceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestFilter>("all");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("professional_service_requests")
        .select(professionalServiceRequestSelect)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (loadError) throw loadError;
      setRequests((data ?? []) as unknown as ProfessionalServiceRequest[]);
    } catch (caught) {
      setError(professionalServiceError(caught));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => void loadRequests());
  }, [loadRequests]);

  const visibleRequests = useMemo(
    () =>
      requests.filter(
        (request) => statusFilter === "all" || request.status === statusFilter,
      ),
    [requests, statusFilter],
  );

  const cancelRequest = async (request: ProfessionalServiceRequest) => {
    const reason = window.prompt(
      "Why do you want to cancel this service request? This note will be shared with the professional.",
      "",
    );
    if (reason === null) return;
    setUpdatingId(request.id);
    setError("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc(
        "update_professional_service_request",
        {
          p_request_id: request.id,
          p_status: "cancelled",
          p_note: reason.trim() || null,
        },
      );
      if (updateError) throw updateError;
      await loadRequests();
    } catch (caught) {
      setError(professionalServiceError(caught));
    } finally {
      setUpdatingId("");
    }
  };

  if (!authReady) {
    return (
      <main className="service-requests-page">
        <div className="site-container service-request-state">
          <LoaderCircle className="admin-spinner" /> Loading service requests…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="service-requests-page">
        <div className="site-container service-request-state">
          <UserRound />
          <h1>Log in to view your service requests.</h1>
          <p>Your professional bookings, schedule, provider notes and current status stay private.</p>
          <button className="primary-button" type="button" onClick={openLogin}>
            Login or register
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="service-requests-page">
      <div className="site-container">
        <Link className="back-link" href="/account">
          <ArrowLeft /> Back to Customer Account
        </Link>
        <section className="service-request-hero">
          <div>
            <p className="eyebrow">Customer account</p>
            <h1>My service requests</h1>
            <p>Track requests made to verified Advisors, Experts and Associate Partners.</p>
          </div>
          <div>
            <span>
              <CalendarClock />
              <strong>{requests.length}</strong>
              <small>Total requests</small>
            </span>
            <button type="button" onClick={() => void loadRequests()} disabled={loading}>
              <RefreshCw className={loading ? "admin-spinner" : ""} /> Refresh
            </button>
          </div>
        </section>

        <section className="service-request-workspace">
          <header>
            <div>
              <p className="eyebrow">Request history</p>
              <h2>Services and schedules</h2>
            </div>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as RequestFilter)}
              >
                <option value="all">All requests</option>
                {professionalServiceRequestStatuses.map((status) => (
                  <option value={status} key={status}>
                    {labelProfessionalServiceRequestStatus(status)}
                  </option>
                ))}
              </select>
            </label>
          </header>

          {error ? <div className="professional-service-form-error">{error}</div> : null}
          {loading && !requests.length ? (
            <div className="professional-service-empty">
              <LoaderCircle className="admin-spinner" />
              <strong>Loading your requests…</strong>
            </div>
          ) : null}
          {!loading && !error && !visibleRequests.length ? (
            <div className="professional-service-empty">
              <CalendarClock />
              <strong>No service requests in this view</strong>
              <p>Browse verified professional services and submit your first request.</p>
              <Link className="primary-button" href="/services#professional-services">
                Explore professional services
              </Link>
            </div>
          ) : null}

          <div className="customer-service-request-list">
            {visibleRequests.map((request) => {
              const canCancel = ["submitted", "accepted", "reschedule_requested"].includes(
                request.status,
              );
              return (
                <article key={request.id}>
                  <header>
                    <div>
                      <span>{request.request_number}</span>
                      <h3>{request.professional_offerings.title}</h3>
                      <p>
                        <Link href={`/experts/${request.professional_profiles.slug}`}>
                          {request.professional_profiles.name}
                        </Link>
                        {" · "}
                        Submitted {professionalServiceDate(request.submitted_at)}
                      </p>
                    </div>
                    <em className={`professional-request-status request-${request.status}`}>
                      {labelProfessionalServiceRequestStatus(request.status)}
                    </em>
                  </header>
                  <div className="customer-service-request-details">
                    <span>
                      <CalendarClock />
                      <small>Preferred schedule</small>
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
                      <CircleDollarSign />
                      <small>Estimated amount</small>
                      <strong>
                        {formatNpr(Number(request.total_amount))} · {Number(request.quantity)}{" "}
                        {request.professional_offerings.unit_label}
                      </strong>
                    </span>
                    <span>
                      <Clock3 />
                      <small>Online payment</small>
                      <strong>Not collected yet</strong>
                    </span>
                  </div>
                  {request.customer_note || request.professional_note ? (
                    <div className="customer-service-request-notes">
                      {request.customer_note ? (
                        <p>
                          <MessageSquareText /> <span><strong>Your note</strong>{request.customer_note}</span>
                        </p>
                      ) : null}
                      {request.professional_note ? (
                        <p>
                          <MessageSquareText /> <span><strong>Professional note</strong>{request.professional_note}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <footer>
                    <span>
                      The professional will confirm the request before the service begins.
                    </span>
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => void cancelRequest(request)}
                        disabled={updatingId === request.id}
                      >
                        {updatingId === request.id ? (
                          <LoaderCircle className="admin-spinner" />
                        ) : (
                          <XCircle />
                        )}
                        Cancel request
                      </button>
                    ) : null}
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
