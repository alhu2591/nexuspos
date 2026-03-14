// NexusPOS — Barcode Scanner Hook
// Detects rapid keyboard input characteristic of barcode scanners
// A scanner typically sends chars in < 50ms intervals ending with Enter

import { useEffect, useRef } from 'react';

const SCAN_THRESHOLD_MS = 50;
const MIN_BARCODE_LENGTH = 4;

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const bufferRef = useRef('');
  const lastCharTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input/textarea (let normal typing through)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const now = Date.now();
      const timeSinceLastChar = now - lastCharTimeRef.current;
      lastCharTimeRef.current = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      // If too much time passed, start fresh (not a scanner)
      if (timeSinceLastChar > 200 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Auto-flush: if chars come faster than threshold, treat as scanner
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH && timeSinceLastChar < SCAN_THRESHOLD_MS) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
      }, 150);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onScan]);

  return {};
}
