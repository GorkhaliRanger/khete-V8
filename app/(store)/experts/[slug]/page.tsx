import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, BadgeCheck, BriefcaseBusiness, Building2, ExternalLink, MapPin } from "lucide-react";
import {
  labelProfessionalRole,
  professionalInitials,
  professionalProfileSelect,
  type ProfessionalProfile,
} from "@/lib/professional-network";
import { createClient } from "@/lib/supabase/server";
import { PublicReviews } from "@/components/public-reviews";
import { EntityCertificates } from "@/components/entity-certificates";

export default async function ExpertProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("professional_profiles")
    .select(professionalProfileSelect)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!data) notFound();
  const expert = data as unknown as ProfessionalProfile;
  const initials = professionalInitials(expert.name);

  return (
    <main className="expert-profile-page">
      <div className="site-container">
        <Link className="back-link" href="/experts"><ArrowLeft /> Back to Experts & Partners</Link>
        <section className={`expert-profile-hero expert-${expert.tone}`}>
          <div className={`expert-profile-avatar ${expert.profile_image_url ? "has-image" : ""} ${expert.role === "associate_partner" ? "brand-image" : ""}`} style={expert.profile_image_url ? { backgroundImage: `url("${expert.profile_image_url}")` } : undefined} aria-label={expert.profile_image_url ? `${expert.name} ${expert.role === "associate_partner" ? "brand logo" : "profile image"}` : undefined}>
            {!expert.profile_image_url ? expert.role === "associate_partner" ? <Building2 /> : initials : null}
          </div>
          <div><p className="eyebrow">{labelProfessionalRole(expert.role)} · Verified by khetE</p><h1>{expert.name}</h1><p className="expert-profile-position">{expert.position_title}</p><div className="expert-profile-meta"><span><MapPin /> {expert.location}</span><span><BriefcaseBusiness /> {expert.experience}</span></div></div>
        </section>
        <div className="expert-profile-layout">
          <article>
            <p className="eyebrow">Biography</p><h2>Professional background</h2>
            {(expert.biography.length ? expert.biography : [expert.summary]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {expert.achievements.length ? <div className="profile-section"><p className="eyebrow">Achievements</p><h2>Selected work and contributions</h2>{expert.achievements.map((achievement) => <div className="profile-list-row" key={achievement}><Award /> <span>{achievement}</span></div>)}</div> : null}
          </article>
          <aside>
            <div className="profile-aside-card"><h3>Fields of expertise</h3>{expert.expertise.map((item) => <span key={item}><BadgeCheck /> {item}</span>)}</div>
            {expert.qualifications.length ? <div className="profile-aside-card"><h3>Qualifications</h3>{expert.qualifications.map((item) => <span key={item}><BadgeCheck /> {item}</span>)}</div> : null}
            {expert.website_url ? <a className="secondary-button" href={expert.website_url} target="_blank" rel="noopener noreferrer">Professional website <ExternalLink /></a> : null}
            <Link className="primary-button" href={`/services?provider=${expert.id}#professional-services`}>View available services</Link>
          </aside>
        </div>
        <EntityCertificates targetType="profile" targetId={expert.id} />
        <PublicReviews targetType="professional" targetId={expert.id} />
      </div>
    </main>
  );
}
