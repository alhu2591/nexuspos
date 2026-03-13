// NexusPOS — Product Search Component (continued)

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuthStore } from '../../../stores/authStore';
import { productAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import type { IProduct, ICategory } from '@nexuspos/shared';
import { Search, X, Grid3x3, List, Package, Tag } from 'lucide-react';
import clsx from 'clsx';

interface ProductSearchProps {
  onProductSelect: (product: IProduct) => void;
}

const ITEMS_PER_ROW_GRID = 4;
const ITEM_HEIGHT_LIST = 64;
const ITEM_HEIGHT_GRID = 128;

export function ProductSearch({ onProductSelect }: ProductSearchProps) {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const storeId = session?.storeId ?? '';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 150);

  // ── PRODUCT QUERY ───────────────────────────────────────
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products:search', debouncedQuery, selectedCategory, storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const result = await productAPI.search(debouncedQuery, storeId, selectedCategory ?? undefined, 120);
      return (result.data as IProduct[]) ?? [];
    },
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // ── CATEGORIES QUERY ────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: async () => {
      const result = await productAPI.list(storeId, undefined, 1, 200);
      return (result.data as ICategory[]) ?? [];
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // ── VIRTUALIZER ─────────────────────────────────────────
  const rowCount = viewMode === 'list'
    ? products.length
    : Math.ceil(products.length / ITEMS_PER_ROW_GRID);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === 'list' ? ITEM_HEIGHT_LIST : ITEM_HEIGHT_GRID,
    overscan: 5,
  });

  // ── HANDLERS ────────────────────────────────────────────
  const handleProductClick = useCallback((product: IProduct) => {
    onProductSelect(product);
    searchInputRef.current?.focus();
  }, [onProductSelect]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder={t('product.searchPlaceholder', 'Produkt suchen oder scannen...')}
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx('p-2 transition-colors', viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
            title="Grid view"
          >
            <Grid3x3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              !selectedCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {t('common.all', 'Alle')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={clsx(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                cat.id === selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              style={cat.colorHex && cat.id !== selectedCategory ? { borderLeft: `3px solid ${cat.colorHex}` } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Product list (virtualized) */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Package size={40} className="mb-2 opacity-30" />
            <p className="text-sm">
              {query ? t('product.noResults', 'Keine Produkte gefunden') : t('product.startTyping', 'Tippen Sie zum Suchen')}
            </p>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }} className="px-3 py-2">
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const top = virtualRow.start;

              if (viewMode === 'list') {
                const product = products[virtualRow.index];
                if (!product) return null;
                return (
                  <div
                    key={virtualRow.key}
                    style={{ position: 'absolute', top, left: 0, right: 0 }}
                    className="px-1"
                  >
                    <ProductListRow product={product} onClick={handleProductClick} />
                  </div>
                );
              } else {
                const startIdx = virtualRow.index * ITEMS_PER_ROW_GRID;
                const rowProducts = products.slice(startIdx, startIdx + ITEMS_PER_ROW_GRID);
                return (
                  <div
                    key={virtualRow.key}
                    style={{ position: 'absolute', top, left: 12, right: 12 }}
                    className="grid grid-cols-4 gap-2"
                  >
                    {rowProducts.map((p) => (
                      <ProductGridCard key={p.id} product={p} onClick={handleProductClick} />
                    ))}
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* Result count */}
      {products.length > 0 && (
        <div className="px-4 py-1.5 bg-white border-t border-gray-100 text-xs text-gray-400">
          {products.length} {t('product.productsFound', 'Produkte')}
        </div>
      )}
    </div>
  );
}

// ── GRID CARD ─────────────────────────────────────────────────

interface ProductCardProps {
  product: IProduct;
  onClick: (product: IProduct) => void;
}

function ProductGridCard({ product, onClick }: ProductCardProps) {
  return (
    <button
      onClick={() => onClick(product)}
      className={clsx(
        'flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all text-left h-28',
        'bg-white hover:bg-blue-50 active:scale-95',
        product.inventory && product.inventory.quantity <= 0
          ? 'border-gray-200 opacity-60'
          : 'border-gray-200 hover:border-blue-400 hover:shadow-md'
      )}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-12 h-12 object-cover rounded-lg mb-1"
          loading="lazy"
        />
      ) : (
        <div
          className="w-12 h-12 rounded-lg mb-1 flex items-center justify-center text-white text-lg font-bold"
          style={{ backgroundColor: product.category?.colorHex ?? '#6366f1' }}
        >
          {product.name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-xs font-medium text-gray-800 text-center leading-tight line-clamp-2 w-full">
        {product.name}
      </span>
      <span className="mt-1 text-sm font-bold text-blue-600">
        {formatCents(product.unitPrice, 'de-DE', 'EUR')}
      </span>
      {product.inventory && product.inventory.quantity <= 5 && product.inventory.quantity > 0 && (
        <span className="text-[10px] text-orange-500 font-medium">
          Noch {product.inventory.quantity}
        </span>
      )}
    </button>
  );
}

// ── LIST ROW ──────────────────────────────────────────────────

function ProductListRow({ product, onClick }: ProductCardProps) {
  return (
    <button
      onClick={() => onClick(product)}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition-all text-left mb-1"
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ backgroundColor: product.category?.colorHex ?? '#6366f1' }}
        >
          {product.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
        <p className="text-xs text-gray-400">
          {product.sku && <span className="mr-2">SKU: {product.sku}</span>}
          {product.category?.name}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-blue-600">{formatCents(product.unitPrice, 'de-DE', 'EUR')}</p>
        {product.inventory && (
          <p className={clsx('text-xs', product.inventory.quantity <= 0 ? 'text-red-500' : 'text-gray-400')}>
            {product.inventory.quantity <= 0 ? 'Kein Lager' : `Lager: ${product.inventory.quantity}`}
          </p>
        )}
      </div>
    </button>
  );
}
