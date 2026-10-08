import type { Metadata } from "next";
import "./globals.css";
import "./professional-services.css";

export const metadata: Metadata = {
  title: { default: "khetE — From fields to futures", template: "%s | khetE" },
  description: "A modern agricultural marketplace for produce, equipment, services, rentals and trusted farm connections in Nepal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
