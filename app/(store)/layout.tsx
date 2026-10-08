import { SiteShell } from "@/components/site-shell";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
