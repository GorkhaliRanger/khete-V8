export type ExpertProfile = {
  slug: string;
  name: string;
  role: "Advisor" | "Expert Professional" | "Associate Partner";
  position: string;
  expertise: string[];
  location: string;
  experience: string;
  summary: string;
  biography: string[];
  achievements: string[];
  qualifications: string[];
  tone: "forest" | "gold" | "sage" | "earth";
};

export const experts: ExpertProfile[] = [
  {
    slug: "asha-koirala-crop-advisor",
    name: "Dr. Asha Koirala",
    role: "Advisor",
    position: "Senior Agricultural Advisor",
    expertise: ["Crop planning", "Soil health", "Sustainable production"],
    location: "Kathmandu, Nepal",
    experience: "15+ years",
    summary: "Advises farms and agricultural programmes on crop planning, soil improvement and practical production systems.",
    biography: [
      "Dr. Asha Koirala works with growers, agricultural organisations and community programmes to translate crop science into practical field decisions.",
      "Her work focuses on production planning, soil improvement and methods that help farms use inputs more carefully while maintaining dependable yields.",
    ],
    achievements: ["Led crop-planning programmes across multiple growing districts", "Developed field-ready soil health guidance", "Mentored early-career agricultural professionals"],
    qualifications: ["Doctorate in Agricultural Science", "Specialisation in Soil and Crop Systems"],
    tone: "forest",
  },
  {
    slug: "maya-karki-mechanisation-specialist",
    name: "Er. Maya Karki",
    role: "Expert Professional",
    position: "Farm Mechanisation & Irrigation Specialist",
    expertise: ["Farm machinery", "Irrigation design", "Equipment selection"],
    location: "Lalitpur, Nepal",
    experience: "10+ years",
    summary: "Supports farms with machinery selection, irrigation planning, installation review and practical equipment use.",
    biography: [
      "Er. Maya Karki specialises in matching machinery and irrigation systems to farm size, terrain, water availability and operating needs.",
      "She works across assessment, system planning, installation review and operator guidance so that equipment investments remain practical and maintainable.",
    ],
    achievements: ["Designed irrigation plans for small and medium farms", "Delivered machinery safety and operator training", "Supported farm equipment evaluation projects"],
    qualifications: ["Bachelor of Agricultural Engineering", "Certified Irrigation System Designer"],
    tone: "gold",
  },
  {
    slug: "sushil-gurung-livestock-consultant",
    name: "Sushil Gurung",
    role: "Expert Professional",
    position: "Livestock & Dairy Consultant",
    expertise: ["Dairy management", "Livestock welfare", "Farm operations"],
    location: "Chitwan, Nepal",
    experience: "12+ years",
    summary: "Provides practical guidance on dairy operations, livestock welfare, record keeping and farm management.",
    biography: [
      "Sushil Gurung works with livestock keepers and dairy enterprises on everyday management systems, welfare practices and production records.",
      "His approach combines field observation with simple operating procedures that farm teams can consistently follow.",
    ],
    achievements: ["Advised growing dairy enterprises on operating systems", "Created practical livestock record templates", "Conducted field workshops for farm teams"],
    qualifications: ["Master of Animal Science", "Training in Dairy Farm Management"],
    tone: "sage",
  },
  {
    slug: "greenpath-agriculture-network",
    name: "GreenPath Agriculture Network",
    role: "Associate Partner",
    position: "Farmer & Enterprise Support Partner",
    expertise: ["Farmer networks", "Market linkage", "Training coordination"],
    location: "Bagmati Province, Nepal",
    experience: "Regional network",
    summary: "An associate network supporting farmer coordination, training programmes and responsible market connections.",
    biography: [
      "GreenPath Agriculture Network coordinates with producer groups, agricultural enterprises and technical professionals to make support easier to access.",
      "Its partnership role includes field coordination, training support and responsible introductions between producers and service providers.",
    ],
    achievements: ["Coordinated multi-location farmer learning sessions", "Supported local producer-to-market connections", "Built partnerships across agricultural services"],
    qualifications: ["Verified associate organisation", "Regional coordination team"],
    tone: "earth",
  },
];
