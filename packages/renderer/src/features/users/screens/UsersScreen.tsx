// NexusPOS — Users Screen (placeholder - requires admin role)
import React from 'react';
import { UserCog } from 'lucide-react';

export function UsersScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <UserCog size={56} className="mb-4 opacity-30" />
      <h1 className="text-xl font-bold text-gray-700 mb-1">Benutzerverwaltung</h1>
      <p className="text-sm">Diese Funktion ist in Entwicklung.</p>
    </div>
  );
}

export default UsersScreen;
