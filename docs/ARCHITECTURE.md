# NexusPOS — Enterprise Point of Sale Platform
## Architecture Overview v1.0.0

---

## 1. SYSTEM OVERVIEW

NexusPOS is a production-grade, offline-first, cross-platform Point of Sale system designed
for retail and hospitality environments. It targets single-store through multi-terminal deployments,
with full support for German fiscal compliance (TSE), EU VAT handling, hardware peripheral integration,
and Linux kiosk deployment.

The system is engineered to operate on low-end hardware (dual-core, 4GB RAM) while delivering
sub-100ms checkout interactions and zero-latency product search.

---

## 2. ARCHITECTURAL STYLE

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│   React + TypeScript + TailwindCSS + i18next + Zustand              │
│   Screens / Feature Modules / Reusable Components / View Models     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ (IPC Bridge / Application Services)
┌────────────────────────────────▼────────────────────────────────────┐
│                         APPLICATION LAYER                           │
│   Use Cases / Commands / Queries / Application Services             │
│   CheckoutService / SaleService / InventoryService / ReportService  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                           DOMAIN LAYER                              │
│   Entities / Value Objects / Domain Services / Business Rules       │
│   Sale / Product / Customer / Shift / TaxEngine / DiscountEngine    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                          │
│   Prisma/SQLite / Hardware Adapters / Printing / Fiscal / Sync      │
│   ReceiptPrinter / BarcodeScanner / CashDrawer / TSEAdapter         │
└─────────────────────────────────────────────────────────────────────┘
```

### Clean Architecture Rules
- Dependencies ALWAYS point inward (Infrastructure → Domain is FORBIDDEN)
- Domain layer has ZERO external dependencies
- Application layer depends only on Domain interfaces
- Infrastructure implements interfaces defined by Domain/Application

---

## 3. MONOREPO STRUCTURE

```
pos-platform/
├── packages/
│   ├── main/                    # Electron main process (Node.js)
│   │   └── src/
│   │       ├── ipc/             # IPC handlers (bridge to renderer)
│   │       ├── hardware/        # Hardware adapter implementations
│   │       ├── printing/        # Print job management
│   │       ├── fiscal/          # TSE / fiscal compliance
│   │       ├── sync/            # Multi-terminal sync engine
│   │       ├── database/        # Prisma client factory
│   │       └── utils/           # Logging, error handling
│   │
│   ├── renderer/                # React application
│   │   └── src/
│   │       ├── app/             # App root, routing, providers
│   │       ├── features/        # Feature modules (DDD-bounded contexts)
│   │       │   ├── checkout/
│   │       │   ├── products/
│   │       │   ├── inventory/
│   │       │   ├── customers/
│   │       │   ├── receipts/
│   │       │   ├── invoices/
│   │       │   ├── payments/
│   │       │   ├── discounts/
│   │       │   ├── taxes/
│   │       │   ├── shifts/
│   │       │   ├── reports/
│   │       │   ├── settings/
│   │       │   ├── users/
│   │       │   └── dashboard/
│   │       ├── components/      # Shared UI components
│   │       ├── hooks/           # Shared hooks
│   │       ├── stores/          # Zustand stores
│   │       ├── services/        # IPC service wrappers
│   │       ├── i18n/            # Translation files
│   │       └── styles/          # Global styles
│   │
│   ├── shared/                  # Shared between main and renderer
│   │   └── src/
│   │       ├── types/           # Shared TypeScript types/interfaces
│   │       ├── constants/       # Shared constants
│   │       ├── schemas/         # Zod validation schemas
│   │       └── utils/           # Pure utility functions
│   │
│   └── database/                # Database schema and migrations
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
│
├── scripts/                     # Build/deploy scripts
├── .github/workflows/           # CI/CD
├── electron-builder.config.ts   # Packaging configuration
├── package.json                 # Root monorepo config
└── turbo.json                   # Turborepo build orchestration
```

---

## 4. FEATURE MODULE ANATOMY

Each feature module in `renderer/src/features/<module>/` follows this structure:

```
checkout/
├── components/          # Feature-specific UI components
│   ├── CartItem.tsx
│   ├── CartSummary.tsx
│   └── PaymentModal.tsx
├── hooks/               # Feature hooks (connect store → UI)
│   ├── useCheckout.ts
│   └── usePayment.ts
├── screens/             # Full-page screen components
│   └── CheckoutScreen.tsx
├── store/               # Feature Zustand slice
│   └── checkoutStore.ts
├── services/            # IPC call wrappers
│   └── checkoutService.ts
├── domain/              # Domain entities + business rules
│   ├── Cart.ts
│   ├── CartLine.ts
│   └── PriceCalculator.ts
├── types/               # Feature-local types
│   └── checkout.types.ts
└── index.ts             # Public API
```

---

## 5. IPC SECURITY ARCHITECTURE

```
Renderer (sandboxed) ──► contextBridge ──► preload.ts ──► ipcRenderer
                                                               │
                                                          [validated]
                                                               │
Main Process ◄──────────────────────────────────────── ipcMain.handle
     │
     └──► Application Services ──► Domain ──► Infrastructure
```

- `nodeIntegration: false` — renderer cannot access Node APIs
- `contextIsolation: true` — preload runs in isolated context
- All IPC messages validated with Zod schemas before processing
- No direct database access from renderer
- All file system operations via IPC handlers only

---

## 6. DATABASE ARCHITECTURE

- **Engine**: SQLite (via Prisma ORM)
- **Location**: `userData/nexuspos.db`
- **WAL mode**: Enabled for concurrent reads during sync
- **Migrations**: Automated via Prisma migrate
- **Backup**: Automatic rolling backup on shift close
- **Encryption**: Optional SQLCipher integration for sensitive deployments

### Indexing Strategy
- Products: `barcode`, `name` (FTS), `categoryId`, `sku`
- Sales: `createdAt`, `deviceId`, `shiftId`, `customerId`
- SaleLines: `saleId`, `productId`
- AuditLog: `entityType`, `entityId`, `createdAt`

---

## 7. MULTI-TERMINAL SYNC ARCHITECTURE

```
Terminal A ──► SyncQueue (local) ──► SyncEngine ──► LAN Broadcast
                                                          │
Terminal B ◄─────────── Receive ◄──────────────── Discover peers
     │
     └──► Conflict Resolution ──► Apply Changes ──► Emit Events
```

- Event-sourced sync using append-only `SyncQueue` table
- Vector clock conflict resolution per entity
- Optimistic offline operation — all writes succeed locally
- Background sync with exponential backoff retry
- Hash-based integrity verification

---

## 8. HARDWARE ADAPTER PATTERN

```typescript
interface HardwareAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  getStatus(): HardwareStatus
}

interface ReceiptPrinterAdapter extends HardwareAdapter {
  printReceipt(job: PrintJob): Promise<PrintResult>
  cutPaper(): Promise<void>
  openCashDrawer(): Promise<void>
}
```

Concrete implementations:
- `EscPosPrinterAdapter` — USB/Serial ESC/POS thermal printers
- `NetworkPrinterAdapter` — LAN receipt printers
- `StarPrinterAdapter` — Star Micronics printers
- `MockPrinterAdapter` — Testing/demo mode
- `SerialBarcodeAdapter` — Serial barcode scanners
- `HidBarcodeAdapter` — HID keyboard-mode scanners

---

## 9. FISCAL COMPLIANCE ARCHITECTURE

```
SaleCompletedEvent
       │
       ▼
FiscalEventBus
       │
       ├──► AuditLogger (always active)
       ├──► TSEAdapter (when TSE configured)
       └──► FiscalExportQueue (for KassenSichV export)
```

TSE Integration design is **provider-agnostic**:
- `SwissbitTSEAdapter`
- `CryptoVisionTSEAdapter`  
- `MockTSEAdapter` (testing)

All fiscal events stored in append-only `FiscalEvent` table.
GoBD-compliant audit trail with tamper detection.

---

## 10. VAT ENGINE

```
CartLine ──► VATEngine.calculate(line, rules) ──► VATBreakdown
                       │
            ┌──────────┴──────────┐
            │                     │
      Inclusive VAT          Exclusive VAT
   (price includes tax)   (tax added on top)
            │                     │
            └──────────┬──────────┘
                       │
               VATBreakdown {
                 netAmount: Decimal
                 vatAmount: Decimal
                 grossAmount: Decimal
                 vatRate: Decimal
                 vatClass: 'standard' | 'reduced' | 'zero'
               }
```

Supports German VAT: 19% standard, 7% reduced, 0% exempt.
All monetary calculations use integer arithmetic (cents) to avoid floating-point errors.

---

## 11. PERFORMANCE TARGETS

| Operation          | Target   | Strategy                          |
|--------------------|----------|-----------------------------------|
| App cold start     | < 3s     | Lazy loading, minimal boot deps   |
| Product search     | < 50ms   | FTS5 index, in-memory cache       |
| Barcode lookup     | < 10ms   | Indexed query + LRU cache         |
| Cart update        | < 16ms   | Memoized selectors, immutable ops |
| Receipt print      | < 2s     | Print queue, async dispatch       |
| Report generation  | < 5s     | Pre-aggregated summaries          |
| DB write (sale)    | < 100ms  | WAL mode, transaction batching    |

---

## 12. SECURITY ARCHITECTURE

- Electron CSP headers configured
- No remote code execution
- Database path sanitization
- User authentication with bcrypt
- Role-based access control (RBAC)
- Session tokens with expiry
- PIN login for fast cashier switching
- Audit log for all sensitive operations
- Hardware serial number binding (optional)

---

## 13. LOCALIZATION ARCHITECTURE

- `i18next` with `react-i18next`
- Locale detection from system + user settings
- Supported: `de-DE`, `en-US`, `en-GB`, `fr-FR`, `es-ES`
- Number/currency formatting via `Intl.NumberFormat`
- Date formatting via `Intl.DateTimeFormat`
- RTL support prepared

---

## 14. LINUX KIOSK DEPLOYMENT

- Auto-login via GDM/LightDM configuration
- systemd service with `Restart=always`
- Openbox/Sway minimal WM session
- Xorg with single display config
- Touchscreen input via `xinput`
- USB device hot-plug monitoring
- Watchdog process for crash recovery

---

## 15. ERROR HANDLING PHILOSOPHY

All errors flow through centralized `ErrorService`:

```
Error thrown
     │
     ▼
ErrorService.capture(error, context)
     │
     ├──► ErrorLog table (all errors)
     ├──► AuditLog (security-relevant errors)
     ├──► UI notification (user-friendly message)
     └──► Crash reporter (fatal errors only)
```

Domain errors: typed, expected, recoverable
Infrastructure errors: logged, retried, surfaced
Fatal errors: logged, shown to user, graceful restart
