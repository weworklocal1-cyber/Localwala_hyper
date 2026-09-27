import { randomUUID } from 'node:crypto';

export const PRODUCT_STATUSES = ['draft', 'active', 'inactive'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  draft: ['active'],
  active: ['inactive'],
  inactive: ['active'],
};

export interface Category {
  id: string;
  key: string;
  name: string;
  description?: string;
  parentId?: string;
  vertical?: string;
  order: number;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Variant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  mrp: number;
  available: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  key: string;
  categoryId: string;
  name: string;
  description?: string;
  brand?: string;
  status: ProductStatus;
  available: boolean;
  attributes: Record<string, string>;
  media: string[];
  variants: Variant[];
  modifierGroups: ModifierGroup[];
  createdAt: number;
  updatedAt: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export const SLUG_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';

export function newId(prefix: 'cat' | 'prd' | 'var' | 'grp' | 'opt'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
