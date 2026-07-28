import type {
  BusinessVertical,
  RevenueComponent,
  RevenueModel,
  RevenueModelClassification,
  SalesChannel,
} from "./types";

const salesChannelMap: Record<BusinessVertical, SalesChannel[]> = {
  restaurant_food_service: ["dine_in", "takeaway", "drive_thru", "delivery"],
  ecommerce_retail: ["online_store", "marketplaces", "social_commerce", "website"],
  professional_services: ["direct_sales", "website", "partner_sales", "project_fees", "retainers", "advisory"],
  saas_software: ["website", "direct_sales", "partner_sales", "mobile_app"],
  marketplace: ["website", "mobile_app", "partner_sales"],
  subscription_service: ["website", "mobile_app", "delivery"],
  physical_retail: ["in_store_sales", "point_of_sale", "takeaway"],
  manufacturing: ["direct_sales", "partner_sales", "wholesale_orders", "b2b_contracts"],
  real_estate: ["direct_sales", "website", "partner_sales", "broker_commissions", "lease_fees"],
  logistics_delivery: ["delivery", "website", "mobile_app", "service_contracts"],
  education_training: ["website", "mobile_app", "partner_sales", "course_fees"],
  healthcare_wellness: ["direct_sales", "website", "partner_sales", "consultation_fees", "package_plans"],
  generic_other: ["direct_sales", "website"],
  unknown: ["unknown"],
};

const revenueComponentMap: Record<BusinessVertical, RevenueComponent[]> = {
  restaurant_food_service: ["transaction_sales", "delivery_fee", "add_on_products"],
  ecommerce_retail: ["transaction_sales", "delivery_fee", "advertising"],
  professional_services: ["service_fee", "retainer_fee"],
  saas_software: ["monthly_subscription", "annual_subscription", "usage_fee"],
  marketplace: ["transaction_commission", "listing_fee", "advertising"],
  subscription_service: ["monthly_subscription", "annual_subscription", "add_on_products"],
  physical_retail: ["transaction_sales", "add_on_products"],
  manufacturing: ["transaction_sales", "licensing"],
  real_estate: ["rental_income", "service_fee"],
  logistics_delivery: ["service_fee", "delivery_fee", "transaction_sales"],
  education_training: ["service_fee", "monthly_subscription", "annual_subscription"],
  healthcare_wellness: ["service_fee", "monthly_subscription"],
  generic_other: ["unknown"],
  unknown: ["unknown"],
};

function fromVertical(vertical: BusinessVertical): RevenueModel {
  switch (vertical) {
    case "restaurant_food_service":
    case "ecommerce_retail":
    case "physical_retail":
    case "manufacturing":
      return "transaction_sales";
    case "saas_software":
      return "subscription";
    case "marketplace":
      return "marketplace_commission";
    case "professional_services":
    case "healthcare_wellness":
      return "service_fees";
    case "subscription_service":
      return "subscription";
    case "real_estate":
      return "rental";
    default:
      return "unknown";
  }
}

export function classifyRevenueModel(input: {
  businessVertical: BusinessVertical;
  businessDescription: string;
  selectedGoals?: string[];
}): RevenueModelClassification {
  const text = `${input.businessDescription} ${(input.selectedGoals ?? []).join(" ")}`.toLowerCase();
  let primary = fromVertical(input.businessVertical);
  const evidence: string[] = [`Derived from vertical ${input.businessVertical}.`];
  const ambiguities: string[] = [];

  const hasSubscriptionSignal = /subscription|monthly plan|membership|recurring/.test(text);
  const hasMarketplaceSignal = /marketplace|buyers and sellers|vendors|seller network|take rate|commission/.test(text);
  const hasMarketplaceNegation = /not\s+(a\s+)?marketplace|non-?marketplace|without\s+marketplace/.test(text);
  const hasServiceSignal = /hourly|consulting|services|retainer|billable/.test(text);
  const hasTransactionSignal = /order|store|retail|checkout|basket|dine|menu|delivery/.test(text);

  const secondary = new Set<RevenueModel>();

  if (hasMarketplaceSignal && hasMarketplaceNegation) {
    evidence.push("Detected explicit non-marketplace instruction; marketplace signal was ignored.");
  }

  if (hasSubscriptionSignal) {
    if (primary === "unknown") {
      primary = "subscription";
    } else if (primary !== "subscription") {
      secondary.add("subscription");
      if (primary === "transaction_sales" || primary === "service_fees") {
        primary = "mixed";
      }
    }
    evidence.push("Subscription signals found in description.");
  }

  if (hasMarketplaceSignal && !hasMarketplaceNegation) {
    if (primary === "unknown") {
      primary = "marketplace_commission";
    } else if (primary !== "marketplace_commission") {
      secondary.add("marketplace_commission");
      if (primary === "transaction_sales" || primary === "service_fees") {
        primary = "mixed";
      }
    }
    evidence.push("Commission signals found in description.");
  }

  if (hasServiceSignal && input.businessVertical === "professional_services") {
    primary = "service_fees";
    evidence.push("Services billing signals found in description.");
  }

  if (input.businessVertical === "unknown" || input.businessVertical === "generic_other") {
    if (hasSubscriptionSignal && !hasTransactionSignal && !hasServiceSignal && !hasMarketplaceSignal) {
      primary = "subscription";
      evidence.push("Limited explicit subscription-only signal in otherwise ambiguous context.");
      ambiguities.push("Vertical is unresolved; subscription model may require confirmation.");
    } else {
      primary = "unknown";
      evidence.push("Revenue model remains unresolved because business vertical is unresolved.");
      ambiguities.push("Revenue model cannot be confidently inferred without vertical confirmation.");
    }
  }

  if (primary === "mixed") {
    const baseModel = fromVertical(input.businessVertical);
    if (baseModel !== "unknown") secondary.add(baseModel);
    if (hasSubscriptionSignal) secondary.add("subscription");
    if (hasMarketplaceSignal && !hasMarketplaceNegation) secondary.add("marketplace_commission");
    if (hasServiceSignal) secondary.add("service_fees");
  }

  const dedupSecondary = Array.from(secondary);
  const derivedComponents = new Set<RevenueComponent>(revenueComponentMap[input.businessVertical] ?? ["unknown"]);
  if (hasSubscriptionSignal) {
    derivedComponents.add("monthly_subscription");
  }
  if (hasMarketplaceSignal && !hasMarketplaceNegation) {
    derivedComponents.add("transaction_commission");
  }
  if (hasTransactionSignal) {
    derivedComponents.add("transaction_sales");
  }

  const confidence = input.businessVertical === "unknown" || input.businessVertical === "generic_other"
    ? primary === "unknown"
      ? 0.25
      : 0.45
    : primary === "mixed"
      ? 0.72
      : 0.86;

  return {
    primaryRevenueModel: primary,
    secondaryRevenueModels: dedupSecondary,
    confidence,
    evidence,
    salesChannels: salesChannelMap[input.businessVertical] ?? ["direct_sales"],
    revenueComponents: Array.from(derivedComponents),
    unresolvedAmbiguities: ambiguities,
  };
}

export function supportsSaasStylePricing(input: {
  vertical: BusinessVertical;
  revenueModel: RevenueModel;
  secondary: RevenueModel[];
}) {
  if (input.vertical === "saas_software" || input.vertical === "subscription_service") return true;
  if (input.revenueModel === "subscription") return true;
  if (input.revenueModel === "mixed" && input.secondary.includes("subscription")) return true;
  return false;
}
