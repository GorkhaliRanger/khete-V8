import type { Metadata } from "next";
import { CustomerServiceRequests } from "@/components/customer-service-requests";

export const metadata: Metadata = {
  title: "My Service Requests",
  description: "Track your khetE professional service requests and schedules.",
};

export default function CustomerServiceRequestsPage() {
  return <CustomerServiceRequests />;
}
