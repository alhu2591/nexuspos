// NexusPOS — Database Seed Script
// Creates initial store, device, users, tax rules, and sample products

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'nexuspos-salt').digest('hex');
}

async function main() {
  console.log('🌱 Seeding NexusPOS database...');

  // ── STORE ─────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { id: 'store-demo-001' },
    update: {},
    create: {
      id: 'store-demo-001',
      name: 'Demo Store',
      legalName: 'Demo Store GmbH',
      taxId: 'DE123456789',
      address: 'Musterstraße 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      phone: '+49 30 12345678',
      email: 'info@demostore.de',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
      locale: 'de-DE',
    },
  });
  console.log('✅ Store created:', store.name);

  // ── BRANCH ────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-demo-001' },
    update: {},
    create: {
      id: 'branch-demo-001',
      storeId: store.id,
      name: 'Hauptfiliale',
      address: 'Musterstraße 1',
      city: 'Berlin',
      postalCode: '10115',
    },
  });

  // ── DEVICE ────────────────────────────────────────────────
  const device = await prisma.device.upsert({
    where: { id: 'device-demo-001' },
    update: {},
    create: {
      id: 'device-demo-001',
      storeId: store.id,
      branchId: branch.id,
      name: 'Kasse 1',
      deviceType: 'POS_TERMINAL',
      isPrimary: true,
      platformOS: process.platform,
      appVersion: '1.0.0',
    },
  });
  console.log('✅ Device created:', device.name);

  // ── DEVICE CONFIG ─────────────────────────────────────────
  await prisma.deviceConfig.upsert({
    where: { deviceId: device.id },
    update: {},
    create: {
      deviceId: device.id,
      barcodeEnabled: true,
      barcodeInputMethod: 'hid',
      cashDrawerEnabled: false,
      customerDisplayEnabled: false,
      kioskMode: false,
      touchscreenMode: false,
      idleTimeoutMin: 15,
    },
  });

  // ── ROLES ─────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { id: 'role-admin' },
    update: {},
    create: {
      id: 'role-admin',
      name: 'Administrator',
      description: 'Full system access',
      isSystem: true,
      permissions: {
        create: [
          'checkout', 'products', 'categories', 'inventory', 'customers',
          'receipts', 'invoices', 'payments', 'discounts', 'taxes',
          'shifts', 'reports', 'settings', 'users', 'devices', 'fiscal', 'audit',
        ].flatMap(resource => ['read', 'write', 'delete', 'void', 'admin'].map(action => ({
          id: createId(),
          resource,
          action,
        }))),
      },
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { id: 'role-cashier' },
    update: {},
    create: {
      id: 'role-cashier',
      name: 'Kassierer',
      description: 'Checkout and basic operations',
      isSystem: true,
      permissions: {
        create: [
          { id: createId(), resource: 'checkout', action: 'read' },
          { id: createId(), resource: 'checkout', action: 'write' },
          { id: createId(), resource: 'products', action: 'read' },
          { id: createId(), resource: 'customers', action: 'read' },
          { id: createId(), resource: 'customers', action: 'write' },
          { id: createId(), resource: 'receipts', action: 'read' },
          { id: createId(), resource: 'shifts', action: 'read' },
          { id: createId(), resource: 'shifts', action: 'write' },
        ],
      },
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { id: 'role-manager' },
    update: {},
    create: {
      id: 'role-manager',
      name: 'Manager',
      description: 'Store manager access',
      isSystem: true,
      permissions: {
        create: [
          'checkout', 'products', 'categories', 'inventory', 'customers',
          'receipts', 'invoices', 'payments', 'discounts', 'taxes',
          'shifts', 'reports',
        ].flatMap(resource => ['read', 'write', 'delete', 'void'].map(action => ({
          id: createId(),
          resource,
          action,
        }))),
      },
    },
  });

  console.log('✅ Roles created: Admin, Manager, Kassierer');

  // ── USERS ─────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { id: 'user-admin-001' },
    update: {},
    create: {
      id: 'user-admin-001',
      storeId: store.id,
      username: 'admin',
      email: 'admin@demostore.de',
      passwordHash: hashPassword('admin123'),
      pin: hashPassword('1234'),
      firstName: 'System',
      lastName: 'Administrator',
      roleId: adminRole.id,
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { id: 'user-cashier-001' },
    update: {},
    create: {
      id: 'user-cashier-001',
      storeId: store.id,
      username: 'kassierer',
      email: 'kassierer@demostore.de',
      passwordHash: hashPassword('kasse123'),
      pin: hashPassword('5678'),
      firstName: 'Max',
      lastName: 'Mustermann',
      roleId: cashierRole.id,
    },
  });

  console.log('✅ Users created: admin (PIN: 1234), kassierer (PIN: 5678)');

  // ── TAX RULES ─────────────────────────────────────────────
  const tax19 = await prisma.taxRule.upsert({
    where: { id: 'tax-19' },
    update: {},
    create: {
      id: 'tax-19',
      storeId: store.id,
      name: 'MwSt. 19%',
      rate: 1900,
      taxClass: 'standard',
      isDefault: true,
    },
  });

  const tax7 = await prisma.taxRule.upsert({
    where: { id: 'tax-7' },
    update: {},
    create: {
      id: 'tax-7',
      storeId: store.id,
      name: 'MwSt. 7%',
      rate: 700,
      taxClass: 'reduced',
      isDefault: false,
    },
  });

  const tax0 = await prisma.taxRule.upsert({
    where: { id: 'tax-0' },
    update: {},
    create: {
      id: 'tax-0',
      storeId: store.id,
      name: 'Steuerfrei',
      rate: 0,
      taxClass: 'zero',
      isDefault: false,
    },
  });

  console.log('✅ Tax rules: 19%, 7%, 0%');

  // ── CATEGORIES ────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-food' },
      update: {},
      create: { id: 'cat-food', storeId: store.id, name: 'Lebensmittel', colorHex: '#22c55e', sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { id: 'cat-drinks' },
      update: {},
      create: { id: 'cat-drinks', storeId: store.id, name: 'Getränke', colorHex: '#3b82f6', sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { id: 'cat-electronics' },
      update: {},
      create: { id: 'cat-electronics', storeId: store.id, name: 'Elektronik', colorHex: '#8b5cf6', sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { id: 'cat-clothing' },
      update: {},
      create: { id: 'cat-clothing', storeId: store.id, name: 'Bekleidung', colorHex: '#f59e0b', sortOrder: 4 },
    }),
    prisma.category.upsert({
      where: { id: 'cat-services' },
      update: {},
      create: { id: 'cat-services', storeId: store.id, name: 'Dienstleistungen', colorHex: '#ec4899', sortOrder: 5 },
    }),
  ]);
  console.log('✅ Categories created: 5');

  // ── PRODUCTS ──────────────────────────────────────────────
  const products = [
    // Food (7% VAT)
    { id: 'prod-001', sku: 'BROT-001', barcode: '4001234000010', name: 'Vollkornbrot 500g', unitPrice: 299, catId: 'cat-food', taxId: 'tax-7' },
    { id: 'prod-002', sku: 'MLCH-001', barcode: '4001234000027', name: 'Bio-Milch 1L', unitPrice: 149, catId: 'cat-food', taxId: 'tax-7' },
    { id: 'prod-003', sku: 'KÄSE-001', barcode: '4001234000034', name: 'Gouda Scheiben 400g', unitPrice: 399, catId: 'cat-food', taxId: 'tax-7' },
    { id: 'prod-004', sku: 'APFL-001', barcode: '4001234000041', name: 'Äpfel 1kg', unitPrice: 249, catId: 'cat-food', taxId: 'tax-7' },
    { id: 'prod-005', sku: 'SCHL-001', barcode: '4001234000058', name: 'Schokolade 100g', unitPrice: 199, catId: 'cat-food', taxId: 'tax-7' },
    // Drinks (19% VAT)
    { id: 'prod-006', sku: 'COLA-001', barcode: '5000112637922', name: 'Coca-Cola 0,5L', unitPrice: 250, catId: 'cat-drinks', taxId: 'tax-19' },
    { id: 'prod-007', sku: 'WASS-001', barcode: '4001234000072', name: 'Mineralwasser 1,5L', unitPrice: 99, catId: 'cat-drinks', taxId: 'tax-19' },
    { id: 'prod-008', sku: 'KFFE-001', barcode: '4001234000089', name: 'Kaffee Espresso', unitPrice: 350, catId: 'cat-drinks', taxId: 'tax-19' },
    { id: 'prod-009', sku: 'BEER-001', barcode: '4001234000096', name: 'Bier 0,5L', unitPrice: 199, catId: 'cat-drinks', taxId: 'tax-19' },
    // Electronics (19% VAT)
    { id: 'prod-010', sku: 'USB-001', barcode: '4001234000102', name: 'USB-Kabel 1m', unitPrice: 999, catId: 'cat-electronics', taxId: 'tax-19' },
    { id: 'prod-011', sku: 'HDMI-001', barcode: '4001234000119', name: 'HDMI Kabel 2m', unitPrice: 1499, catId: 'cat-electronics', taxId: 'tax-19' },
    { id: 'prod-012', sku: 'AKKU-001', barcode: '4001234000126', name: 'Powerbank 10000mAh', unitPrice: 3999, catId: 'cat-electronics', taxId: 'tax-19' },
    // Clothing (19% VAT)
    { id: 'prod-013', sku: 'TSHRT-001', barcode: '4001234000133', name: 'T-Shirt Weiß Gr. M', unitPrice: 1999, catId: 'cat-clothing', taxId: 'tax-19' },
    { id: 'prod-014', sku: 'SOCKE-001', barcode: '4001234000140', name: 'Socken 3er Pack', unitPrice: 599, catId: 'cat-clothing', taxId: 'tax-19' },
    // Services (19% VAT)
    { id: 'prod-015', sku: 'SRV-001', barcode: null, name: 'Beratung (Std.)', unitPrice: 9000, catId: 'cat-services', taxId: 'tax-19', isService: true },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        storeId: store.id,
        categoryId: p.catId,
        taxRuleId: p.taxId,
        sku: p.sku,
        barcode: p.barcode ?? undefined,
        name: p.name,
        unitPrice: p.unitPrice,
        taxInclusive: true,
        isActive: true,
        isService: (p as any).isService ?? false,
        allowDiscount: true,
      },
    });

    // Create inventory for non-service products
    if (!(p as any).isService) {
      await prisma.inventoryItem.upsert({
        where: { productId: p.id },
        update: {},
        create: {
          id: createId(),
          productId: p.id,
          quantity: Math.floor(Math.random() * 100) + 10,
          reservedQty: 0,
        },
      });
    }
  }

  console.log(`✅ Products created: ${products.length}`);

  // ── DISCOUNT RULES ────────────────────────────────────────
  await prisma.discountRule.upsert({
    where: { id: 'discount-welcome' },
    update: {},
    create: {
      id: 'discount-welcome',
      storeId: store.id,
      name: 'Willkommensrabatt 10%',
      discountType: 'PERCENTAGE',
      value: 1000,
      scope: 'CART',
      couponCode: 'WELCOME10',
      isActive: true,
    },
  });

  await prisma.discountRule.upsert({
    where: { id: 'discount-5eur' },
    update: {},
    create: {
      id: 'discount-5eur',
      storeId: store.id,
      name: '5€ Rabatt ab 50€',
      discountType: 'FIXED_AMOUNT',
      value: 500,
      scope: 'CART',
      minAmount: 5000,
      isActive: true,
    },
  });

  console.log('✅ Discount rules: 2');

  // ── STORE SETTINGS ────────────────────────────────────────
  const settings = [
    { key: 'receipt.headerText', value: 'Vielen Dank für Ihren Einkauf!' },
    { key: 'receipt.footerText', value: 'Besuchen Sie uns wieder!' },
    { key: 'receipt.showLogo', value: 'false' },
    { key: 'receipt.paperWidth', value: '80' },
    { key: 'invoice.numberPrefix', value: 'INV' },
    { key: 'invoice.nextNumber', value: '1' },
    { key: 'pos.requireShift', value: 'true' },
    { key: 'pos.allowNegativeInventory', value: 'false' },
    { key: 'pos.defaultTaxRuleId', value: 'tax-19' },
  ];

  for (const s of settings) {
    await prisma.storeSetting.upsert({
      where: { storeId_key: { storeId: store.id, key: s.key } },
      update: { value: s.value },
      create: { id: createId(), storeId: store.id, key: s.key, value: s.value },
    });
  }

  // ── RECEIPT TEMPLATE ──────────────────────────────────────
  await prisma.receiptTemplate.upsert({
    where: { id: 'tpl-receipt-default' },
    update: {},
    create: {
      id: 'tpl-receipt-default',
      storeId: store.id,
      name: 'Standard Kassenbon',
      isDefault: true,
      headerText: 'Willkommen!',
      footerText: 'Auf Wiedersehen!',
      showLogo: false,
      showBarcode: false,
      showQrCode: false,
      paperWidth: 80,
      templateData: JSON.stringify({ version: '1.0' }),
    },
  });

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   Username: admin     | Password: admin123 | PIN: 1234');
  console.log('   Username: kassierer | Password: kasse123 | PIN: 5678');
  console.log('\n🏪 Store: Demo Store (ID: store-demo-001)');
  console.log('💻 Device: Kasse 1 (ID: device-demo-001)');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
