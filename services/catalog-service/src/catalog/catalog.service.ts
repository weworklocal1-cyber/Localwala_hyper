import { AppError } from '@localwala/errors';
import {
  parseCreateCategory,
  parseCreateProduct,
  parseUpdateCategory,
  parseUpdateProduct,
  parseUpdateVariant,
} from '../schemas/catalog.schema.js';
import type { CatalogRepository } from './catalog.repository.js';
import {
  PRODUCT_STATUS_TRANSITIONS,
  newId,
  type Category,
  type CategoryNode,
  type ModifierGroup,
  type Product,
  type ProductStatus,
  type Variant,
} from './catalog.types.js';

export interface CategoryListFilter {
  parentId?: string;
  vertical?: string;
  visible?: boolean;
  key?: string;
}

export interface ProductListFilter {
  categoryId?: string;
  status?: ProductStatus;
  available?: boolean;
  q?: string;
  limit?: number;
}

export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  async createCategory(input: unknown): Promise<Category> {
    const parsed = parseCreateCategory(input);
    if (parsed.parentId) {
      const parent = await this.repo.findCategoryById(parsed.parentId);
      if (!parent) {
        throw new AppError('NOT_FOUND', {
          message: `Parent category ${parsed.parentId} not found`,
        });
      }
    }
    const duplicate = await this.repo.findCategoryByKey(parsed.key);
    if (duplicate) {
      throw new AppError('CONFLICT', { message: `Category key "${parsed.key}" already exists` });
    }
    const now = Date.now();
    const category: Category = {
      id: newId('cat'),
      key: parsed.key,
      name: parsed.name,
      description: parsed.description,
      parentId: parsed.parentId,
      vertical: parsed.vertical,
      order: parsed.order ?? 0,
      visible: parsed.visible ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.saveCategory(category);
    return category;
  }

  async getCategory(id: string): Promise<Category> {
    const category = await this.repo.findCategoryById(id);
    if (!category) {
      throw new AppError('NOT_FOUND', { message: `Category ${id} not found` });
    }
    return category;
  }

  async listCategories(filter: CategoryListFilter = {}): Promise<Category[]> {
    const categories = await this.repo.listCategories();
    return categories
      .filter(
        (category) =>
          (filter.parentId === undefined || category.parentId === filter.parentId) &&
          (filter.vertical === undefined || category.vertical === filter.vertical) &&
          (filter.visible === undefined || category.visible === filter.visible) &&
          (filter.key === undefined || category.key === filter.key),
      )
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async getCategoryTree(): Promise<CategoryNode[]> {
    const categories = await this.repo.listCategories();
    const nodes = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodes.set(category.id, { ...category, children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    const sortNodes = (list: CategoryNode[]): CategoryNode[] => {
      list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      for (const node of list) sortNodes(node.children);
      return list;
    };
    return sortNodes(roots);
  }

  async updateCategory(id: string, input: unknown): Promise<Category> {
    const parsed = parseUpdateCategory(input);
    const category = await this.getCategory(id);
    if (parsed.parentId !== undefined) {
      if (parsed.parentId === null) {
        category.parentId = undefined;
      } else if (parsed.parentId === id) {
        throw new AppError('CONFLICT', { message: 'A category cannot be its own parent' });
      } else {
        const parent = await this.repo.findCategoryById(parsed.parentId);
        if (!parent) {
          throw new AppError('NOT_FOUND', {
            message: `Parent category ${parsed.parentId} not found`,
          });
        }
        if (await this.isDescendant(id, parsed.parentId)) {
          throw new AppError('CONFLICT', {
            message: 'Parent would create a cycle in the category tree',
          });
        }
        category.parentId = parsed.parentId;
      }
    }
    category.name = parsed.name ?? category.name;
    category.description = parsed.description ?? category.description;
    category.order = parsed.order ?? category.order;
    category.visible = parsed.visible ?? category.visible;
    category.updatedAt = Date.now();
    await this.repo.saveCategory(category);
    return category;
  }

  async deleteCategory(id: string): Promise<{ deleted: boolean }> {
    const category = await this.getCategory(id);
    const all = await this.repo.listCategories();
    if (all.some((entry) => entry.parentId === category.id)) {
      throw new AppError('CONFLICT', {
        message: `Category ${category.key} still has subcategories`,
      });
    }
    const products = await this.repo.listProducts();
    if (products.some((product) => product.categoryId === category.id)) {
      throw new AppError('CONFLICT', {
        message: `Category ${category.key} is referenced by products`,
      });
    }
    await this.repo.deleteCategory(category.id);
    return { deleted: true };
  }

  async createProduct(input: unknown): Promise<Product> {
    const parsed = parseCreateProduct(input);
    const category = await this.repo.findCategoryById(parsed.categoryId);
    if (!category) {
      throw new AppError('NOT_FOUND', { message: `Category ${parsed.categoryId} not found` });
    }
    const duplicate = await this.repo.findProductByKey(parsed.key);
    if (duplicate) {
      throw new AppError('CONFLICT', { message: `Product key "${parsed.key}" already exists` });
    }
    const now = Date.now();
    const product: Product = {
      id: newId('prd'),
      key: parsed.key,
      categoryId: parsed.categoryId,
      name: parsed.name,
      description: parsed.description,
      brand: parsed.brand,
      status: 'draft',
      available: true,
      attributes: parsed.attributes ?? {},
      media: parsed.media ?? [],
      variants: parsed.variants.map((variant): Variant => ({
        id: newId('var'),
        sku: variant.sku,
        name: variant.name,
        attributes: variant.attributes ?? {},
        price: variant.price,
        mrp: variant.mrp,
        available: variant.available ?? true,
      })),
      modifierGroups: (parsed.modifierGroups ?? []).map((group): ModifierGroup => ({
        id: newId('grp'),
        name: group.name,
        required: group.required,
        options: group.options.map((option) => ({
          id: newId('opt'),
          name: option.name,
          priceDelta: option.priceDelta,
          available: option.available ?? true,
        })),
      })),
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.saveProduct(product);
    return product;
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.repo.findProductById(id);
    if (!product) {
      throw new AppError('NOT_FOUND', { message: `Product ${id} not found` });
    }
    return product;
  }

  async listProducts(filter: ProductListFilter = {}): Promise<Product[]> {
    const products = await this.repo.listProducts();
    const query = filter.q?.toLowerCase();
    return products
      .filter(
        (product) =>
          (filter.categoryId === undefined || product.categoryId === filter.categoryId) &&
          (filter.status === undefined || product.status === filter.status) &&
          (filter.available === undefined || product.available === filter.available) &&
          (query === undefined ||
            product.name.toLowerCase().includes(query) ||
            product.key.includes(query)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, filter.limit ?? 50);
  }

  async updateProduct(id: string, input: unknown): Promise<Product> {
    const parsed = parseUpdateProduct(input);
    const product = await this.getProduct(id);
    if (parsed.categoryId !== undefined && parsed.categoryId !== product.categoryId) {
      const category = await this.repo.findCategoryById(parsed.categoryId);
      if (!category) {
        throw new AppError('NOT_FOUND', { message: `Category ${parsed.categoryId} not found` });
      }
      product.categoryId = parsed.categoryId;
    }
    if (parsed.status !== undefined && parsed.status !== product.status) {
      const allowed = PRODUCT_STATUS_TRANSITIONS[product.status];
      if (!allowed.includes(parsed.status)) {
        throw new AppError('CONFLICT', {
          message: `Invalid status transition ${product.status} → ${parsed.status}`,
        });
      }
      product.status = parsed.status;
    }
    product.name = parsed.name ?? product.name;
    product.description = parsed.description ?? product.description;
    product.brand = parsed.brand ?? product.brand;
    product.attributes = parsed.attributes ?? product.attributes;
    product.media = parsed.media ?? product.media;
    if (parsed.modifierGroups !== undefined) {
      product.modifierGroups = parsed.modifierGroups.map((group) => ({
        id: newId('grp'),
        name: group.name,
        required: group.required,
        options: group.options.map((option) => ({
          id: newId('opt'),
          name: option.name,
          priceDelta: option.priceDelta,
          available: option.available ?? true,
        })),
      }));
    }
    product.updatedAt = Date.now();
    await this.repo.saveProduct(product);
    return product;
  }

  async setProductAvailability(id: string, available: boolean): Promise<Product> {
    const product = await this.getProduct(id);
    product.available = available;
    product.updatedAt = Date.now();
    await this.repo.saveProduct(product);
    return product;
  }

  async updateVariant(productId: string, variantId: string, input: unknown): Promise<Product> {
    const parsed = parseUpdateVariant(input);
    const product = await this.getProduct(productId);
    const variant = product.variants.find((entry) => entry.id === variantId);
    if (!variant) {
      throw new AppError('NOT_FOUND', { message: `Variant ${variantId} not found` });
    }
    const price = parsed.price ?? variant.price;
    const mrp = parsed.mrp ?? variant.mrp;
    if (mrp < price) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'mrp must be greater than or equal to price',
        details: [{ path: 'mrp', message: 'mrp must be greater than or equal to price' }],
      });
    }
    variant.name = parsed.name ?? variant.name;
    variant.attributes = parsed.attributes ?? variant.attributes;
    variant.price = price;
    variant.mrp = mrp;
    variant.available = parsed.available ?? variant.available;
    product.updatedAt = Date.now();
    await this.repo.saveProduct(product);
    return product;
  }

  async deleteProduct(id: string): Promise<{ deleted: boolean }> {
    const product = await this.getProduct(id);
    await this.repo.deleteProduct(product.id);
    return { deleted: true };
  }

  private async isDescendant(ancestorId: string, nodeId: string): Promise<boolean> {
    let currentId: string | undefined = nodeId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === ancestorId) return true;
      if (seen.has(currentId)) return false;
      seen.add(currentId);
      const node: Category | null = await this.repo.findCategoryById(currentId);
      currentId = node?.parentId;
    }
    return false;
  }
}
