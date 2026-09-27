import { AppError } from '@localwala/errors';
import type {
  AddressSnapshot,
  OrderItemSnapshot,
  PartnerSnapshot,
  PricingSnapshot,
} from './order.types.js';

export interface CheckoutPayload {
  items: OrderItemSnapshot[];
  pricing: PricingSnapshot;
  couponCode?: string;
  storeId?: string;
  partner?: PartnerSnapshot;
  address: AddressSnapshot;
}

export interface CheckoutSource {
  load(userId: string, vertical: string, addressId: string): Promise<CheckoutPayload>;
}

/**
 * STAGING ONLY — checkout composition (cart + address + partner snapshots)
 * not wired yet. Throws SERVICE_UNAVAILABLE (503): orders must never trust
 * client-submitted items, prices or addresses.
 */
export class StagingCheckoutSource implements CheckoutSource {
  async load(): Promise<CheckoutPayload> {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: 'Checkout source not configured — cart/user/store integrations pending.',
      retryable: false,
    });
  }
}
