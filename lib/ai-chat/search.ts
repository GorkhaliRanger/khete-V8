import { DEMO_PRODUCTS, DEMO_PROFESSIONALS } from "./data";
import type {
  DemoProduct,
  ProductConstraints,
  ProductMatch,
  ProfessionalConstraints,
  ProfessionalMatch,
  ProductSearch,
  ProfessionalSearch,
  ChatLanguage,
} from "./types";

/**
 * Deterministic product/professional search for the prototype.
 *
 * Deliberately designed so a future AI layer never needs the whole catalog:
 * constraints are filtered and scored here, and only the top matches are
 * shown. Suitable-first ordering, then budget fit, then availability.
 */

function terrainFit(product: DemoProduct, terrain: "hilly" | "flat" | null): number {
  if (!terrain || product.suitsTerrain === "any") return 1;
  return product.suitsTerrain.includes(terrain) ? 3 : -100; // unsuitable machines are never recommended
}

function scoreProduct(product: DemoProduct, constraints: ProductConstraints): ProductMatch | null {
  let score = 0;
  const reasons: string[] = [];

  if (constraints.productType && product.productType !== constraints.productType) return null;
  if (constraints.productType) {
    score += 2;
    reasons.push(`matches "${constraints.productType}"`);
  }

  if (constraints.category && product.category !== constraints.category) return null;
  // Purchases never surface rentals or services; rentals never surface purchasable stock.
  if (!constraints.rental && (product.category === "rental" || product.category === "service")) return null;
  if (constraints.rental && product.category !== "rental") return null;

  const fit = terrainFit(product, constraints.terrain);
  if (fit === -100) return null;
  if (fit === 3) {
    score += 3;
    reasons.push(`suitable for ${constraints.terrain} terrain`);
  }

  if (constraints.application && product.application.includes(constraints.application)) {
    score += 2;
    reasons.push(`fits ${constraints.application} use`);
  }
  if (constraints.district && product.category !== "rental") score += 0.5;
  if (constraints.season && product.application.includes(constraints.season.split("/")[0])) score += 1;

  let budgetDifference: number | null = null;
  if (constraints.budgetNpr !== null) {
    budgetDifference = product.priceNpr - constraints.budgetNpr;
    if (budgetDifference <= 0) {
      score += 2;
      reasons.push(`within budget (${Math.abs(budgetDifference).toLocaleString("en-IN")} under)`);
    } else {
      score -= 1; // over-budget items rank below in-budget ones
    }
  }

  if (product.available && product.inStock) score += 1;
  if (product.inStock) reasons.push("in stock");
  else reasons.push("out of stock — lead time applies");

  return { product, score, reasons, budgetDifference };
}

export class DemoProductSearch implements ProductSearch {
  search(constraints: ProductConstraints, _language: ChatLanguage) {
    const scored = DEMO_PRODUCTS
      .map((product) => scoreProduct(product, constraints))
      .filter((match): match is ProductMatch => match !== null)
      .sort((a, b) => b.score - a.score || a.product.priceNpr - b.product.priceNpr);

    const withinBudget = scored.filter((match) => match.budgetDifference === null || match.budgetDifference <= 0);
    const matches = (withinBudget.length ? withinBudget : scored.filter((match) => match.budgetDifference !== null && match.budgetDifference <= 0))
      .slice(0, 3);
    const alternatives = scored
      .filter((match) => match.budgetDifference !== null && match.budgetDifference > 0)
      .slice(0, 3);

    // Scenario E: nothing suitable at all — return closest over-budget as alternatives only.
    if (!matches.length && !alternatives.length && scored.length) {
      return { matches: [], alternatives: scored.slice(0, 3) };
    }
    return { matches, alternatives };
  }
}

/** Maps a described project to the professional disciplines that may be relevant. */
export function disciplinesForProject(project: ProfessionalConstraints): string[] {
  const found = new Set<string>();
  const text = `${project.projectType} ${project.disciplines.join(" ")}`.toLowerCase();

  const add = (keys: string[], discipline: string) => {
    if (keys.some((key) => text.includes(key))) found.add(discipline);
  };

  add(["hatchery", "चल्ला"], "hatchery equipment consultant");
  add(["poultry", "chick", "hatchery", "कुखुरा"], "poultry specialist");
  add(["poultry", "chick", "hatchery", "कुखुरा"], "veterinarian");
  add(["hatchery", "poultry", "construction", "build", "निर्माण"], "agricultural infrastructure advisor");
  add(["hatchery", "backup", "power", "electrical", "विद्युत"], "electrical engineer");
  add(["hatchery", "poultry", "ventilation", "हावा"], "ventilation specialist");
  add(["seed", "crop", "soil", "बीउ"], "agronomy advisor");
  add(["drip", "irrigation", "सिँचाइ", "सिंचाई"], "irrigation technician");

  return [...found];
}

export class DemoProfessionalSearch implements ProfessionalSearch {
  search(constraints: ProfessionalConstraints, _language: ChatLanguage): ProfessionalMatch[] {
    const wanted = constraints.disciplines.length ? constraints.disciplines : disciplinesForProject(constraints);
    if (!wanted.length) return [];

    return DEMO_PROFESSIONALS.map((professional) => {
      const matchedSkills = professional.skills.filter((skill) =>
        wanted.some((discipline) => discipline.toLowerCase().includes(skill) || skill.includes(discipline.split(" ")[0])),
      );
      const bySpecialization = wanted.some((discipline) =>
        professional.specialization.toLowerCase().includes(discipline.split(" ")[0]),
      );
      const score = matchedSkills.length * 2 + (bySpecialization ? 3 : 0) + (professional.verified ? 1 : 0);
      return { professional, score, matchedSkills };
    })
      .filter((match) => match.score >= 2 && (match.matchedSkills.length > 0 || match.score >= 3))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }
}
