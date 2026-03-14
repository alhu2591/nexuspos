// NexusPOS — Hardware Events Hook
// Listens to hardware events emitted from main process via IPC
// e.g. cash drawer opened, printer status changed, barcode scan from dedicated scanner

import { useEffect } from 'react';
import { ipcService } from '../services/ipcService';

export function useHardwareEvents() {
  useEffect(() => {
    // Listen for hardware events pushed from main process
    const unsubDrawer = ipcService.on('hardware:drawer-opened', () => {
      // Cash drawer was opened — log or update UI
    });

    const unsubPrinter = ipcService.on('hardware:printer-status', (_status: unknown) => {
      // Printer status changed
    });

    const unsubScanner = ipcService.on('hardware:barcode-scan', (_barcode: unknown) => {
      // Barcode scan from dedicated hardware (not keyboard wedge)
      // Dispatch custom event so useBarcodeScanner can pick it up
      if (typeof _barcode === 'string') {
        window.dispatchEvent(new CustomEvent('hardware-barcode', { detail: _barcode }));
      }
    });

    return () => {
      if (typeof unsubDrawer === 'function') unsubDrawer();
      if (typeof unsubPrinter === 'function') unsubPrinter();
      if (typeof unsubScanner === 'function') unsubScanner();
    };
  }, []);

  return {};
}
