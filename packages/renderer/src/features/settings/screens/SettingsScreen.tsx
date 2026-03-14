// NexusPOS — Settings Screen

import React from 'react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { systemAPI } from '../../../services/ipcService';
import { useQuery } from '@tanstack/react-query';
import { Monitor, HardDrive, RefreshCw } from 'lucide-react';

export function SettingsScreen() {
  const { device, locale, currency, timezone } = useSettingsStore();

  const { data: versionInfo } = useQuery({
    queryKey: ['app:version'],
    queryFn: async () => {
      const r = await systemAPI.version();
      return r.data as { version: string; electron: string; node: string; platform: string };
    },
    staleTime: Infinity,
  });

  const handleBackup = async () => {
    const r = await systemAPI.backup();
    if (r.success) alert('Backup erstellt: ' + (r.data as any)?.path);
    else alert('Backup fehlgeschlagen');
  };

  const handleRestart = async () => {
    if (confirm('Anwendung neu starten?')) await systemAPI.restart();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>

      {/* Device Info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Monitor size={20} className="text-blue-600" />
          </div>
          <h2 className="font-bold text-gray-900">Geräteinformationen</h2>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Gerätename', device?.name ?? '—'],
            ['Gerät-ID', device?.id ? device.id.substring(0, 12) + '...' : '—'],
            ['Filiale', device?.store?.name ?? '—'],
            ['Sprache/Region', locale],
            ['Währung', currency],
            ['Zeitzone', timezone],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
              <dd className="font-semibold text-gray-900 truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* App Version */}
      {versionInfo && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <HardDrive size={20} className="text-purple-600" />
            </div>
            <h2 className="font-bold text-gray-900">Softwareversion</h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['NexusPOS', `v${versionInfo.version}`],
              ['Electron', versionInfo.electron],
              ['Node.js', versionInfo.node],
              ['Plattform', versionInfo.platform],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
                <dd className="font-semibold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-4">Aktionen</h2>
        <div className="flex gap-3">
          <button
            onClick={handleBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <HardDrive size={16} /> Backup erstellen
          </button>
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl transition-colors text-sm"
          >
            <RefreshCw size={16} /> Neu starten
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsScreen;
