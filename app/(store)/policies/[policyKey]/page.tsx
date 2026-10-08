import { notFound } from "next/navigation";
import { PolicyPageView } from "@/components/policy-page-view";
import { isSitePolicyKey, sitePolicyKeys } from "@/lib/site-policies";

export function generateStaticParams() {
  return sitePolicyKeys.map((policyKey) => ({ policyKey }));
}

export default async function PolicyPage({ params }: { params: Promise<{ policyKey: string }> }) {
  const { policyKey } = await params;
  if (!isSitePolicyKey(policyKey)) notFound();
  return <PolicyPageView policyKey={policyKey} />;
}
