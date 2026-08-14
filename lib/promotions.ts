// ──────────────────────────────────────────────────────────────────
// lib/promotions.ts
//
// Single source of truth for what a digital product costs right now.
//
// Order of operations matters and is the whole reason this file exists:
//
//   list price  ->  sale price (if a sale is live)  ->  promo code discount
//   ->  grossUpForStripe(result)
//
// The discount lands on the creator's price. The gross up runs last, on the
// already discounted amount. Done the other way around (or by handing Stripe a
// native Coupon, which applies to the total), the discount would come partly out
// of the card fee the fan is supposed to be covering, and the creator would net
// less than the sale price they set.
//
// Nothing here trusts a number from the browser. The purchase route recomputes
// every one of these from the database row before it builds a Stripe session.
// ──────────────────────────────────────────────────────────────────

import { grossUpForStripe } from "@/lib/fees";

/** Stripe will not process a card charge below 50 cents. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

export type PromoKind = "percent" | "fixed";
export type PromoScope = "all" | "product";

export type PromoCodeRow = {
  id: string;
  creator_profile_id: string;
  code: string;
  kind: PromoKind;
  value: number;
  scope: PromoScope;
  digital_product_id: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export type PricedProduct = {
  id: string;
  price: number | string;
  sale_price?: number | string | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
};

/**
 * Codes are typed by hand, on a phone, from a screenshot. Match forgivingly:
 * uppercase, and drop everything that is not a letter or a digit so a stray
 * space or a smart quote does not read as "invalid code".
 */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

function cents(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function withinWindow(startsAt: string | null | undefined, endsAt: string | null | undefined, now: Date): boolean {
  if (startsAt && new Date(startsAt).getTime() > now.getTime()) return false;
  if (endsAt && new Date(endsAt).getTime() <= now.getTime()) return false;
  return true;
}

/** Is a sale price set and inside its window right now. */
export function saleIsLive(product: PricedProduct, now: Date = new Date()): boolean {
  if (product.sale_price === null || product.sale_price === undefined) return false;
  const sale = cents(product.sale_price);
  if (sale >= cents(product.price)) return false;
  return withinWindow(product.sale_starts_at, product.sale_ends_at, now);
}

/**
 * What the product costs before any promo code: the sale price if a sale is
 * running, otherwise the list price. In cents.
 */
export function listPriceCents(product: PricedProduct, now: Date = new Date()): number {
  return saleIsLive(product, now) ? cents(product.sale_price) : cents(product.price);
}

export type PromoCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Every reason a code can be refused, in words a buyer can act on. Deliberately
 * vague about codes that belong to a different creator: "not valid here" rather
 * than confirming the code exists somewhere.
 */
export function checkPromo(
  code: PromoCodeRow,
  product: PricedProduct & { creator_profile_id?: string },
  now: Date = new Date()
): PromoCheck {
  if (!code.active) return { ok: false, reason: "That code is no longer active." };

  if (product.creator_profile_id && code.creator_profile_id !== product.creator_profile_id) {
    return { ok: false, reason: "That code is not valid for this product." };
  }

  if (code.scope === "product" && code.digital_product_id !== product.id) {
    return { ok: false, reason: "That code is not valid for this product." };
  }

  if (code.starts_at && new Date(code.starts_at).getTime() > now.getTime()) {
    return { ok: false, reason: "That code is not active yet." };
  }

  if (code.ends_at && new Date(code.ends_at).getTime() <= now.getTime()) {
    return { ok: false, reason: "That code has expired." };
  }

  if (code.max_redemptions !== null && code.redemption_count >= code.max_redemptions) {
    return { ok: false, reason: "That code has been fully claimed." };
  }

  return { ok: true };
}

/** How much a code takes off a given price, in cents. Never more than the price. */
export function discountCents(listCents: number, code: Pick<PromoCodeRow, "kind" | "value">): number {
  const raw =
    code.kind === "percent"
      ? Math.round((listCents * Number(code.value)) / 100)
      : Math.round(Number(code.value) * 100);
  return Math.max(0, Math.min(listCents, raw));
}

export type Quote = {
  /** Price before any code, in cents. Reflects a live sale. */
  listCents: number;
  /** The product's undiscounted price, in cents. Only differs when a sale is live. */
  fullCents: number;
  /** Taken off by the code, in cents. Zero when no code applied. */
  discountCents: number;
  /** What the creator nets, in cents. The discount comes out of this, by design. */
  netCents: number;
  /** What the fan is charged, in cents. Net plus the card fee, or zero when free. */
  fanCents: number;
  /** True when the result is free and no card charge should be attempted. */
  free: boolean;
  /** True when the result is above zero but under Stripe's 50 cent floor. */
  belowStripeMinimum: boolean;
  saleLive: boolean;
};

/**
 * The one function that prices a purchase. Pass the promo row only after
 * checkPromo has passed.
 */
export function quote(
  product: PricedProduct,
  code: PromoCodeRow | null,
  now: Date = new Date()
): Quote {
  const fullCents = cents(product.price);
  const listCents = listPriceCents(product, now);
  const off = code ? discountCents(listCents, code) : 0;
  const netCents = Math.max(0, listCents - off);
  const free = netCents === 0;

  return {
    listCents,
    fullCents,
    discountCents: off,
    netCents,
    fanCents: free ? 0 : grossUpForStripe(netCents),
    free,
    belowStripeMinimum: !free && netCents < STRIPE_MIN_CHARGE_CENTS,
    saleLive: saleIsLive(product, now),
  };
}

/** "25% off" / "$5 off". For buttons and badges. */
export function describeDiscount(code: Pick<PromoCodeRow, "kind" | "value">): string {
  return code.kind === "percent"
    ? `${Number(code.value)}% off`
    : `$${Number(code.value).toFixed(2)} off`;
}

export function usd(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}
