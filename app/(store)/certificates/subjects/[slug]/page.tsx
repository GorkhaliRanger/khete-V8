/* eslint-disable @next/next/no-img-element -- Subject images are managed external assets. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { EntityCertificates } from "@/components/entity-certificates";
import {
  certificateSubjectSelect,
  type CertificateSubject,
} from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";

export default async function CertificateSubjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificate_subjects")
    .select(certificateSubjectSelect)
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (!data) notFound();
  const subject = data as unknown as CertificateSubject;

  return (
    <main className="certificate-subject-page">
      <div className="site-container">
        <Link className="back-link" href="/certificates"><ArrowLeft /> Back to Certificates</Link>
        <section className="certificate-subject-hero">
          <span className="certificate-subject-image">
            {subject.image_url ? <img src={subject.image_url} alt={subject.display_name} /> : subject.kind === "farm" ? <Building2 /> : <UserRound />}
          </span>
          <div>
            <p className="eyebrow"><ShieldCheck /> Certified {subject.kind}</p>
            <h1>{subject.display_name}</h1>
            {subject.subtitle ? <p className="certificate-subject-subtitle">{subject.subtitle}</p> : null}
            {subject.location ? <span><MapPin /> {subject.location}</span> : null}
          </div>
        </section>
        {subject.description ? <section className="certificate-subject-about"><p className="eyebrow">About this record</p><h2>{subject.kind === "farm" ? "Farm information" : "Person information"}</h2><p>{subject.description}</p></section> : null}
        <EntityCertificates targetType="subject" targetId={subject.id} />
      </div>
    </main>
  );
}

