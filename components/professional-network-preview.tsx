"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import {
  professionalProfileSelect,
  type ProfessionalProfile,
} from "@/lib/professional-network";
import { createClient } from "@/lib/supabase/client";
import { ExpertCard } from "./expert-card";

const roleCards = [
  { href: "/experts?role=advisor", title: "Advisors", copy: "Strategic agricultural guidance", icon: Lightbulb },
  { href: "/experts?role=expert_professional", title: "Expert Professionals", copy: "Specialist technical experience", icon: BriefcaseBusiness },
  { href: "/experts?role=associate_partner", title: "Associate Partners", copy: "Verified organisations and networks", icon: Building2 },
];

export function ProfessionalNetworkPreview() {
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("professional_profiles")
        .select(professionalProfileSelect)
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false })
        .limit(3);
      if (mounted) setProfiles((data ?? []) as unknown as ProfessionalProfile[]);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  if (profiles.length) {
    return <div className="experts-grid experts-grid-preview">{profiles.map((profile) => <ExpertCard expert={profile} key={profile.id} />)}</div>;
  }

  return (
    <div className="network-role-preview">
      {roleCards.map((card) => {
        const Icon = card.icon;
        return <Link href={card.href} key={card.href}><Icon /><span><strong>{card.title}</strong><small>{card.copy}</small></span><ArrowRight /></Link>;
      })}
    </div>
  );
}
