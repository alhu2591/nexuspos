# NexusPOS — Enterprise Point of Sale Platform

<p align="center">
  <img src="docs/assets/logo.png" alt="NexusPOS" width="120" />
</p>

<p align="center">
  <strong>Production-grade, offline-first POS system for German/EU retail</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## ✨ Features

| Feature | Status |
|---|---|
| 🛒 Full checkout flow (cart → payment → receipt) | ✅ |
| 💶 German VAT engine (19% / 7% / 0%) with banker's rounding | ✅ |
| 🖨️ ESC/POS receipt printing (USB / Serial / Network) | ✅ |
| 📦 Barcode scanning (HID / USB) | ✅ |
| 💰 Multi-payment (Cash, EC, Credit, Contactless) | ✅ |
| 🔄 Multi-terminal LAN sync (offline-first) | ✅ |
| 🧾 GoBD / KassenSichV fiscal event logging | ✅ |
| 👥 Role-based access control | ✅ |
| 📊 Shift management & reports | ✅ |
| 🏪 Multi-store / multi-branch support | ✅ |
| 💻 Linux Kiosk mode (autostart, no decorations) | ✅ |
| 🪟 Windows / Linux / macOS packages | ✅ |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + TailwindCSS + Zustand |
| **Desktop** | Electron 28 (context isolation, secure IPC) |
| **Build** | Vite 5 + Turborepo |
| **Database** | SQLite via Prisma (WAL mode, offline-first) |
| **Validation** | Zod schemas (shared frontend/backend) |
| **Testing** | Vitest |
| **Packaging** | electron-builder (NSIS / AppImage / DMG) |
| **CI/CD** | GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run

```bash
# Clone the repository
git clone https://github.com/alhu2591/nexuspos.git
cd nexuspos

# Install all dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database (creates nexuspos.db)
npm run db:push

# Seed with demo data
npm run db:seed

# Start in development mode
npm run dev
```

### Default Login Credentials (after seed)

| Username | Password | PIN | Role |
|---|---|---|---|
| `admin` | `admin123` | `1234` | Administrator |
| `kassierer` | `kasse123` | `5678` | Kassierer |

---

## 🏗 Architecture

```
nexuspos/
├── packages/
│   ├── main/          # Electron main process (Node.js)
│   │   ├── ipc/       # IPC handler registration
│   │   ├── hardware/  # ESC/POS, barcode adapters
│   │   ├── fiscal/    # TSE / GoBD / KassenSichV
│   │   ├── sync/      # Multi-terminal LAN sync
│   │   ├── printing/  # Receipt builder
│   │   └── database/  # Prisma + WAL mode
│   │
│   ├── renderer/      # React application
│   │   ├── features/  # Feature modules (checkout, products...)
│   │   ├── stores/    # Zustand stores
│   │   └── services/  # IPC service wrappers
│   │
│   ├── shared/        # Shared types, schemas, business logic
│   │   └── utils/     # VAT engine, discount engine
│   │
│   └── database/      # Prisma schema + migrations + seed
│
├── scripts/kiosk/     # Linux kiosk deployment scripts
└── .github/workflows/ # CI/CD pipeline
```

### Key Design Decisions

- **All money in integer cents** — no floating point arithmetic
- **Banker's rounding** — fiscally accurate VAT calculations
- **Offline-first** — all data written locally, synced asynchronously
- **Event-sourced sync** — vector clocks for conflict resolution
- **Secure IPC** — whitelist-only channels, payload sanitization
- **Adapter pattern** — hardware independence (mock/USB/serial/network)

---

## 🖥 Deployment

### Linux Kiosk (Ubuntu/Debian)

```bash
# Run as root on the target machine
chmod +x scripts/kiosk/setup-kiosk.sh
sudo scripts/kiosk/setup-kiosk.sh

# Copy AppImage to /opt/nexuspos/nexuspos
# Reboot — system auto-logs in and launches POS
```

### Build Packages

```bash
# Build for all platforms
npm run build

# Package Windows installer
npm run package:win

# Package Linux AppImage + deb
npm run package:linux

# Package macOS DMG
npm run package:mac
```

---

## 🔒 Security

- Electron `contextIsolation: true` + `nodeIntegration: false`
- IPC channel whitelist in preload.ts
- All IPC payloads validated with Zod
- Content Security Policy configured
- Soft deletes — full audit trail
- Session tokens expire (8h password, 4h PIN)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test -- --coverage

# Run specific package tests
cd packages/shared && npm test
```

---

## 📋 Fiscal Compliance (Germany)

- **KassenSichV** — TSE adapter interface (provider-agnostic)
- **GoBD** — append-only audit log, no hard deletes
- **Kassenbeleg-V1** — standard process type implemented
- **MwSt-Ausweis** — full VAT breakdown on receipts

> **Note:** Mock TSE adapter included for development. Production deployments require a certified TSE (e.g., Swissbit, CryptoVision).

---

## 📄 License

MIT © 2024 NexusPOS

---

<p align="center">Built with ❤️ for German retail</p>
