"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  MessagesSquare,
  Sprout,
  UsersRound,
  X,
} from "lucide-react";
import { useMarketplace } from "@/components/marketplace-provider";
import { supportError } from "@/lib/support";
import { createClient } from "@/lib/supabase/client";

const farmTypes = ["Paddy (rice)", "Wheat", "Mustard", "Maize", "Vegetables", "Fruits / orchard", "Livestock / dairy", "Mixed farming", "Other"];
const helpTopics = [
  "Not sure — please guide me",
  "Crop problem (pests, disease, poor growth)",
  "Soil, fertilizer & nutrition planning",
  "Machinery, irrigation or repair",
  "Season planning from sowing to harvest",
  "Livestock & animal health",
  "Orchard & horticulture advice",
  "Something else",
];

type GuidanceForm = {
  name: string;
  email: string;
  phone: string;
  location: string;
  farmType: string;
  helpTopic: string;
  timing: string;
  description: string;
};

function emptyForm(): GuidanceForm {
  return {
    name: "",
    email: "",
    phone: "",
    location: "",
    farmType: farmTypes[0],
    helpTopic: helpTopics[0],
    timing: "",
    description: "",
  };
}

export function ServiceGuidanceCallout() {
  const { user, openLogin } = useMarketplace();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GuidanceForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  useEffect(() => {
    if (!user) return;
    const fullName =
      typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    queueMicrotask(() =>
      setForm((current) => ({
        ...current,
        name: current.name || fullName,
        email: current.email || user.email || "",
      })),
    );
  }, [user]);

  const close = () => {
    setOpen(false);
    setError("");
    setTicketNumber("");
    setForm((current) => emptyForm());
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const message = [
        `Farm / crop type: ${form.farmType}`,
        `Help needed: ${form.helpTopic}`,
        `Location: ${form.location}`,
        form.timing ? `Preferred timing: ${form.timing}` : "",
        "",
        "What I need help with:",
        form.description,
        "",
        "(Submitted from the Services & Rentals page — please suggest which advisor, expert or partner would suit this requirement.)",
      ]
        .filter((line, index) => line !== "" || index < 5)
        .join("\n");
      const supabase = createClient();
      const { data, error: submitError } = await supabase.rpc("create_support_ticket", {
        p_type: "custom_request",
        p_name: form.name.trim(),
        p_email: form.email.trim(),
        p_phone: form.phone.trim() || null,
        p_subject: "Which professional fits my requirement?",
        p_message: message,
        p_order_number: null,
      });
      if (submitError) throw submitError;
      const result = Array.isArray(data) ? data[0] : data;
      const number = result && typeof result === "object" && "ticket_number" in result ? String(result.ticket_number) : "";
      setTicketNumber(number || "submitted");
    } catch (caught) {
      setError(supportError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="service-guidance-card">
        <span className="service-guidance-card-icon"><UsersRound /></span>
        <div className="service-guidance-card-text">
          <strong>Not sure which professional fits your need?</strong>
          <p>
            Describe your farm and requirement — the khetE support team will review it and
            suggest the right advisor, expert or partner for you.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setOpen(true)}>
          Describe your requirement <ArrowRight />
        </button>
      </div>

      {open ? (
        <div className="modal-backdrop professional-service-modal" role="presentation" onMouseDown={close}>
          <div
            className="professional-service-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-guidance-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={close} aria-label="Close">
              <X />
            </button>
            {ticketNumber ? (
              <div className="professional-request-success">
                <CheckCircle2 />
                <p className="eyebrow">Request received</p>
                <h2 id="service-guidance-dialog-title">The support team will guide you.</h2>
                <p>
                  Reference <strong>{ticketNumber}</strong>. Our team reviews requirement requests
                  like yours and replies with the advisor, expert or partner who fits best — you can
                  follow the conversation in Support.
                </p>
                <div>
                  <Link className="primary-button" href="/support">
                    Open Support <MessagesSquare />
                  </Link>
                  <button className="secondary-button" type="button" onClick={close}>
                    Continue browsing
                  </button>
                </div>
              </div>
            ) : (
              <>
                <header className="professional-service-dialog-heading">
                  <p className="eyebrow">Request professional suggestions</p>
                  <h2 id="service-guidance-dialog-title">Tell us what your farm needs</h2>
                  <p>
                    <Sprout /> No need to know the exact service — describe the situation and the
                    khetE team will match you with the right professional.
                  </p>
                </header>
                <form onSubmit={submit}>
                  {error ? <div className="professional-service-form-error">{error}</div> : null}
                  <div className="form-grid">
                    <label>
                      Full name
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        required
                        type="email"
                        maxLength={180}
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        minLength={7}
                        maxLength={40}
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label>
                      Farm / crop type
                      <select
                        value={form.farmType}
                        onChange={(event) => setForm((current) => ({ ...current, farmType: event.target.value }))}
                      >
                        {farmTypes.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      What do you need help with?
                      <select
                        value={form.helpTopic}
                        onChange={(event) => setForm((current) => ({ ...current, helpTopic: event.target.value }))}
                      >
                        {helpTopics.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      Preferred timing (optional)
                      <input
                        maxLength={80}
                        placeholder="e.g. Within a week, before sowing…"
                        value={form.timing}
                        onChange={(event) => setForm((current) => ({ ...current, timing: event.target.value }))}
                      />
                    </label>
                    <label className="span-two">
                      Farm location
                      <input
                        required
                        minLength={2}
                        maxLength={140}
                        placeholder="Municipality, district"
                        value={form.location}
                        onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                      />
                    </label>
                    <label className="span-two">
                      Describe your requirement
                      <textarea
                        required
                        rows={4}
                        minLength={20}
                        maxLength={2000}
                        placeholder="For example: My paddy plot is yellowing in patches after transplanting and I am not sure if it is pests or fertilizer…"
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </label>
                  </div>
                  <button className="primary-button professional-request-submit" type="submit" disabled={submitting}>
                    {submitting ? <LoaderCircle className="admin-spinner" /> : <MapPin />}
                    Request professional suggestions
                  </button>
                  {!user ? (
                    <button className="service-guidance-login" type="button" onClick={openLogin}>
                      Sign in to track this request in your account
                    </button>
                  ) : null}
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
