export const PRICING_VERSION = 'PFSA-PRICING-2026-11-12-V2';
export const DOCUMENT_PRICES = { experience: 350, recommendation: 300, bundle: 500 } as const;
export type DocumentPackage = keyof typeof DOCUMENT_PRICES;
export const documentPrice = (pack: DocumentPackage) => DOCUMENT_PRICES[pack];
export const BUNDLE_SAVINGS = DOCUMENT_PRICES.experience + DOCUMENT_PRICES.recommendation - DOCUMENT_PRICES.bundle;
