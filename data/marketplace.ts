export type ListingType = "product" | "produce" | "service" | "rental" | "livestock";
export type OfferType = "amount" | "percentage";

export type ListingVariant = {
  id: string;
  name: string;
  nameNe?: string;
  sku?: string;
  price: number;
  regularPrice?: number;
  compareAt?: number;
  offerTitle?: string;
  offerType?: OfferType;
  offerValue?: number;
  unit?: string;
  stockQuantity: number;
  available: boolean;
  newArrival?: boolean;
  addedAt?: string;
};

export type Category = {
  id: string;
  databaseId?: string;
  name: string;
  nameNe: string;
  description: string;
  imageUrl?: string;
  icon: "tractor" | "sprout" | "wheat" | "cow" | "wrench";
  showOnHomepage?: boolean;
  active?: boolean;
  children: {
    id: string;
    databaseId?: string;
    name: string;
    nameNe?: string;
    grandchildren: { id: string; databaseId?: string; name: string; nameNe?: string }[];
  }[];
};

export type Listing = {
  id: string;
  slug: string;
  name: string;
  nameNe: string;
  type: ListingType;
  categoryId: string;
  childCategory: string;
  grandchildCategory: string;
  description: string;
  specifications: string[];
  tags: string[];
  price?: number;
  regularPrice?: number;
  compareAt?: number;
  offerTitle?: string;
  offerType?: OfferType;
  offerValue?: number;
  priceLabel?: string;
  unit?: string;
  available: boolean;
  featured?: boolean;
  deal?: boolean;
  newArrival?: boolean;
  newArrivalAt?: string;
  district: string[];
  images?: { url: string; alt: string; primary: boolean }[];
  variants?: ListingVariant[];
  tone: "green" | "gold" | "earth" | "blue" | "plum";
};

export const categories: Category[] = [
  {
    id: "machinery",
    name: "Machinery & Equipment",
    nameNe: "मेसिनरी तथा उपकरण",
    description: "Machines, tools, irrigation equipment and rentals for farms of every scale.",
    icon: "tractor",
    children: [
      {
        id: "tractors",
        name: "Tractors",
        grandchildren: [
          { id: "heavy-duty-tractors", name: "Heavy-Duty Tractors" },
          { id: "power-tillers", name: "Power Tillers" },
          { id: "power-trailers", name: "Power Trailers" },
        ],
      },
      {
        id: "irrigation",
        name: "Irrigation",
        grandchildren: [
          { id: "drip-systems", name: "Drip Systems" },
          { id: "water-pumps", name: "Water Pumps" },
        ],
      },
      {
        id: "farm-tools",
        name: "Farm Tools",
        grandchildren: [
          { id: "hand-tools", name: "Hand Tools" },
          { id: "sprayers", name: "Sprayers" },
        ],
      },
    ],
  },
  {
    id: "produce",
    name: "Fresh Produce",
    nameNe: "ताजा कृषि उपज",
    description: "Fresh vegetables, fruits, grains and local farm produce sold by weight or pack.",
    icon: "sprout",
    children: [
      {
        id: "vegetables",
        name: "Vegetables",
        grandchildren: [
          { id: "leafy-greens", name: "Leafy Greens" },
          { id: "seasonal-vegetables", name: "Seasonal Vegetables" },
        ],
      },
      {
        id: "fruits",
        name: "Fruits",
        grandchildren: [
          { id: "citrus", name: "Citrus" },
          { id: "orchard-fruits", name: "Orchard Fruits" },
        ],
      },
    ],
  },
  {
    id: "seeds-inputs",
    name: "Seeds & Farm Inputs",
    nameNe: "बीउ तथा कृषि सामग्री",
    description: "Seeds, nutrition, growing media and farm essentials for dependable production.",
    icon: "wheat",
    children: [
      {
        id: "seeds",
        name: "Seeds",
        grandchildren: [
          { id: "vegetable-seeds", name: "Vegetable Seeds" },
          { id: "grain-seeds", name: "Grain Seeds" },
        ],
      },
      {
        id: "soil-nutrition",
        name: "Soil & Nutrition",
        grandchildren: [
          { id: "organic-inputs", name: "Organic Inputs" },
          { id: "fertilizers", name: "Fertilizers" },
        ],
      },
    ],
  },
  {
    id: "livestock",
    name: "Livestock",
    nameNe: "पशुपन्छी",
    description: "Verified livestock listings with reservation, documentation and delivery coordination.",
    icon: "cow",
    children: [
      {
        id: "cattle",
        name: "Cattle",
        grandchildren: [
          { id: "dairy-cattle", name: "Dairy Cattle" },
          { id: "calves", name: "Calves" },
        ],
      },
      {
        id: "small-livestock",
        name: "Small Livestock",
        grandchildren: [
          { id: "goats", name: "Goats" },
          { id: "poultry", name: "Poultry" },
        ],
      },
    ],
  },
  {
    id: "services",
    name: "Services & Rentals",
    nameNe: "सेवा तथा भाडा",
    description: "Equipment rental, installation, farm support and practical agricultural services.",
    icon: "wrench",
    children: [
      {
        id: "equipment-rental",
        name: "Equipment Rental",
        grandchildren: [
          { id: "tractor-rental", name: "Tractor Rental" },
          { id: "tool-rental", name: "Tool Rental" },
        ],
      },
      {
        id: "farm-services",
        name: "Farm Services",
        grandchildren: [
          { id: "installation", name: "Installation" },
          { id: "field-support", name: "Field Support" },
        ],
      },
    ],
  },
];

export const listings: Listing[] = [
  {
    id: "tractor-20hp",
    slug: "20-hp-compact-tractor",
    name: "20 HP Compact Tractor",
    nameNe: "२० एचपी कम्प्याक्ट ट्र्याक्टर",
    type: "product",
    categoryId: "machinery",
    childCategory: "Tractors",
    grandchildCategory: "Heavy-Duty Tractors",
    description: "A compact, fuel-efficient tractor designed for tilling, transport and everyday farm work.",
    specifications: ["20 HP diesel engine", "Two-wheel drive", "Three-point linkage", "Warranty support"],
    tags: ["tractor", "20 hp", "machinery", "equipment", "diesel", "farm", "ट्र्याक्टर"],
    price: 785000,
    compareAt: 825000,
    offerTitle: "Monsoon Machinery Offer",
    unit: "unit",
    available: true,
    featured: true,
    deal: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur", "Chitwan"],
    tone: "green",
  },
  {
    id: "power-tiller",
    slug: "8-hp-power-tiller",
    name: "8 HP Power Tiller",
    nameNe: "८ एचपी पावर टिलर",
    type: "product",
    categoryId: "machinery",
    childCategory: "Tractors",
    grandchildCategory: "Power Tillers",
    description: "A versatile power tiller for soil preparation in smaller plots and vegetable farms.",
    specifications: ["8 HP engine", "Adjustable tilling width", "Compact turning radius"],
    tags: ["power tiller", "tiller", "soil", "machine", "equipment", "खेती"],
    price: 138000,
    unit: "unit",
    available: true,
    featured: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur", "Kavre"],
    tone: "earth",
  },
  {
    id: "tomato",
    slug: "farm-fresh-organic-tomatoes",
    name: "Farm-Fresh Organic Tomatoes",
    nameNe: "ताजा अर्गानिक टमाटर",
    type: "produce",
    categoryId: "produce",
    childCategory: "Vegetables",
    grandchildCategory: "Seasonal Vegetables",
    description: "Freshly harvested local tomatoes sorted and packed for household or business orders.",
    specifications: ["Harvested locally", "Graded for freshness", "Bulk ordering available"],
    tags: ["organic", "tomato", "fresh", "vegetable", "kg", "local", "टमाटर", "तरकारी"],
    price: 110,
    compareAt: 135,
    offerTitle: "Fresh Harvest Offer",
    unit: "kg",
    available: true,
    deal: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur"],
    tone: "gold",
  },
  {
    id: "spinach",
    slug: "fresh-spinach-bundle",
    name: "Fresh Spinach Bundle",
    nameNe: "ताजा पालुङ्गोको मुठा",
    type: "produce",
    categoryId: "produce",
    childCategory: "Vegetables",
    grandchildCategory: "Leafy Greens",
    description: "Clean, tender spinach bundles supplied from local growers.",
    specifications: ["Same-day harvest", "Washed and bundled", "Local grower supply"],
    tags: ["spinach", "greens", "leafy", "vegetable", "fresh", "पालुङ्गो", "साग"],
    price: 65,
    unit: "bundle",
    available: true,
    featured: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur"],
    tone: "green",
  },
  {
    id: "maize-seed",
    slug: "improved-maize-seed-pack",
    name: "Improved Maize Seed Pack",
    nameNe: "उन्नत मकैको बीउ",
    type: "product",
    categoryId: "seeds-inputs",
    childCategory: "Seeds",
    grandchildCategory: "Grain Seeds",
    description: "A labelled maize seed pack suitable for seasonal field planting.",
    specifications: ["5 kg sealed pack", "Batch labelled", "Planting guidance included"],
    tags: ["maize", "corn", "seed", "grain", "crop", "मकै", "बीउ"],
    price: 1850,
    unit: "5 kg pack",
    available: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur", "Kavre", "Chitwan"],
    tone: "gold",
  },
  {
    id: "drip-installation",
    slug: "drip-irrigation-installation",
    name: "Drip Irrigation Installation",
    nameNe: "ड्रिप सिँचाइ जडान सेवा",
    type: "service",
    categoryId: "services",
    childCategory: "Farm Services",
    grandchildCategory: "Installation",
    description: "Site review, system planning and installation for small and medium farms.",
    specifications: ["Site assessment", "Material estimate", "Installation and testing"],
    tags: ["drip", "irrigation", "installation", "water", "service", "pipe", "सिँचाइ", "जडान"],
    priceLabel: "From Rs. 8,500",
    available: true,
    featured: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur", "Kavre"],
    tone: "blue",
  },
  {
    id: "tractor-rental",
    slug: "tractor-rental-half-day",
    name: "Tractor Rental — Half Day",
    nameNe: "आधा दिन ट्र्याक्टर भाडा",
    type: "rental",
    categoryId: "services",
    childCategory: "Equipment Rental",
    grandchildCategory: "Tractor Rental",
    description: "Reserve a tractor with an operator for ploughing and field preparation.",
    specifications: ["Operator included", "Four-hour booking", "Area confirmation required"],
    tags: ["tractor", "rental", "hire", "ploughing", "service", "भाडा", "ट्र्याक्टर"],
    priceLabel: "From Rs. 5,500",
    available: true,
    deal: true,
    offerTitle: "Seasonal Rental Offer",
    district: ["Bhaktapur", "Lalitpur", "Kavre", "Chitwan"],
    tone: "earth",
  },
  {
    id: "dairy-cattle",
    slug: "verified-dairy-cattle-reservation",
    name: "Verified Dairy Cattle Reservation",
    nameNe: "प्रमाणित दुहुना गाई आरक्षण",
    type: "livestock",
    categoryId: "livestock",
    childCategory: "Cattle",
    grandchildCategory: "Dairy Cattle",
    description: "A reservation listing with health documentation and transport coordination before purchase.",
    specifications: ["Verification required", "Health record review", "Transport arranged separately"],
    tags: ["dairy", "cattle", "cow", "livestock", "reservation", "गाई", "पशुपालन"],
    priceLabel: "Reserve & enquire",
    available: true,
    featured: true,
    district: ["Kathmandu", "Bhaktapur", "Lalitpur", "Kavre", "Chitwan"],
    tone: "plum",
  },
];

export const formatNpr = (price: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(price);

export const getCategory = (id: string) => categories.find((category) => category.id === id);
