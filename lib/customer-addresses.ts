export type CustomerAddressRow = {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  email: string;
  district: string;
  municipality: string;
  ward: string;
  area: string;
  street_address: string;
  delivery_note: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerAddressDraft = {
  label: string;
  fullName: string;
  phone: string;
  email: string;
  district: string;
  municipality: string;
  ward: string;
  area: string;
  streetAddress: string;
  deliveryNote: string;
  isDefault: boolean;
};

export const customerAddressSelect = [
  "id",
  "user_id",
  "label",
  "full_name",
  "phone",
  "email",
  "district",
  "municipality",
  "ward",
  "area",
  "street_address",
  "delivery_note",
  "is_default",
  "created_at",
  "updated_at",
].join(",");

export function addressDraftFromRow(address: CustomerAddressRow): CustomerAddressDraft {
  return {
    label: address.label,
    fullName: address.full_name,
    phone: address.phone,
    email: address.email,
    district: address.district,
    municipality: address.municipality,
    ward: address.ward,
    area: address.area,
    streetAddress: address.street_address,
    deliveryNote: address.delivery_note ?? "",
    isDefault: address.is_default,
  };
}

export function customerAddressError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "The address request could not be completed.";

  if (
    message.includes("customer_addresses")
    || message.includes("schema cache")
    || message.includes("relation")
  ) {
    return "Run migration 202607230012_customer_addresses.sql in Supabase, then refresh this page.";
  }

  return message;
}

export function formatCustomerAddress(address: CustomerAddressRow) {
  return [
    address.street_address,
    address.area,
    `Ward ${address.ward}`,
    address.municipality,
    address.district,
  ].filter(Boolean).join(", ");
}
