export const ADMIN_ROLES = [
  "super_admin",
  "product_inventory_manager",
  "order_delivery_manager",
  "customer_support",
  "finance_manager",
  "content_promotion_manager",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_DETAILS: Record<AdminRole, { label: string; description: string; areas: string[] }> = {
  super_admin: {
    label: "Super Admin",
    description: "Complete marketplace authority, including staff access and role assignment.",
    areas: ["All administration areas", "Admin users & authority", "Certificates", "Settings"],
  },
  product_inventory_manager: {
    label: "Product & Inventory Manager",
    description: "Manages the catalogue, product listings, variants, stock and imports.",
    areas: ["Categories", "Product listings", "Inventory", "Bulk import", "Reviews", "Certificates"],
  },
  order_delivery_manager: {
    label: "Order & Delivery Manager",
    description: "Controls order fulfilment, delivery records and related customer cases.",
    areas: ["Orders", "Delivery tracking", "Support", "Professional finance records"],
  },
  customer_support: {
    label: "Customer Support",
    description: "Handles customer accounts, enquiries, disputes, reviews and professional cases.",
    areas: ["Customer support", "Orders (support view)", "Reviews", "Professional Network", "Certificates"],
  },
  finance_manager: {
    label: "Finance Manager",
    description: "Manages collections, invoices, commissions, earnings and payouts.",
    areas: ["Orders & payments", "Invoices", "Professional finance", "Commission & payouts"],
  },
  content_promotion_manager: {
    label: "Content & Promotion Manager",
    description: "Controls banners, campaigns, policies and public marketplace content.",
    areas: ["Banners & promotions", "KhetE Deals", "Policies & content", "Reviews", "Professional Network"],
  },
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasAdminAccess(roles: readonly string[]) {
  return roles.some(isAdminRole);
}
