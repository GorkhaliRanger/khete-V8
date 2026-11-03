"use client";
/* eslint-disable @next/next/no-img-element -- Admin previews show the selected local file before it is uploaded. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  FileCheck2,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { AdminAccessCard, type AdminAccessState } from "@/components/admin-access-card";
import { AdminSidebar } from "@/components/admin-sidebar";
import { safeStorageName, validateStandardImage } from "@/lib/image-processing";
import {
  labelProfessionalApplicationStatus,
  labelProfessionalProfileStatus,
  labelProfessionalRole,
  professionalApplicationSelect,
  professionalApplicationStatuses,
  professionalError,
  professionalProfileSelect,
  professionalProfileStatuses,
  professionalRoles,
  professionalTones,
  splitProfessionalList,
  type ProfessionalApplication,
  type ProfessionalApplicationStatus,
  type ProfessionalProfile,
  type ProfessionalProfileStatus,
  type ProfessionalRole,
  type ProfessionalTone,
} from "@/lib/professional-network";
import { createClient } from "@/lib/supabase/client";

type WorkspaceTab = "applications" | "profiles";
type ProfileForm = {
  id: string;
  slug: string;
  role: ProfessionalRole;
  name: string;
  position: string;
  organization: string;
  location: string;
  experience: string;
  expertise: string;
  summary: string;
  biography: string;
  achievements: string;
  qualifications: string;
  website: string;
  image: string;
  tone: ProfessionalTone;
  status: ProfessionalProfileStatus;
  featured: boolean;
  sortOrder: string;
};

const networkRoles = new Set(["super_admin", "content_promotion_manager", "customer_support"]);
const emptyProfile: ProfileForm = {
  id: "",
  slug: "",
  role: "advisor",
  name: "",
  position: "",
  organization: "",
  location: "",
  experience: "",
  expertise: "",
  summary: "",
  biography: "",
  achievements: "",
  qualifications: "",
  website: "",
  image: "",
  tone: "forest",
  status: "draft",
  featured: false,
  sortOrder: "0",
};

function profileToForm(profile: ProfessionalProfile): ProfileForm {
  return {
    id: profile.id,
    slug: profile.slug,
    role: profile.role,
    name: profile.name,
    position: profile.position_title,
    organization: profile.organization_name ?? "",
    location: profile.location,
    experience: profile.experience,
    expertise: profile.expertise.join("\n"),
    summary: profile.summary,
    biography: profile.biography.join("\n"),
    achievements: profile.achievements.join("\n"),
    qualifications: profile.qualifications.join("\n"),
    website: profile.website_url ?? "",
    image: profile.profile_image_url ?? "",
    tone: profile.tone,
    status: profile.status,
    featured: profile.featured,
    sortOrder: String(profile.sort_order),
  };
}

function makeSlug(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "network-profile"}-${crypto.randomUUID().slice(0, 8)}`;
}

export default function AdminNetworkPage() {
  const [access, setAccess] = useState<AdminAccessState>("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("applications");
  const [applications, setApplications] = useState<ProfessionalApplication[]>([]);
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [applicationQuery, setApplicationQuery] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<"all" | ProfessionalApplicationStatus>("all");
  const [profileQuery, setProfileQuery] = useState("");
  const [profileStatus, setProfileStatus] = useState<"all" | ProfessionalProfileStatus>("all");
  const [reviewNotes, setReviewNotes] = useState("");
  const [applicationDocuments, setApplicationDocuments] = useState<{ id: string; file_name: string; mime_type: string; size_bytes: number; url: string }[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const [{ data: applicationData, error: applicationError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase.from("professional_applications").select(professionalApplicationSelect).order("created_at", { ascending: false }).limit(400),
        supabase.from("professional_profiles").select(professionalProfileSelect).order("featured", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(400),
      ]);
      if (applicationError || profileError) throw applicationError ?? profileError;
      const applicationRows = (applicationData ?? []) as unknown as ProfessionalApplication[];
      const profileRows = (profileData ?? []) as unknown as ProfessionalProfile[];
      setApplications(applicationRows);
      setProfiles(profileRows);
      setSelectedApplicationId((current) => current && applicationRows.some((item) => item.id === current) ? current : applicationRows[0]?.id ?? "");
      setSelectedProfileId((current) => current === "new" || (current && profileRows.some((item) => item.id === current)) ? current : profileRows[0]?.id ?? "");
    } catch (caught) {
      setError(professionalError(caught));
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
        const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) throw roleError;
        const names = (roles ?? []).map((item) => item.role);
        if (mounted) setDetectedRoles(names);
        if (!names.some((role) => networkRoles.has(role))) {
          if (mounted) setAccess("denied");
          return;
        }
        if (!mounted) return;
        setAccess("allowed");
        await loadWorkspace();
      } catch (caught) {
        if (!mounted) return;
        setError(professionalError(caught));
        setAccess("error");
      }
    };
    void checkAccess();
    return () => { mounted = false; };
  }, [loadWorkspace]);

  const selectedApplication = applications.find((item) => item.id === selectedApplicationId) ?? null;
  const selectedProfile = profiles.find((item) => item.id === selectedProfileId) ?? null;

  useEffect(() => {
    queueMicrotask(() => setReviewNotes(selectedApplication?.admin_notes ?? ""));
  }, [selectedApplication]);

  useEffect(() => {
    let mounted = true;
    const loadDocuments = async () => {
      if (!selectedApplicationId) {
        setApplicationDocuments([]);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from("professional_application_documents")
          .select("id,file_name,mime_type,size_bytes,storage_path")
          .eq("application_id", selectedApplicationId)
          .order("created_at", { ascending: true });
        if (loadError) throw loadError;
        const rows = (data ?? []) as { id: string; file_name: string; mime_type: string; size_bytes: number; storage_path: string }[];
        const withUrls = await Promise.all(rows.map(async (row) => {
          const { data: signed } = await supabase.storage
            .from("application-documents")
            .createSignedUrl(row.storage_path, 600);
          return { id: row.id, file_name: row.file_name, mime_type: row.mime_type, size_bytes: row.size_bytes, url: signed?.signedUrl ?? "" };
        }));
        if (mounted) setApplicationDocuments(withUrls);
      } catch {
        if (mounted) setApplicationDocuments([]);
      }
    };
    void loadDocuments();
    return () => {
      mounted = false;
    };
  }, [selectedApplicationId]);

  useEffect(() => {
    queueMicrotask(() => {
      setPendingImage((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
      if (selectedProfileId === "new") setProfileForm(emptyProfile);
      else if (selectedProfile) setProfileForm(profileToForm(selectedProfile));
    });
  }, [selectedProfile, selectedProfileId]);

  const filteredApplications = useMemo(() => {
    const needle = applicationQuery.trim().toLowerCase();
    return applications.filter((application) => {
      if (applicationStatus !== "all" && application.status !== applicationStatus) return false;
      if (!needle) return true;
      return [application.application_number, application.applicant_name, application.organization_name ?? "", application.contact_email, application.position_title, ...application.expertise].some((value) => value.toLowerCase().includes(needle));
    });
  }, [applicationQuery, applicationStatus, applications]);

  const filteredProfiles = useMemo(() => {
    const needle = profileQuery.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (profileStatus !== "all" && profile.status !== profileStatus) return false;
      if (!needle) return true;
      return [profile.name, profile.organization_name ?? "", profile.position_title, profile.location, ...profile.expertise].some((value) => value.toLowerCase().includes(needle));
    });
  }, [profileQuery, profileStatus, profiles]);

  async function reviewApplication(decision: "under_review" | "changes_requested" | "approved" | "rejected", publish = true) {
    if (!selectedApplication) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: reviewError } = await supabase.rpc("review_professional_application", {
        p_application_id: selectedApplication.id,
        p_decision: decision,
        p_notes: reviewNotes || null,
        p_publish: publish,
      });
      if (reviewError) throw reviewError;
      setSuccess(decision === "approved" ? `Application approved and profile ${publish ? "published" : "saved as a draft"}.` : `Application marked ${labelProfessionalApplicationStatus(decision).toLowerCase()}.`);
      await loadWorkspace();
      if (decision === "approved") setTab("profiles");
    } catch (caught) {
      setError(professionalError(caught));
    } finally {
      setSaving(false);
    }
  }

  function updateProfile<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfileForm((current) => ({ ...current, [key]: value }));
  }

  function startNewProfile() {
    setTab("profiles");
    setSelectedProfileId("new");
    setProfileForm(emptyProfile);
    setSuccess("");
    setError("");
  }

  async function chooseProfileImage(file?: File) {
    if (!file) return;
    setError("");
    setSuccess("");
    try {
      const checked = await validateStandardImage(file, {
        width: 1254,
        height: 1254,
        maxBytes: 5 * 1024 * 1024,
        label: profileForm.role === "associate_partner" ? "Brand logo" : "Profile photo",
      });
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage({ file: checked.file, previewUrl: checked.previewUrl });
    } catch (caught) {
      setError(professionalError(caught));
    }
  }

  function removeProfileImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    updateProfile("image", "");
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (profileForm.name.trim().length < 2) throw new Error("Enter the profile or organisation name.");
      if (profileForm.position.trim().length < 2) throw new Error("Enter the professional title or partnership role.");
      if (profileForm.location.trim().length < 2) throw new Error("Enter the profile location.");
      if (profileForm.summary.trim().length < 40) throw new Error("Write a public summary of at least 40 characters.");
      const expertise = splitProfessionalList(profileForm.expertise);
      if (!expertise.length) throw new Error("Add at least one field of expertise.");
      if (profileForm.status === "active" && !profileForm.image.trim() && !pendingImage) {
        throw new Error(profileForm.role === "associate_partner"
          ? "Add a brand logo before publishing this Associate Partner."
          : "Add a profile photo before publishing this professional.");
      }

      const desiredStatus = profileForm.status;
      const status = pendingImage && desiredStatus === "active" ? "draft" : desiredStatus;
      const payload = {
        slug: profileForm.slug.trim() || makeSlug(profileForm.name),
        role: profileForm.role,
        name: profileForm.name.trim(),
        position_title: profileForm.position.trim(),
        organization_name: profileForm.organization.trim() || null,
        location: profileForm.location.trim(),
        experience: profileForm.experience.trim(),
        expertise,
        summary: profileForm.summary.trim(),
        biography: splitProfessionalList(profileForm.biography),
        achievements: splitProfessionalList(profileForm.achievements),
        qualifications: splitProfessionalList(profileForm.qualifications),
        website_url: profileForm.website.trim() || null,
        profile_image_url: profileForm.image.trim() || null,
        tone: profileForm.tone,
        status,
        featured: profileForm.featured,
        sort_order: Number.parseInt(profileForm.sortOrder, 10) || 0,
        published_at: status === "active" ? selectedProfile?.published_at ?? new Date().toISOString() : null,
        updated_by: userId,
      };
      const supabase = createClient();
      let savedProfileId = profileForm.id;
      if (profileForm.id) {
        const { error: updateError } = await supabase.from("professional_profiles").update(payload).eq("id", profileForm.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from("professional_profiles").insert({ ...payload, created_by: userId }).select("id").single();
        if (insertError) throw insertError;
        savedProfileId = String(data.id);
        setProfileForm((current) => ({ ...current, id: savedProfileId }));
      }

      if (pendingImage) {
        const storagePath = `professional-network/${savedProfileId}/${safeStorageName(pendingImage.file)}`;
        const { error: uploadError } = await supabase.storage.from("marketplace-media").upload(storagePath, pendingImage.file, {
          cacheControl: "31536000",
          contentType: pendingImage.file.type,
          upsert: false,
        });
        if (uploadError) {
          throw new Error(`The profile was saved${desiredStatus === "active" ? " as a draft" : ""}, but its image was not uploaded: ${uploadError.message}`);
        }
        const { data: publicImage } = supabase.storage.from("marketplace-media").getPublicUrl(storagePath);
        const { error: imageLinkError } = await supabase
          .from("professional_profiles")
          .update({
            profile_image_url: publicImage.publicUrl,
            status: desiredStatus,
            published_at: desiredStatus === "active" ? selectedProfile?.published_at ?? new Date().toISOString() : null,
            updated_by: userId,
          })
          .eq("id", savedProfileId);
        if (imageLinkError) {
          await supabase.storage.from("marketplace-media").remove([storagePath]);
          throw new Error(`The image was uploaded, but it could not be linked to the profile: ${imageLinkError.message}`);
        }
        URL.revokeObjectURL(pendingImage.previewUrl);
        setPendingImage(null);
      }
      setSuccess(profileForm.id ? "Professional profile updated." : "Professional profile created.");
      setSelectedProfileId(savedProfileId);
      await loadWorkspace();
    } catch (caught) {
      setError(professionalError(caught));
    } finally {
      setSaving(false);
    }
  }

  if (access !== "allowed") return <AdminAccessCard access={access} email={accountEmail} roles={detectedRoles} origin={currentOrigin} resource="the Professional Network" error={error} requirement="the Super Admin, Content & Promotion Manager, or Customer Support role" returnTo="/admin/network" />;

  const pendingCount = applications.filter((item) => ["submitted", "under_review", "changes_requested"].includes(item.status)).length;
  const activeCount = profiles.filter((item) => item.status === "active").length;

  return (
    <main className="admin-shell admin-network-page">
      <AdminSidebar active="network" />
      <section className="admin-main">
        <header className="admin-page-heading"><div><p className="eyebrow">Professional Network</p><h1>Experts, advisors & partners</h1><p>Review applications and control every public professional profile from one workspace.</p></div><div className="admin-create-actions"><button type="button" onClick={() => void loadWorkspace()} disabled={loading}>{loading ? <LoaderCircle className="admin-spinner" /> : <RefreshCw />} Refresh</button><button className="primary-button" type="button" onClick={startNewProfile}><Plus /> New profile</button></div></header>

        <div className="admin-network-stats"><article><FileCheck2 /><span><small>Applications</small><strong>{applications.length}</strong></span></article><article><Clock3 /><span><small>Pending review</small><strong>{pendingCount}</strong></span></article><article><UsersRound /><span><small>All profiles</small><strong>{profiles.length}</strong></span></article><article><BadgeCheck /><span><small>Published</small><strong>{activeCount}</strong></span></article></div>

        {error ? <p className="admin-order-message error">{error}</p> : null}
        {success ? <p className="admin-order-message success"><CheckCircle2 /> {success}</p> : null}

        <div className="admin-network-tabs">
          <button className={tab === "applications" ? "active" : ""} type="button" onClick={() => setTab("applications")}><FileCheck2 /> Applications <span>{pendingCount}</span></button>
          <button className={tab === "profiles" ? "active" : ""} type="button" onClick={() => setTab("profiles")}><UsersRound /> Public profiles <span>{profiles.length}</span></button>
        </div>

        {tab === "applications" ? <div className="admin-network-layout">
          <aside className="admin-network-list-panel">
            <div className="admin-network-filters"><label><Search /><input value={applicationQuery} onChange={(event) => setApplicationQuery(event.target.value)} placeholder="Name, email or reference…" /></label><select value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value as "all" | ProfessionalApplicationStatus)}><option value="all">All statuses</option>{professionalApplicationStatuses.map((status) => <option value={status} key={status}>{labelProfessionalApplicationStatus(status)}</option>)}</select></div>
            <div className="admin-network-list">{!filteredApplications.length ? <div className="admin-list-empty"><FileCheck2 /><strong>No matching applications</strong></div> : filteredApplications.map((application) => <button className={application.id === selectedApplicationId ? "selected" : ""} type="button" onClick={() => setSelectedApplicationId(application.id)} key={application.id}><span><strong>{application.application_number}</strong><small>{application.organization_name || application.applicant_name}</small><em>{labelProfessionalRole(application.role)} · {new Date(application.created_at).toLocaleDateString("en-NP")}</em></span><i className={`network-status network-status-${application.status}`}>{labelProfessionalApplicationStatus(application.status)}</i></button>)}</div>
          </aside>

          {selectedApplication ? <section className="admin-network-detail">
            <header><div><p className="eyebrow">{selectedApplication.application_number}</p><h2>{selectedApplication.organization_name || selectedApplication.applicant_name}</h2><span>{labelProfessionalRole(selectedApplication.role)} · {selectedApplication.position_title}</span></div><i className={`network-status network-status-${selectedApplication.status}`}>{labelProfessionalApplicationStatus(selectedApplication.status)}</i></header>
            <div className="admin-network-info-grid"><article><UserRound /><span><small>Applicant</small><strong>{selectedApplication.applicant_name}</strong><em>{selectedApplication.contact_email}{selectedApplication.contact_phone ? ` · ${selectedApplication.contact_phone}` : ""}</em></span></article><article><Building2 /><span><small>Location & experience</small><strong>{selectedApplication.location}</strong><em>{selectedApplication.experience}</em></span></article></div>
            <section className="admin-network-copy"><h3>Professional summary</h3><p>{selectedApplication.summary}</p><h3>Reason for joining</h3><p>{selectedApplication.motivation}</p><h3>Expertise</h3><div>{selectedApplication.expertise.map((item) => <span key={item}>{item}</span>)}</div>{selectedApplication.qualifications.length ? <><h3>Qualifications</h3><ul>{selectedApplication.qualifications.map((item) => <li key={item}>{item}</li>)}</ul></> : null}{selectedApplication.website_url ? <a href={selectedApplication.website_url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open submitted website</a> : null}</section>
            <section className="admin-network-documents"><h3>Supporting documents</h3>{applicationDocuments.length ? <ul>{applicationDocuments.map((document) => <li key={document.id}><FileCheck2 /><span><strong>{document.file_name}</strong><small>{(document.size_bytes / 1024 / 1024).toFixed(1)} MB · {document.mime_type}</small></span>{document.url ? <a className="secondary-button" href={document.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open</a> : <small>Link unavailable</small>}</li>)}</ul> : <p>No documents were attached to this application.</p>}</section>
            <section className="admin-network-review"><label>Review notes <small>Applicants can see this note in their application history.</small><textarea rows={5} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Add a decision explanation or request specific changes." /></label><div><button type="button" disabled={saving} onClick={() => void reviewApplication("under_review")}><Clock3 /> Under review</button><button type="button" disabled={saving} onClick={() => void reviewApplication("changes_requested")}><MessageCircle /> Request changes</button><button className="danger-button" type="button" disabled={saving} onClick={() => void reviewApplication("rejected")}><XCircle /> Not approved</button><button type="button" disabled={saving} onClick={() => void reviewApplication("approved", false)}><ShieldCheck /> Approve as draft</button><button className="primary-button" type="button" disabled={saving} onClick={() => void reviewApplication("approved", true)}>{saving ? <LoaderCircle className="admin-spinner" /> : <BadgeCheck />} Approve & publish</button></div></section>
          </section> : <section className="admin-network-detail admin-empty-panel"><FileCheck2 /><h2>Select an application</h2></section>}
        </div> : <div className="admin-network-layout">
          <aside className="admin-network-list-panel">
            <div className="admin-network-filters"><label><Search /><input value={profileQuery} onChange={(event) => setProfileQuery(event.target.value)} placeholder="Name, role or expertise…" /></label><select value={profileStatus} onChange={(event) => setProfileStatus(event.target.value as "all" | ProfessionalProfileStatus)}><option value="all">All statuses</option>{professionalProfileStatuses.map((status) => <option value={status} key={status}>{labelProfessionalProfileStatus(status)}</option>)}</select></div>
            <div className="admin-network-list"><button className={selectedProfileId === "new" ? "selected create-row" : "create-row"} type="button" onClick={startNewProfile}><span><strong><Plus /> Create a new profile</strong><small>For an approved professional or partner</small></span></button>{!filteredProfiles.length ? <div className="admin-list-empty"><UsersRound /><strong>No matching profiles</strong></div> : filteredProfiles.map((profile) => <button className={profile.id === selectedProfileId ? "selected" : ""} type="button" onClick={() => setSelectedProfileId(profile.id)} key={profile.id}><span className="admin-network-profile-row">{profile.profile_image_url ? <span className={`admin-network-list-image ${profile.role === "associate_partner" ? "brand-image" : ""}`} style={{ backgroundImage: `url("${profile.profile_image_url}")` }} aria-hidden="true" /> : profile.role === "associate_partner" ? <span className="admin-network-list-image fallback"><Building2 /></span> : <span className="admin-network-list-image fallback"><UserRound /></span>}<span><strong>{profile.name}</strong><small>{profile.position_title}</small><em>{labelProfessionalRole(profile.role)}</em></span></span><i className={`profile-status profile-status-${profile.status}`}>{labelProfessionalProfileStatus(profile.status)}</i></button>)}</div>
          </aside>

          <section className="admin-network-detail admin-network-profile-editor">
            <header><div><p className="eyebrow">{profileForm.id ? "Edit public profile" : "Create public profile"}</p><h2>{profileForm.name || "New professional profile"}</h2><span>Only Active profiles appear on the public website.</span></div>{profileForm.id && profileForm.status === "active" ? <Link href={`/experts/${profileForm.slug}`} target="_blank"><Eye /> View public profile</Link> : null}</header>
            <div className="admin-form form-grid">
              <label>Role<select value={profileForm.role} onChange={(event) => updateProfile("role", event.target.value as ProfessionalRole)}>{professionalRoles.map((role) => <option value={role} key={role}>{labelProfessionalRole(role)}</option>)}</select></label>
              <label>Profile status<select value={profileForm.status} onChange={(event) => updateProfile("status", event.target.value as ProfessionalProfileStatus)}>{professionalProfileStatuses.map((status) => <option value={status} key={status}>{labelProfessionalProfileStatus(status)}</option>)}</select></label>
              <label>Name / organisation<input value={profileForm.name} onChange={(event) => updateProfile("name", event.target.value)} /></label>
              <label>Professional title / partnership role<input value={profileForm.position} onChange={(event) => updateProfile("position", event.target.value)} /></label>
              <label>Organisation <small>Optional</small><input value={profileForm.organization} onChange={(event) => updateProfile("organization", event.target.value)} /></label>
              <label>Location<input value={profileForm.location} onChange={(event) => updateProfile("location", event.target.value)} /></label>
              <label>Experience<input value={profileForm.experience} onChange={(event) => updateProfile("experience", event.target.value)} placeholder="Example: 10+ years" /></label>
              <label>Display style<select value={profileForm.tone} onChange={(event) => updateProfile("tone", event.target.value as ProfessionalTone)}>{professionalTones.map((tone) => <option value={tone} key={tone}>{tone[0].toUpperCase() + tone.slice(1)}</option>)}</select></label>
              <label>Sort order<input type="number" value={profileForm.sortOrder} onChange={(event) => updateProfile("sortOrder", event.target.value)} /></label>
              <label className="check-row"><input type="checkbox" checked={profileForm.featured} onChange={(event) => updateProfile("featured", event.target.checked)} /> Feature on the homepage first</label>
              <label className="span-two">Public profile slug<input value={profileForm.slug} onChange={(event) => updateProfile("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="Generated automatically if blank" /></label>
              <div className="span-two admin-network-media-field">
                <div className="admin-network-media-copy">
                  <strong>{profileForm.role === "associate_partner" ? "Brand logo" : "Profile photo"}</strong>
                  <small>Required before publishing. Use a square JPG, PNG or WebP image, exactly 1254 × 1254 px and no larger than 5 MB.</small>
                  <label className="upload-dropzone"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseProfileImage(event.target.files?.[0])} /><ImagePlus /><span>{pendingImage || profileForm.image ? "Replace image" : "Choose image"}</span></label>
                </div>
                <div className={`admin-network-media-preview ${pendingImage || profileForm.image ? "has-image" : ""} ${profileForm.role === "associate_partner" ? "brand-image" : ""}`}>
                  {pendingImage || profileForm.image ? <img src={pendingImage?.previewUrl ?? profileForm.image} alt={profileForm.role === "associate_partner" ? "Brand logo preview" : "Profile photo preview"} /> : profileForm.role === "associate_partner" ? <Building2 /> : <UserRound />}
                  {pendingImage || profileForm.image ? <button type="button" onClick={removeProfileImage}><Trash2 /> Remove</button> : null}
                </div>
              </div>
              <label className="span-two">Or use an image URL <small>The uploaded image above is recommended</small><input type="url" value={profileForm.image} onChange={(event) => { if (pendingImage) { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); } updateProfile("image", event.target.value); }} placeholder="https://…" /></label>
              <label className="span-two">Website URL<input type="url" value={profileForm.website} onChange={(event) => updateProfile("website", event.target.value)} /></label>
              <label className="span-two">Fields of expertise <small>One per line or comma-separated</small><textarea rows={3} value={profileForm.expertise} onChange={(event) => updateProfile("expertise", event.target.value)} /></label>
              <label className="span-two">Public summary <small>At least 40 characters</small><textarea rows={4} value={profileForm.summary} onChange={(event) => updateProfile("summary", event.target.value)} /></label>
              <label className="span-two">Biography paragraphs <small>One paragraph per line</small><textarea rows={6} value={profileForm.biography} onChange={(event) => updateProfile("biography", event.target.value)} /></label>
              <label className="span-two">Achievements <small>One per line</small><textarea rows={4} value={profileForm.achievements} onChange={(event) => updateProfile("achievements", event.target.value)} /></label>
              <label className="span-two">Qualifications <small>One per line</small><textarea rows={4} value={profileForm.qualifications} onChange={(event) => updateProfile("qualifications", event.target.value)} /></label>
            </div>
            <div className="admin-form-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void saveProfile()}>{saving ? <LoaderCircle className="admin-spinner" /> : <Save />} {profileForm.id ? "Save profile" : "Create profile"}</button>{profileForm.id && profileForm.status === "active" ? <button type="button" onClick={() => updateProfile("status", "hidden")}><Ban /> Hide profile</button> : null}{profileForm.id ? <button type="button" onClick={() => setProfileForm(profileToForm(selectedProfile!))}><Pencil /> Undo edits</button> : null}</div>
          </section>
        </div>}
      </section>
    </main>
  );
}
