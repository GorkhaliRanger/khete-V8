import Link from "next/link";
import { ArrowRight, Building2, MapPin, UserRound } from "lucide-react";
import {
  labelProfessionalRole,
  professionalInitials,
  type ProfessionalProfile,
} from "@/lib/professional-network";

export function ExpertCard({ expert }: { expert: ProfessionalProfile }) {
  const initials = professionalInitials(expert.name);
  return (
    <Link className={`expert-card expert-${expert.tone}`} href={`/experts/${expert.slug}`}>
      <div className="expert-card-top">
        <span className={`expert-avatar ${expert.profile_image_url ? "has-image" : ""} ${expert.role === "associate_partner" ? "brand-image" : ""}`} style={expert.profile_image_url ? { backgroundImage: `url("${expert.profile_image_url}")` } : undefined}>
          {!expert.profile_image_url
            ? expert.role === "associate_partner"
              ? <Building2 />
              : initials || <UserRound />
            : null}
        </span>
        <span className="expert-role">{labelProfessionalRole(expert.role)}</span>
      </div>
      <div>
        <h3>{expert.name}</h3>
        <p className="expert-position">{expert.position_title}</p>
      </div>
      <div className="expert-tags">{expert.expertise.slice(0, 2).map((item) => <span key={item}>{item}</span>)}</div>
      <p>{expert.summary}</p>
      <span className="expert-location"><MapPin /> {expert.location}</span>
      <span className="expert-link">View full profile <ArrowRight /></span>
    </Link>
  );
}
