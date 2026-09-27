import { AppError } from '@localwala/errors';
import type { ModifierSelection } from './cart.types.js';

export interface CatalogPrice {
  name: string;
  price: number;
  mrp: number;
  storeId?: string;
}

export interface CatalogPriceSource {
  getPrice(
    productId: string,
    variantId: string,
    modifiers: ModifierSelection[],
  ): Promise<CatalogPrice>;
}

/**
 * STAGING ONLY — catalog-service price lookup not wired yet.
 * Throws SERVICE_UNAVAILABLE (503): carts must never trust client-supplied prices.
 */
export class StagingCatalogPriceSource implements CatalogPriceSource {
  async getPrice(): Promise<CatalogPrice> {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: 'Catalog price source not configured — catalog-service integration pending.',
      retryable: false,
    });
  }
}
