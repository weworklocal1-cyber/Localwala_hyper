import { AppError } from '@localwala/errors';
import type { Order, OrderStatus } from './order.types.js';

export interface OrderQuery {
  userId?: string;
  status?: OrderStatus;
  limit?: number;
}

export interface OrderRepository {
  saveOrder(order: Order): Promise<void>;
  findOrderById(orderId: string): Promise<Order | null>;
  findOrderByIdempotencyKey(key: string): Promise<Order | null>;
  listOrders(query: OrderQuery): Promise<Order[]>;
}

/**
 * STAGING ONLY — PostgreSQL order store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingOrderRepository implements OrderRepository {
  async saveOrder(): Promise<void> {
    this.blocked('saveOrder');
  }
  async findOrderById(): Promise<null> {
    this.blocked('findOrderById');
    return null;
  }
  async findOrderByIdempotencyKey(): Promise<null> {
    this.blocked('findOrderByIdempotencyKey');
    return null;
  }
  async listOrders(): Promise<[]> {
    this.blocked('listOrders');
    return [];
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Order repository not configured: ${op} blocked — PostgreSQL not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
