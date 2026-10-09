/** From defect-tech/01-strategy/pricing.md. Keep the two in step. */
export type PriceRow = {
  who: string;
  upFront: [number, number];
  monthly: [number, number];
};

export const FREELANCER: PriceRow = { who: "A freelancer", upFront: [1500, 8000], monthly: [50, 200] };
export const DEFECT: PriceRow = { who: "defect.tech", upFront: [0, 0], monthly: [59, 59] };

export const YEARLY_PRICE = 590;

export const FREELANCER_SOURCE = {
  label: "Surmado's 2026 small-business website cost guide",
  href: "https://www.surmado.com/blog/how-much-does-a-small-business-website-cost-2026",
};

export function firstYear(row: PriceRow): [number, number] {
  return [row.upFront[0] + 12 * row.monthly[0], row.upFront[1] + 12 * row.monthly[1]];
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function priceRange([low, high]: [number, number]): string {
  return low === high ? dollars.format(low) : `${dollars.format(low)} to ${dollars.format(high)}`;
}
