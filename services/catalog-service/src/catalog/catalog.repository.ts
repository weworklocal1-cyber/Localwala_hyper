import { AppError } from '@localwala/errors';
import type { Category, Product } from './catalog.types.js';

export interface CatalogRepository {
  saveCategory(category: Category): Promise<void>;
  findCategoryById(id: string): Promise<Category | null>;
  findCategoryByKey(key: string): Promise<Category | null>;
  listCategories(): Promise<Category[]>;
  deleteCategory(id: string): Promise<void>;
  saveProduct(product: Product): Promise<void>;
  findProductById(id: string): Promise<Product | null>;
  findProductByKey(key: string): Promise<Product | null>;
  listProducts(): Promise<Product[]>;
  deleteProduct(id: string): Promise<void>;
}

/**
 * STAGING ONLY — MongoDB repository not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingCatalogRepository implements CatalogRepository {
  async saveCategory(): Promise<void> {
    this.blocked('saveCategory');
  }
  async findCategoryById(): Promise<null> {
    this.blocked('findCategoryById');
    return null;
  }
  async findCategoryByKey(): Promise<null> {
    this.blocked('findCategoryByKey');
    return null;
  }
  async listCategories(): Promise<[]> {
    this.blocked('listCategories');
    return [];
  }
  async deleteCategory(): Promise<void> {
    this.blocked('deleteCategory');
  }
  async saveProduct(): Promise<void> {
    this.blocked('saveProduct');
  }
  async findProductById(): Promise<null> {
    this.blocked('findProductById');
    return null;
  }
  async findProductByKey(): Promise<null> {
    this.blocked('findProductByKey');
    return null;
  }
  async listProducts(): Promise<[]> {
    this.blocked('listProducts');
    return [];
  }
  async deleteProduct(): Promise<void> {
    this.blocked('deleteProduct');
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Catalog repository not configured: ${op} blocked — MongoDB not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
