// NexusPOS — Electron Window Type Declarations

interface NexusPOSBridge {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  on: (channel: string, listener: (data: unknown) => void) => () => void;
  send: (channel: string, payload?: unknown) => void;
}

interface PlatformInfo {
  os: string;
  arch: string;
  version: string;
  isKiosk: boolean;
  isFullscreen: boolean;
}

declare interface Window {
  nexuspos?: NexusPOSBridge;
  platform?: PlatformInfo;
}
