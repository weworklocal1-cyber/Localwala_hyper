import { AppError } from '@localwala/errors';
import type { CatalogPriceSource } from './price-source.js';
import type { CouponValidator } from './coupon.js';
import type { CartRepository } from './cart.repository.js';
import { KeyedMutex } from './keyed-mutex.js';
import {
  cartLineKey,
  newCartId,
  newLineId,
  roundMoney,
  MAX_CART_LINES,
  MAX_ITEM_QTY,
  type Cart,
  type CartItem,
  type CheckoutReadiness,
  type PricingBreakdown,
} from './cart.types.js';
import {
  parseAddItem,
  parseApplyCoupon,
  parseCartRef,
  parseCreateCart,
  parsePatchCart,
  parsePatchItem,
} from '../schemas/cart.schema.js';

function cartLockKey(userId: string, vertical: string): string {
  return `cart:${userId}:${vertical}`;
}

export class CartService {
  private readonly mutex = new KeyedMutex();

  constructor(
    private readonly repo: CartRepository,
    private readonly priceSource: CatalogPriceSource,
    private readonly couponValidator: CouponValidator,
  ) {}

  async createCart(input: unknown): Promise<Cart> {
    const parsed = parseCreateCart(input);
    const existing = await this.repo.findCart(parsed.userId, parsed.vertical);
    if (existing) {
      throw new AppError('CONFLICT', {
        message: 'Cart already exists for this user and vertical.',
        details: { userId: parsed.userId, vertical: parsed.vertical },
      });
    }
    const now = Date.now();
    const cart: Cart = {
      id: newCartId(),
      userId: parsed.userId,
      vertical: parsed.vertical,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.saveCart(cart);
    return cart;
  }

  async getCart(userId: string, vertical: string): Promise<Cart> {
    parseCartRef(userId, vertical);
    const cart = await this.repo.findCart(userId, vertical);
    if (!cart) {
      throw new AppError('NOT_FOUND', { message: 'Cart not found.' });
    }
    return cart;
  }

  async getPricing(userId: string, vertical: string): Promise<PricingBreakdown> {
    return this.computePricing(await this.getCart(userId, vertical));
  }

  async deleteCart(userId: string, vertical: string): Promise<void> {
    parseCartRef(userId, vertical);
    const cart = await this.repo.findCart(userId, vertical);
    if (!cart) {
      throw new AppError('NOT_FOUND', { message: 'Cart not found.' });
    }
    await this.repo.deleteCart(userId, vertical);
  }

  async patchCart(userId: string, vertical: string, input: unknown): Promise<Cart> {
    const parsed = parsePatchCart(input);
    return this.mutex.run(cartLockKey(userId, vertical), async () => {
      const cart = await this.getCart(userId, vertical);
      if (parsed.addressId === null) delete cart.addressId;
      else cart.addressId = parsed.addressId;
      cart.updatedAt = Date.now();
      await this.repo.saveCart(cart);
      return cart;
    });
  }

  async addItem(userId: string, vertical: string, input: unknown): Promise<Cart> {
    const parsed = parseAddItem(input);
    return this.mutex.run(cartLockKey(userId, vertical), async () => {
      const cart = await this.getCart(userId, vertical);
      const price = await this.priceSource.getPrice(
        parsed.productId,
        parsed.variantId,
        parsed.modifiers,
      );
      const incomingStoreId = parsed.storeId ?? price.storeId;
      if (
        cart.storeId !== undefined &&
        incomingStoreId !== undefined &&
        cart.storeId !== incomingStoreId
      ) {
        throw new AppError('CONFLICT', {
          message: 'Cart contains items from another store. Clear the cart first.',
          details: { cartStoreId: cart.storeId, incomingStoreId },
        });
      }

      const key = cartLineKey(parsed.productId, parsed.variantId, parsed.modifiers);
      const existing = cart.items.find(
        (item) => cartLineKey(item.productId, item.variantId, item.modifiers) === key,
      );

      if (existing) {
        const nextQty = existing.qty + parsed.qty;
        if (nextQty > MAX_ITEM_QTY) {
          throw new AppError('CONFLICT', {
            message: `Quantity per line cannot exceed ${MAX_ITEM_QTY}.`,
            details: { variantId: parsed.variantId, requestedQty: nextQty },
          });
        }
        existing.qty = nextQty;
        existing.price = price.price;
        existing.mrp = price.mrp;
        existing.name = price.name;
        if (parsed.instructions !== undefined) existing.instructions = parsed.instructions;
      } else {
        if (cart.items.length >= MAX_CART_LINES) {
          throw new AppError('CONFLICT', {
            message: `Cart cannot hold more than ${MAX_CART_LINES} lines.`,
            details: { lines: cart.items.length },
          });
        }
        const item: CartItem = {
          id: newLineId(),
          productId: parsed.productId,
          variantId: parsed.variantId,
          name: price.name,
          qty: parsed.qty,
          price: price.price,
          mrp: price.mrp,
          modifiers: parsed.modifiers,
        };
        if (parsed.instructions !== undefined) item.instructions = parsed.instructions;
        cart.items.push(item);
      }

      if (cart.storeId === undefined && incomingStoreId !== undefined) {
        cart.storeId = incomingStoreId;
      }

      cart.updatedAt = Date.now();
      await this.repo.saveCart(cart);
      return cart;
    });
  }

  async patchItem(userId: string, vertical: string, itemId: string, input: unknown): Promise<Cart> {
    const parsed = parsePatchItem(input);
    return this.mutex.run(cartLockKey(userId, vertical), async () => {
      const cart = await this.getCart(userId, vertical);
      const item = cart.items.find((entry) => entry.id === itemId);
      if (!item) {
        throw new AppError('NOT_FOUND', { message: 'Cart item not found.' });
      }
      if (parsed.qty !== undefined) item.qty = parsed.qty;
      if (parsed.instructions !== undefined) {
        if (parsed.instructions === null) delete item.instructions;
        else item.instructions = parsed.instructions;
      }
      cart.updatedAt = Date.now();
      await this.repo.saveCart(cart);
      return cart;
    });
  }

  async removeItem(userId: string, vertical: string, itemId: string): Promise<Cart> {
    return this.mutex.run(cartLockKey(userId, vertical), async () => {
      const cart = await this.getCart(userId, vertical);
      const index = cart.items.findIndex((entry) => entry.id === itemId);
      if (index === -1) {
        throw new AppError('NOT_FOUND', { message: 'Cart item not found.' });
      }
      cart.items.splice(index, 1);
      if (cart.items.length === 0) {
        delete cart.storeId;
        delete cart.coupon;
      }
      cart.updatedAt = Date.now();
      await this.repo.saveCart(cart);
      return cart;
    });
  }

  async applyCoupon(userId: string, vertical: string, input: unknown): Promise<Cart> {
    const parsed = parseApplyCoupon(input);
    return this.mutex.run(cartLockKey(userId, vertical), async () => {
      const cart = await this.getCart(userId, vertical);
      if (cart.items.length === 0) {
        throw new AppError('VALIDATION_ERROR', {
          message: 'Request payload failed validation',
          details: [{ path: 'code', message: 'cannot apply a coupon to an empty cart' }],
        });
      }
      const pricing = this.computePricing(cart);
      const quote = await this.couponValidator.validate(parsed.code, pricing.itemsTotal);
      cart.coupon = { code: quote.code, type: quote.type, value: quote.value };
      cart.updatedAt = Date.now();
      await this.repo.saveCart(cart);
      return cart;
    });
  }

  async clearCoupon(userId: string, vertical: string): Promise<Cart> {
    return this.mutex.run(cartLockKey(userId, vertical), async () => {
      const cart = await this.getCart(userId, vertical);
      delete cart.coupon;
      cart.updatedAt = Date.now();
      await this.repo.saveCart(cart);
      return cart;
    });
  }

  async getReadiness(userId: string, vertical: string): Promise<CheckoutReadiness> {
    const cart = await this.getCart(userId, vertical);
    const pricing = this.computePricing(cart);
    const reasons: string[] = [];
    if (cart.items.length === 0) reasons.push('cart_empty');
    if (cart.addressId === undefined) reasons.push('missing_address');
    return {
      ready: reasons.length === 0,
      reasons,
      itemCount: cart.items.reduce((total, item) => total + item.qty, 0),
      pricing,
    };
  }

  computePricing(cart: Cart): PricingBreakdown {
    const itemsTotal = roundMoney(
      cart.items.reduce((total, item) => total + item.price * item.qty, 0),
    );
    const mrpTotal = roundMoney(cart.items.reduce((total, item) => total + item.mrp * item.qty, 0));
    let couponDiscount = 0;
    if (cart.coupon !== undefined) {
      const raw =
        cart.coupon.type === 'flat' ? cart.coupon.value : (itemsTotal * cart.coupon.value) / 100;
      couponDiscount = roundMoney(Math.min(Math.max(raw, 0), itemsTotal));
    }
    const savings = roundMoney(Math.max(mrpTotal - itemsTotal, 0));
    return {
      itemsTotal,
      mrpTotal,
      savings,
      couponDiscount,
      grandTotal: roundMoney(itemsTotal - couponDiscount),
    };
  }
}
