import { AppError } from '@localwala/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartRepository } from '../../src/cart/cart.repository.js';
import { StagingCartRepository } from '../../src/cart/cart.repository.js';
import { CartService } from '../../src/cart/cart.service.js';
import type { CouponQuote, CouponValidator } from '../../src/cart/coupon.js';
import { StagingCouponValidator } from '../../src/cart/coupon.js';
import type { CatalogPrice, CatalogPriceSource } from '../../src/cart/price-source.js';
import { StagingCatalogPriceSource } from '../../src/cart/price-source.js';
import type { Cart, ModifierSelection } from '../../src/cart/cart.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

const cartKey = (userId: string, vertical: string) => `${userId}#${vertical}`;

class InMemoryCartRepository implements CartRepository {
  readonly carts = new Map<string, Cart>();

  async saveCart(cart: Cart): Promise<void> {
    await tick();
    this.carts.set(cartKey(cart.userId, cart.vertical), structuredClone(cart));
  }
  async findCart(userId: string, vertical: string): Promise<Cart | null> {
    await tick();
    const cart = this.carts.get(cartKey(userId, vertical));
    return cart ? structuredClone(cart) : null;
  }
  async listCarts(userId: string): Promise<Cart[]> {
    await tick();
    return [...this.carts.values()]
      .filter((cart) => cart.userId === userId)
      .map((cart) => structuredClone(cart));
  }
  async deleteCart(userId: string, vertical: string): Promise<void> {
    await tick();
    this.carts.delete(cartKey(userId, vertical));
  }
}

interface FakePrice extends Partial<CatalogPrice> {
  productId: string;
  variantId: string;
}

class FakePriceSource implements CatalogPriceSource {
  prices: FakePrice[] = [];
  calls = 0;

  async getPrice(
    productId: string,
    variantId: string,
    modifiers: ModifierSelection[],
  ): Promise<CatalogPrice> {
    this.calls += 1;
    await tick();
    const match = this.prices.find(
      (price) => price.productId === productId && price.variantId === variantId,
    );
    if (!match) {
      throw new AppError('NOT_FOUND', { message: 'Product not found.' });
    }
    const delta = modifiers.length * 10;
    return {
      name: match.name ?? `Product ${productId}`,
      price: (match.price ?? 100) + delta,
      mrp: (match.mrp ?? 120) + delta,
      ...(match.storeId !== undefined ? { storeId: match.storeId } : {}),
    };
  }
}

class FakeCouponValidator implements CouponValidator {
  quotes = new Map<string, CouponQuote>();
  calls: Array<{ code: string; itemsTotal: number }> = [];
  failure: AppError | null = null;

  async validate(code: string, itemsTotal: number): Promise<CouponQuote> {
    this.calls.push({ code, itemsTotal });
    await tick();
    if (this.failure) throw this.failure;
    const quote = this.quotes.get(code);
    if (!quote) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Coupon is not valid.',
        details: [{ path: 'code', message: 'unknown coupon' }],
      });
    }
    return quote;
  }
}

async function createCart(service: CartService, userId = 'usr_1', vertical = 'food') {
  return service.createCart({ userId, vertical });
}

async function seededCart(service: CartService, storeId?: string) {
  await createCart(service);
  const cart = await service.addItem('usr_1', 'food', {
    productId: 'prod_burger',
    variantId: 'var_regular',
    qty: 2,
    ...(storeId !== undefined ? { storeId } : {}),
  });
  return cart;
}

describe('CartService', () => {
  let repo: InMemoryCartRepository;
  let priceSource: FakePriceSource;
  let couponValidator: FakeCouponValidator;
  let service: CartService;

  beforeEach(() => {
    repo = new InMemoryCartRepository();
    priceSource = new FakePriceSource();
    couponValidator = new FakeCouponValidator();
    priceSource.prices.push({
      productId: 'prod_burger',
      variantId: 'var_regular',
      name: 'Classic Burger',
      price: 150,
      mrp: 200,
      storeId: 'store_a',
    });
    priceSource.prices.push({
      productId: 'prod_fries',
      variantId: 'var_small',
      name: 'French Fries',
      price: 99.5,
      mrp: 120,
      storeId: 'store_a',
    });
    couponValidator.quotes.set('FLAT50', { code: 'FLAT50', type: 'flat', value: 50 });
    couponValidator.quotes.set('PCT10', { code: 'PCT10', type: 'percent', value: 10 });
    service = new CartService(repo, priceSource, couponValidator);
  });

  describe('cart lifecycle', () => {
    it('creates an empty cart with generated id', async () => {
      const cart = await createCart(service);
      expect(cart.id).toMatch(/^crt_/);
      expect(cart.userId).toBe('usr_1');
      expect(cart.vertical).toBe('food');
      expect(cart.items).toEqual([]);
      expect(cart.createdAt).toBe(cart.updatedAt);
    });

    it('rejects a duplicate cart', async () => {
      await createCart(service);
      await expect(createCart(service)).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects an invalid vertical slug on create', async () => {
      await expect(
        service.createCart({ userId: 'usr_1', vertical: 'FOOD FOOD' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('returns NOT_FOUND when fetching a missing cart', async () => {
      await expect(service.getCart('usr_1', 'food')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('deletes a cart and then 404s', async () => {
      await createCart(service);
      await service.deleteCart('usr_1', 'food');
      await expect(service.getCart('usr_1', 'food')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects deleting a missing cart', async () => {
      await expect(service.deleteCart('usr_1', 'food')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('sets and clears the address id', async () => {
      await createCart(service);
      const withAddress = await service.patchCart('usr_1', 'food', {
        addressId: 'addr_9',
      });
      expect(withAddress.addressId).toBe('addr_9');
      const cleared = await service.patchCart('usr_1', 'food', { addressId: null });
      expect(cleared.addressId).toBeUndefined();
    });

    it('rejects an empty patch payload', async () => {
      await createCart(service);
      await expect(service.patchCart('usr_1', 'food', {})).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('adding items', () => {
    it('adds a line using the catalog price snapshot', async () => {
      await createCart(service);
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 2,
      });
      expect(cart.items).toHaveLength(1);
      const [item] = cart.items;
      expect(item).toMatchObject({
        name: 'Classic Burger',
        qty: 2,
        price: 150,
        mrp: 200,
        productId: 'prod_burger',
        variantId: 'var_regular',
      });
      expect(item?.id).toMatch(/^ln_/);
      expect(cart.storeId).toBe('store_a');
    });

    it('never trusts client-side prices (price source decides)', async () => {
      await createCart(service);
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        price: 1,
        mrp: 99999,
      });
      expect(cart.items[0]?.price).toBe(150);
      expect(cart.items[0]?.mrp).toBe(200);
    });

    it('merges identical variant + modifiers into one line', async () => {
      await createCart(service);
      await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 2,
      });
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 3,
      });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.qty).toBe(5);
    });

    it('merges lines when modifier option order differs', async () => {
      await createCart(service);
      await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        modifiers: [{ groupId: 'grp_top', optionIds: ['opt_a', 'opt_b'] }],
      });
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        modifiers: [{ groupId: 'grp_top', optionIds: ['opt_b', 'opt_a'] }],
      });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.qty).toBe(2);
    });

    it('keeps different modifier selections as separate lines', async () => {
      await createCart(service);
      await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        modifiers: [{ groupId: 'grp_top', optionIds: ['opt_cheese'] }],
      });
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        modifiers: [{ groupId: 'grp_top', optionIds: ['opt_bacon'] }],
      });
      expect(cart.items).toHaveLength(2);
    });

    it('applies modifier price deltas from the price source', async () => {
      await createCart(service);
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        modifiers: [{ groupId: 'grp_top', optionIds: ['opt_cheese'] }],
      });
      expect(cart.items[0]?.price).toBe(160);
      expect(cart.items[0]?.mrp).toBe(210);
    });

    it('refreshes the snapshot on merge', async () => {
      await createCart(service);
      await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
      });
      priceSource.prices[0] = { ...priceSource.prices[0]!, price: 175, mrp: 220 };
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
      });
      expect(cart.items[0]?.price).toBe(175);
      expect(cart.items[0]?.mrp).toBe(220);
    });

    it('stores per-line instructions', async () => {
      await createCart(service);
      const cart = await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 1,
        instructions: 'extra napkins',
      });
      expect(cart.items[0]?.instructions).toBe('extra napkins');
    });

    it('rejects merging past the per-line quantity cap', async () => {
      await createCart(service);
      await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 98,
      });
      await expect(
        service.addItem('usr_1', 'food', {
          productId: 'prod_burger',
          variantId: 'var_regular',
          qty: 3,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects more than 50 distinct lines', async () => {
      await createCart(service);
      for (let index = 0; index < 50; index += 1) {
        priceSource.prices.push({
          productId: `prod_${index}`,
          variantId: 'var_regular',
        });
        await service.addItem('usr_1', 'food', {
          productId: `prod_${index}`,
          variantId: 'var_regular',
          qty: 1,
        });
      }
      priceSource.prices.push({
        productId: 'prod_overflow',
        variantId: 'var_regular',
      });
      await expect(
        service.addItem('usr_1', 'food', {
          productId: 'prod_overflow',
          variantId: 'var_regular',
          qty: 1,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects items from a different store', async () => {
      await seededCart(service, 'store_a');
      await expect(
        service.addItem('usr_1', 'food', {
          productId: 'prod_fries',
          variantId: 'var_small',
          qty: 1,
          storeId: 'store_b',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects adding to a missing cart', async () => {
      await expect(
        service.addItem('usr_1', 'food', {
          productId: 'prod_burger',
          variantId: 'var_regular',
          qty: 1,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects qty below one', async () => {
      await createCart(service);
      await expect(
        service.addItem('usr_1', 'food', {
          productId: 'prod_burger',
          variantId: 'var_regular',
          qty: 0,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('patching and removing items', () => {
    it('updates line quantity', async () => {
      const cart = await seededCart(service);
      const itemId = cart.items[0]!.id;
      const updated = await service.patchItem('usr_1', 'food', itemId, { qty: 7 });
      expect(updated.items[0]?.qty).toBe(7);
    });

    it('sets and clears line instructions', async () => {
      const cart = await seededCart(service);
      const itemId = cart.items[0]!.id;
      const withText = await service.patchItem('usr_1', 'food', itemId, {
        instructions: 'no onion',
      });
      expect(withText.items[0]?.instructions).toBe('no onion');
      const cleared = await service.patchItem('usr_1', 'food', itemId, {
        instructions: null,
      });
      expect(cleared.items[0]?.instructions).toBeUndefined();
    });

    it('rejects a patch payload with no fields', async () => {
      const cart = await seededCart(service);
      await expect(service.patchItem('usr_1', 'food', cart.items[0]!.id, {})).rejects.toMatchObject(
        { code: 'VALIDATION_ERROR' },
      );
    });

    it('returns NOT_FOUND for an unknown line', async () => {
      await createCart(service);
      await expect(
        service.patchItem('usr_1', 'food', 'ln_missing', { qty: 2 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('removes a line', async () => {
      const cart = await seededCart(service);
      const removed = await service.removeItem('usr_1', 'food', cart.items[0]!.id);
      expect(removed.items).toHaveLength(0);
      expect(removed.storeId).toBeUndefined();
    });

    it('clears store and coupon when the last line is removed', async () => {
      const cart = await seededCart(service, 'store_a');
      await service.applyCoupon('usr_1', 'food', { code: 'FLAT50' });
      const cleared = await service.removeItem('usr_1', 'food', cart.items[0]!.id);
      expect(cleared.storeId).toBeUndefined();
      expect(cleared.coupon).toBeUndefined();
    });

    it('returns NOT_FOUND when removing an unknown line', async () => {
      await createCart(service);
      await expect(service.removeItem('usr_1', 'food', 'ln_missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('coupons', () => {
    it('applies a validated flat coupon', async () => {
      await seededCart(service);
      const cart = await service.applyCoupon('usr_1', 'food', { code: 'FLAT50' });
      expect(cart.coupon).toEqual({ code: 'FLAT50', type: 'flat', value: 50 });
      expect(couponValidator.calls).toEqual([{ code: 'FLAT50', itemsTotal: 300 }]);
    });

    it('rejects a coupon on an empty cart before calling the validator', async () => {
      await createCart(service);
      await expect(service.applyCoupon('usr_1', 'food', { code: 'FLAT50' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(couponValidator.calls).toHaveLength(0);
    });

    it('propagates validator failures', async () => {
      await seededCart(service);
      couponValidator.failure = new AppError('SERVICE_UNAVAILABLE', {
        message: 'promotion-service integration pending',
      });
      await expect(service.applyCoupon('usr_1', 'food', { code: 'FLAT50' })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('rejects an unknown coupon', async () => {
      await seededCart(service);
      await expect(service.applyCoupon('usr_1', 'food', { code: 'NOPE99' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects a malformed coupon code', async () => {
      await seededCart(service);
      await expect(service.applyCoupon('usr_1', 'food', { code: 'ab' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('clears an applied coupon', async () => {
      await seededCart(service);
      await service.applyCoupon('usr_1', 'food', { code: 'FLAT50' });
      const cleared = await service.clearCoupon('usr_1', 'food');
      expect(cleared.coupon).toBeUndefined();
    });
  });

  describe('pricing', () => {
    it('computes totals from line snapshots', async () => {
      await createCart(service);
      await service.addItem('usr_1', 'food', {
        productId: 'prod_burger',
        variantId: 'var_regular',
        qty: 2,
      });
      await service.addItem('usr_1', 'food', {
        productId: 'prod_fries',
        variantId: 'var_small',
        qty: 1,
      });
      const pricing = await service.getPricing('usr_1', 'food');
      expect(pricing.itemsTotal).toBe(399.5);
      expect(pricing.mrpTotal).toBe(520);
      expect(pricing.savings).toBe(120.5);
      expect(pricing.couponDiscount).toBe(0);
      expect(pricing.grandTotal).toBe(399.5);
    });

    it('applies a flat coupon discount to the grand total', async () => {
      await seededCart(service);
      await service.applyCoupon('usr_1', 'food', { code: 'FLAT50' });
      const pricing = await service.getPricing('usr_1', 'food');
      expect(pricing.couponDiscount).toBe(50);
      expect(pricing.grandTotal).toBe(250);
    });

    it('applies a percent coupon discount', async () => {
      await seededCart(service);
      await service.applyCoupon('usr_1', 'food', { code: 'PCT10' });
      const pricing = await service.getPricing('usr_1', 'food');
      expect(pricing.couponDiscount).toBe(30);
      expect(pricing.grandTotal).toBe(270);
    });

    it('caps the discount at the items total', async () => {
      priceSource.prices[0] = { ...priceSource.prices[0]!, price: 20 };
      await seededCart(service);
      couponValidator.quotes.set('HUGE', { code: 'HUGE', type: 'flat', value: 5000 });
      await service.applyCoupon('usr_1', 'food', { code: 'HUGE' });
      const pricing = await service.getPricing('usr_1', 'food');
      expect(pricing.couponDiscount).toBe(40);
      expect(pricing.grandTotal).toBe(0);
    });

    it('floors savings at zero when price exceeds mrp', async () => {
      await createCart(service);
      priceSource.prices.push({
        productId: 'prod_premium',
        variantId: 'var_one',
        price: 500,
        mrp: 400,
      });
      await service.addItem('usr_1', 'food', {
        productId: 'prod_premium',
        variantId: 'var_one',
        qty: 1,
      });
      const pricing = await service.getPricing('usr_1', 'food');
      expect(pricing.savings).toBe(0);
    });

    it('returns zeros for an empty cart', async () => {
      await createCart(service);
      const pricing = await service.getPricing('usr_1', 'food');
      expect(pricing).toEqual({
        itemsTotal: 0,
        mrpTotal: 0,
        savings: 0,
        couponDiscount: 0,
        grandTotal: 0,
      });
    });
  });

  describe('checkout readiness', () => {
    it('reports both reasons for an empty cart without an address', async () => {
      await createCart(service);
      const readiness = await service.getReadiness('usr_1', 'food');
      expect(readiness.ready).toBe(false);
      expect(readiness.reasons).toEqual(['cart_empty', 'missing_address']);
      expect(readiness.itemCount).toBe(0);
    });

    it('reports only missing_address when items exist', async () => {
      await seededCart(service);
      const readiness = await service.getReadiness('usr_1', 'food');
      expect(readiness.ready).toBe(false);
      expect(readiness.reasons).toEqual(['missing_address']);
      expect(readiness.itemCount).toBe(2);
    });

    it('is ready with items and an address', async () => {
      await seededCart(service);
      await service.patchCart('usr_1', 'food', { addressId: 'addr_1' });
      const readiness = await service.getReadiness('usr_1', 'food');
      expect(readiness.ready).toBe(true);
      expect(readiness.reasons).toEqual([]);
      expect(readiness.pricing.grandTotal).toBe(300);
    });
  });

  describe('concurrency', () => {
    it('serializes parallel adds to the same cart', async () => {
      await createCart(service);
      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.addItem('usr_1', 'food', {
            productId: 'prod_fries',
            variantId: 'var_small',
            qty: 1,
          }),
        ),
      );
      const cart = await service.getCart('usr_1', 'food');
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.qty).toBe(5);
    });

    it('keeps distinct lines under parallel adds', async () => {
      await createCart(service);
      await Promise.all([
        service.addItem('usr_1', 'food', {
          productId: 'prod_burger',
          variantId: 'var_regular',
          qty: 1,
        }),
        service.addItem('usr_1', 'food', {
          productId: 'prod_fries',
          variantId: 'var_small',
          qty: 1,
        }),
      ]);
      const cart = await service.getCart('usr_1', 'food');
      expect(cart.items).toHaveLength(2);
    });
  });

  describe('staging adapters', () => {
    it('blocks cart repository operations with 503', async () => {
      const staging = new StagingCartRepository();
      await expect(staging.findCart('usr_1', 'food')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
      await expect(staging.saveCart({} as Cart)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(staging.deleteCart('usr_1', 'food')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('blocks catalog price lookups with 503', async () => {
      const staging = new StagingCatalogPriceSource();
      await expect(staging.getPrice('p', 'v', [])).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('blocks coupon validation with 503', async () => {
      const staging = new StagingCouponValidator();
      await expect(staging.validate('FLAT50', 100)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('surfaces 503 through the service when the repository is staging', async () => {
      const stagingService = new CartService(
        new StagingCartRepository(),
        priceSource,
        couponValidator,
      );
      await expect(stagingService.getCart('usr_1', 'food')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});
