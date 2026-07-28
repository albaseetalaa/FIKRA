import type { BusinessVertical, BusinessVerticalClassification } from "./types";

type Candidate = { vertical: BusinessVertical; score: number; evidence: string[] };

function addScore(candidate: Candidate, points: number, reason: string) {
  candidate.score += points;
  candidate.evidence.push(reason);
}

function keywordHit(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyBusinessVertical(input: {
  industry?: string | null;
  businessDescription: string;
  selectedGoals?: string[];
  customerType?: string | null;
}): BusinessVerticalClassification {
  const text = `${input.industry ?? ""} ${input.businessDescription} ${(input.selectedGoals ?? []).join(" ")} ${input.customerType ?? ""}`.toLowerCase();

  const candidates: Candidate[] = [
    { vertical: "restaurant_food_service", score: 0, evidence: [] },
    { vertical: "ecommerce_retail", score: 0, evidence: [] },
    { vertical: "professional_services", score: 0, evidence: [] },
    { vertical: "saas_software", score: 0, evidence: [] },
    { vertical: "marketplace", score: 0, evidence: [] },
    { vertical: "subscription_service", score: 0, evidence: [] },
    { vertical: "physical_retail", score: 0, evidence: [] },
    { vertical: "manufacturing", score: 0, evidence: [] },
    { vertical: "real_estate", score: 0, evidence: [] },
    { vertical: "logistics_delivery", score: 0, evidence: [] },
    { vertical: "education_training", score: 0, evidence: [] },
    { vertical: "healthcare_wellness", score: 0, evidence: [] },
    { vertical: "generic_other", score: 0.1, evidence: ["Generic fallback candidate"] },
  ];

  const find = (vertical: BusinessVertical) => candidates.find((candidate) => candidate.vertical === vertical)!;

  if (keywordHit(text, [/restaurant|food|breakfast|dine|cafe|kitchen|menu|delivery/])) {
    addScore(find("restaurant_food_service"), 1.8, "Food-service keywords detected.");
  }
  if (keywordHit(text, [/e-?commerce|online store|sku|cart|fulfillment|shipping|product catalog/])) {
    addScore(find("ecommerce_retail"), 1.8, "E-commerce keywords detected.");
  }
  if (keywordHit(text, [/consulting|agency|studio|service business|client projects|billable/])) {
    addScore(find("professional_services"), 1.7, "Professional services keywords detected.");
  }
  if (keywordHit(text, [/saas|software|platform|api|subscription app|b2b software/])) {
    addScore(find("saas_software"), 1.9, "Software keywords detected.");
  }
  if (keywordHit(text, [/marketplace|buyers and sellers|vendors|take rate|commission model/])) {
    addScore(find("marketplace"), 1.8, "Marketplace keywords detected.");
  }
  if (keywordHit(text, [/subscription box|membership|monthly plan/])) {
    addScore(find("subscription_service"), 1.5, "Subscription-service keywords detected.");
  }
  if (keywordHit(text, [/retail shop|storefront|walk-in|physical store/])) {
    addScore(find("physical_retail"), 1.3, "Physical retail keywords detected.");
  }
  if (keywordHit(text, [/factory|manufacturing|production line|wholesale production/])) {
    addScore(find("manufacturing"), 1.4, "Manufacturing keywords detected.");
  }
  if (keywordHit(text, [/real estate|property|leasing|brokerage/])) {
    addScore(find("real_estate"), 1.3, "Real-estate keywords detected.");
  }
  if (keywordHit(text, [/logistics|fleet|dispatch|last mile|delivery network/])) {
    addScore(find("logistics_delivery"), 1.5, "Logistics keywords detected.");
  }
  if (keywordHit(text, [/education|training|course|academy|learning platform/])) {
    addScore(find("education_training"), 1.4, "Education keywords detected.");
  }
  if (keywordHit(text, [/clinic|wellness|patient|healthcare|therapy/])) {
    addScore(find("healthcare_wellness"), 1.4, "Healthcare keywords detected.");
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted[1];

  if (!best || best.score < 0.7) {
    return {
      vertical: "unknown",
      confidence: 0,
      evidence: ["Insufficient industry evidence for confident classification."],
      unresolvedAmbiguities: ["Business description lacks clear vertical indicators."],
      alternativeCandidates: sorted.slice(0, 3).map((c) => ({ vertical: c.vertical, confidence: Math.min(1, c.score / 2) })),
      requiresUserConfirmation: true,
    };
  }

  const confidence = Math.min(1, best.score / 2.5);
  const ambiguityGap = Math.max(0, best.score - (second?.score ?? 0));
  const requiresUserConfirmation = confidence < 0.55 || ambiguityGap < 0.35;

  return {
    vertical: best.vertical,
    confidence,
    evidence: best.evidence,
    unresolvedAmbiguities: requiresUserConfirmation && second ? [`Ambiguity between ${best.vertical} and ${second.vertical}.`] : [],
    alternativeCandidates: sorted.slice(1, 4).map((candidate) => ({
      vertical: candidate.vertical,
      confidence: Math.min(1, candidate.score / 2.5),
    })),
    requiresUserConfirmation,
  };
}
