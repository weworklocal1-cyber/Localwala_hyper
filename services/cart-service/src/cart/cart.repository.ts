import { AppError } from '@localwala/errors';
import type { Cart } from './cart.types.js';

export interface CartRepository {
  saveCart(cart: Cart): Promise<void>;
  findCart(userId: string, vertical: string): Promise<Cart | null>;
  listCarts(userId: string): Promise<Cart[]>;
  deleteCart(userId: string, vertical: string): Promise<void>;
}

/**
 * STAGING ONLY — Redis cart store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingCartRepository implements CartRepository {
  async saveCart(): Promise<void> {
    this.blocked('saveCart');
  }
  async findCart(): Promise<null> {
    this.blocked('findCart');
    return null;
  }
  async listCarts(): Promise<[]> {
    this.blocked('listCarts');
    return [];
  }
  async deleteCart(): Promise<void> {
    this.blocked('deleteCart');
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Cart repository not configured: ${op} blocked — Redis not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
