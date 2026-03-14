// NexusPOS — Categories Screen
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../../../stores/settingsStore';
import { categoryAPI } from '../../../services/ipcService';
import { Tag } from 'lucide-react';

interface Category { id: string; name: string; colorHex?: string; sortOrder?: number; _count?: { products: number } }

export function CategoriesScreen() {
  const { storeId } = useSettingsStore();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories:list', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const r = await categoryAPI.list(storeId);
      return (r.data as Category[]) ?? [];
    },
    enabled: !!storeId,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Kategorien</h1>
      </div>
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Tag size={48} className="mb-3 opacity-30" />
            <p>Noch keine Kategorien</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: cat.colorHex ? `${cat.colorHex}22` : '#e0e7ff' }}>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.colorHex ?? '#6366f1' }} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoriesScreen;
