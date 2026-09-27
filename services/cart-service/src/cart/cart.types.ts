import { randomUUID } from 'node:crypto';

export const MODIFIER_GROUP_PATTERN = '^[A-Za-z0-9._-]{1,64}$';

export interface ModifierSelection {
  groupId: string;
  optionIds: string[];
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  qty: number;
  price: number;
  mrp: number;
  modifiers: ModifierSelection[];
  instructions?: string;
}

export interface AppliedCoupon {
  code: string;
  type: 'flat' | 'percent';
  value: number;
}

export interface Cart {
  id: string;
  userId: string;
  vertical: string;
  storeId?: string;
  addressId?: string;
  items: CartItem[];
  coupon?: AppliedCoupon;
  createdAt: number;
  updatedAt: number;
}

export interface PricingBreakdown {
  itemsTotal: number;
  mrpTotal: number;
  savings: number;
  couponDiscount: number;
  grandTotal: number;
}

export interface CheckoutReadiness {
  ready: boolean;
  reasons: string[];
  itemCount: number;
  pricing: PricingBreakdown;
}

export const USER_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const VERTICAL_PATTERN = '^[a-z0-9][a-z0-9-]{0,31}$';

export const MAX_ITEM_QTY = 99;
export const MAX_CART_LINES = 50;

export function cartLineKey(
  productId: string,
  variantId: string,
  modifiers: ModifierSelection[],
): string {
  const modifierPart = [...modifiers]
    .map((selection) => `${selection.groupId}:${[...selection.optionIds].sort().join('+')}`)
    .sort()
    .join('|');
  return `${productId}:${variantId}::${modifierPart}`;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function newCartId(): string {
  return `crt_${randomUUID().replace(/-/g, '')}`;
}

export function newLineId(): string {
  return `ln_${randomUUID().replace(/-/g, '')}`;
}
