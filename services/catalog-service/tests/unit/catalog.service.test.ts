import { AppError } from '@localwala/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CatalogRepository } from '../../src/catalog/catalog.repository.js';
import { StagingCatalogRepository } from '../../src/catalog/catalog.repository.js';
import { CatalogService } from '../../src/catalog/catalog.service.js';
import type { Category, Product } from '../../src/catalog/catalog.types.js';

class InMemoryCatalogRepository implements CatalogRepository {
  readonly categories: Category[] = [];
  readonly products: Product[] = [];

  async saveCategory(category: Category): Promise<void> {
    const index = this.categories.findIndex((entry) => entry.id === category.id);
    if (index >= 0) this.categories[index] = category;
    else this.categories.push(category);
  }
  async findCategoryById(id: string): Promise<Category | null> {
    return this.categories.find((entry) => entry.id === id) ?? null;
  }
  async findCategoryByKey(key: string): Promise<Category | null> {
    return this.categories.find((entry) => entry.key === key) ?? null;
  }
  async listCategories(): Promise<Category[]> {
    return [...this.categories];
  }
  async deleteCategory(id: string): Promise<void> {
    const index = this.categories.findIndex((entry) => entry.id === id);
    if (index >= 0) this.categories.splice(index, 1);
  }
  async saveProduct(product: Product): Promise<void> {
    const index = this.products.findIndex((entry) => entry.id === product.id);
    if (index >= 0) this.products[index] = product;
    else this.products.push(product);
  }
  async findProductById(id: string): Promise<Product | null> {
    return this.products.find((entry) => entry.id === id) ?? null;
  }
  async findProductByKey(key: string): Promise<Product | null> {
    return this.products.find((entry) => entry.key === key) ?? null;
  }
  async listProducts(): Promise<Product[]> {
    return [...this.products];
  }
  async deleteProduct(id: string): Promise<void> {
    const index = this.products.findIndex((entry) => entry.id === id);
    if (index >= 0) this.products.splice(index, 1);
  }
}

function categoryPayload(overrides: Record<string, unknown> = {}) {
  return { key: 'groceries', name: 'Groceries', ...overrides };
}

function productPayload(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    key: 'basmati-rice-1kg',
    categoryId,
    name: 'Basmati Rice 1kg',
    variants: [{ sku: 'RICE-1K', name: '1 kg pack', price: 120, mrp: 150 }],
    ...overrides,
  };
}

async function seedCategory(service: CatalogService, overrides: Record<string, unknown> = {}) {
  return service.createCategory(categoryPayload(overrides));
}

async function seedProduct(
  service: CatalogService,
  categoryId: string,
  overrides: Record<string, unknown> = {},
) {
  return service.createProduct(productPayload(categoryId, overrides));
}

describe('CatalogService', () => {
  let repo: InMemoryCatalogRepository;
  let service: CatalogService;

  beforeEach(() => {
    repo = new InMemoryCatalogRepository();
    service = new CatalogService(repo);
  });

  describe('categories', () => {
    it('creates a root category with defaults', async () => {
      const category = await service.createCategory(categoryPayload());
      expect(category.id).toMatch(/^cat_/);
      expect(category.parentId).toBeUndefined();
      expect(category.order).toBe(0);
      expect(category.visible).toBe(true);
    });

    it('creates a subcategory under an existing parent', async () => {
      const parent = await seedCategory(service);
      const child = await service.createCategory(
        categoryPayload({ key: 'fresh-veg', parentId: parent.id }),
      );
      expect(child.parentId).toBe(parent.id);
    });

    it('404s when the parent does not exist', async () => {
      await expect(
        service.createCategory(categoryPayload({ parentId: 'cat_missing' })),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects a duplicate category key', async () => {
      await seedCategory(service);
      await expect(service.createCategory(categoryPayload())).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects a non-slug key', async () => {
      await expect(
        service.createCategory(categoryPayload({ key: 'Bad Key!' })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a missing name', async () => {
      await expect(service.createCategory({ key: 'groceries' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('404s for an unknown category id', async () => {
      await expect(service.getCategory('cat_missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('filters by parentId, vertical, visible and key', async () => {
      const parent = await seedCategory(service);
      await seedCategory(service, { key: 'electronics', vertical: 'store' });
      await seedCategory(service, { key: 'fresh-veg', parentId: parent.id });
      await seedCategory(service, { key: 'hidden', visible: false });

      expect(await service.listCategories({ parentId: parent.id })).toHaveLength(1);
      expect(await service.listCategories({ vertical: 'store' })).toHaveLength(1);
      expect(await service.listCategories({ visible: false })).toHaveLength(1);
      expect((await service.listCategories({ key: 'hidden' }))[0].visible).toBe(false);
      expect(await service.listCategories({ vertical: 'pharma' })).toHaveLength(0);
    });

    it('sorts category lists by order then name', async () => {
      await seedCategory(service, { key: 'b-club', name: 'B', order: 5 });
      await seedCategory(service, { key: 'a-club', name: 'A', order: 1 });
      const list = await service.listCategories();
      expect(list.map((entry) => entry.key)).toEqual(['a-club', 'b-club']);
    });

    it('builds a nested tree sorted by order', async () => {
      const parent = await seedCategory(service, { order: 2 });
      await seedCategory(service, { key: 'child-b', parentId: parent.id, order: 9 });
      await seedCategory(service, { key: 'child-a', parentId: parent.id, order: 1 });
      await seedCategory(service, { key: 'root-first', order: 1 });

      const tree = await service.getCategoryTree();
      expect(tree).toHaveLength(2);
      expect(tree[0].key).toBe('root-first');
      expect(tree[1].key).toBe('groceries');
      expect(tree[1].children.map((node) => node.key)).toEqual(['child-a', 'child-b']);
    });

    it('updates name, order and visible', async () => {
      const category = await seedCategory(service);
      const updated = await service.updateCategory(category.id, {
        name: 'Pantry',
        order: 3,
        visible: false,
      });
      expect(updated.name).toBe('Pantry');
      expect(updated.order).toBe(3);
      expect(updated.visible).toBe(false);
      expect(updated.key).toBe(category.key);
    });

    it('rejects a self-parent', async () => {
      const category = await seedCategory(service);
      await expect(
        service.updateCategory(category.id, { parentId: category.id }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects a cycle when re-parenting to a descendant', async () => {
      const parent = await seedCategory(service);
      const child = await seedCategory(service, { key: 'child', parentId: parent.id });
      await expect(service.updateCategory(parent.id, { parentId: child.id })).rejects.toMatchObject(
        { code: 'CONFLICT' },
      );
    });

    it('404s when moving under a missing parent', async () => {
      const category = await seedCategory(service);
      await expect(
        service.updateCategory(category.id, { parentId: 'cat_missing' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('clears the parent when parentId is null', async () => {
      const parent = await seedCategory(service);
      const child = await seedCategory(service, { key: 'child', parentId: parent.id });
      const updated = await service.updateCategory(child.id, { parentId: null });
      expect(updated.parentId).toBeUndefined();
    });

    it('deletes a leaf category', async () => {
      const category = await seedCategory(service);
      const result = await service.deleteCategory(category.id);
      expect(result.deleted).toBe(true);
      await expect(service.getCategory(category.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects deleting a category with subcategories', async () => {
      const parent = await seedCategory(service);
      await seedCategory(service, { key: 'child', parentId: parent.id });
      await expect(service.deleteCategory(parent.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects deleting a category referenced by products', async () => {
      const category = await seedCategory(service);
      await seedProduct(service, category.id);
      await expect(service.deleteCategory(category.id)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });
  });

  describe('products', () => {
    let category: Category;

    beforeEach(async () => {
      category = await seedCategory(service);
    });

    it('creates a draft product with generated ids', async () => {
      const product = await service.createProduct(
        productPayload(category.id, {
          modifierGroups: [
            { name: 'Extras', required: false, options: [{ name: 'Cheese', priceDelta: 20 }] },
          ],
        }),
      );
      expect(product.status).toBe('draft');
      expect(product.available).toBe(true);
      expect(product.variants[0].id).toMatch(/^var_/);
      expect(product.modifierGroups[0].id).toMatch(/^grp_/);
      expect(product.modifierGroups[0].options[0].id).toMatch(/^opt_/);
      expect(product.variants[0].available).toBe(true);
    });

    it('404s when the category does not exist', async () => {
      await expect(service.createProduct(productPayload('cat_missing'))).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('rejects a duplicate product key', async () => {
      await seedProduct(service, category.id);
      await expect(service.createProduct(productPayload(category.id))).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects mrp below price', async () => {
      await expect(
        service.createProduct(
          productPayload(category.id, {
            variants: [{ sku: 'X-1', name: 'X', price: 200, mrp: 100 }],
          }),
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects duplicate SKUs within a product', async () => {
      await expect(
        service.createProduct(
          productPayload(category.id, {
            variants: [
              { sku: 'SAME', name: 'A', price: 10, mrp: 12 },
              { sku: 'SAME', name: 'B', price: 20, mrp: 25 },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a product without variants', async () => {
      await expect(
        service.createProduct(productPayload(category.id, { variants: [] })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a non-url media entry', async () => {
      await expect(
        service.createProduct(productPayload(category.id, { media: ['not-a-url'] })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects duplicate modifier option names in a group', async () => {
      await expect(
        service.createProduct(
          productPayload(category.id, {
            modifierGroups: [
              {
                name: 'Extras',
                required: false,
                options: [
                  { name: 'Cheese', priceDelta: 10 },
                  { name: 'Cheese', priceDelta: 20 },
                ],
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('404s for an unknown product id', async () => {
      await expect(service.getProduct('prd_missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('transitions draft → active → inactive → active', async () => {
      const product = await seedProduct(service, category.id);
      const active = await service.updateProduct(product.id, { status: 'active' });
      expect(active.status).toBe('active');
      const inactive = await service.updateProduct(product.id, { status: 'inactive' });
      expect(inactive.status).toBe('inactive');
      const reactivated = await service.updateProduct(product.id, { status: 'active' });
      expect(reactivated.status).toBe('active');
    });

    it('rejects an invalid status transition', async () => {
      const product = await seedProduct(service, category.id);
      await expect(service.updateProduct(product.id, { status: 'inactive' })).rejects.toMatchObject(
        { code: 'CONFLICT' },
      );
      const active = await service.updateProduct(product.id, { status: 'active' });
      expect(active.status).toBe('active');
      await expect(service.updateProduct(product.id, { status: 'draft' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('treats a same-status patch as a no-op', async () => {
      const product = await seedProduct(service, category.id);
      const result = await service.updateProduct(product.id, { status: 'draft' });
      expect(result.status).toBe('draft');
    });

    it('filters products by category, status, availability and query', async () => {
      const other = await seedCategory(service, { key: 'other' });
      const first = await seedProduct(service, category.id);
      await service.updateProduct(first.id, { status: 'active' });
      await seedProduct(service, other.id, {
        key: 'basmati-rice-500g',
        name: 'Basmati Rice 500g',
      });
      await service.setProductAvailability(first.id, false);

      expect(await service.listProducts({ categoryId: category.id })).toHaveLength(1);
      expect(await service.listProducts({ status: 'draft' })).toHaveLength(1);
      expect(await service.listProducts({ status: 'active' })).toHaveLength(1);
      expect(await service.listProducts({ available: false })).toHaveLength(1);
      expect(await service.listProducts({ q: 'basmati' })).toHaveLength(2);
      expect(await service.listProducts({ q: 'no-match' })).toHaveLength(0);
      expect(await service.listProducts({ limit: 1 })).toHaveLength(1);
    });

    it('toggles availability regardless of status', async () => {
      const product = await seedProduct(service, category.id);
      const off = await service.setProductAvailability(product.id, false);
      expect(off.available).toBe(false);
      expect(off.status).toBe('draft');
      const on = await service.setProductAvailability(product.id, true);
      expect(on.available).toBe(true);
    });

    it('moves a product to another category', async () => {
      const product = await seedProduct(service, category.id);
      const other = await seedCategory(service, { key: 'other' });
      const moved = await service.updateProduct(product.id, { categoryId: other.id });
      expect(moved.categoryId).toBe(other.id);
    });

    it('404s when moving a product to a missing category', async () => {
      const product = await seedProduct(service, category.id);
      await expect(
        service.updateProduct(product.id, { categoryId: 'cat_missing' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('updates a variant price with cross-field validation', async () => {
      const product = await seedProduct(service, category.id);
      const variantId = product.variants[0].id;
      const updated = await service.updateVariant(product.id, variantId, {
        price: 130,
        mrp: 160,
      });
      expect(updated.variants[0].price).toBe(130);
      expect(updated.variants[0].mrp).toBe(160);

      await expect(
        service.updateVariant(product.id, variantId, { price: 500 }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('toggles variant availability', async () => {
      const product = await seedProduct(service, category.id);
      const variantId = product.variants[0].id;
      const updated = await service.updateVariant(product.id, variantId, { available: false });
      expect(updated.variants[0].available).toBe(false);
    });

    it('404s for an unknown variant', async () => {
      const product = await seedProduct(service, category.id);
      await expect(
        service.updateVariant(product.id, 'var_missing', { price: 10 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('deletes a product', async () => {
      const product = await seedProduct(service, category.id);
      const result = await service.deleteProduct(product.id);
      expect(result.deleted).toBe(true);
      await expect(service.getProduct(product.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});

describe('StagingCatalogRepository', () => {
  const repo = new StagingCatalogRepository();

  it('blocks every operation with SERVICE_UNAVAILABLE', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => repo.saveCategory({} as Category),
      () => repo.findCategoryById('cat_1'),
      () => repo.findCategoryByKey('k'),
      () => repo.listCategories(),
      () => repo.deleteCategory('cat_1'),
      () => repo.saveProduct({} as Product),
      () => repo.findProductById('prd_1'),
      () => repo.findProductByKey('k'),
      () => repo.listProducts(),
      () => repo.deleteProduct('prd_1'),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    }
  });

  it('throws a typed AppError', async () => {
    await expect(repo.listProducts()).rejects.toBeInstanceOf(AppError);
  });
});
