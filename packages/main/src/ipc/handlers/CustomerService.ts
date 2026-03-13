// NexusPOS — Customer IPC Handler

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { CreateCustomerSchema, CustomerSearchSchema } from '@nexuspos/shared';
import { AppError } from '../../utils/AppError';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('CustomerService');

export class CustomerService {
  private readonly db: PrismaClient;

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async searchCustomers(rawPayload: unknown) {
    const payload = CustomerSearchSchema.parse(rawPayload);

    return this.db.customer.findMany({
      where: {
        storeId: payload.storeId,
        isActive: true,
        OR: [
          { firstName: { contains: payload.query } },
          { lastName: { contains: payload.query } },
          { email: { contains: payload.query } },
          { phone: { contains: payload.query } },
          { customerNum: { contains: payload.query } }, // schema: customerNum (not customerNumber)
        ],
      },
      take: payload.limit,
      orderBy: { lastName: 'asc' },
    });
  }

  async findCustomer(rawPayload: unknown) {
    const { customerId } = rawPayload as { customerId: string };

    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            saleNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer not found', false);
    return customer;
  }

  async createCustomer(rawPayload: unknown) {
    const payload = CreateCustomerSchema.parse(rawPayload);

    if (payload.email) {
      const existing = await this.db.customer.findFirst({
        where: { storeId: payload.storeId, email: payload.email },
      });
      if (existing) throw new AppError('EMAIL_EXISTS', 'A customer with this email already exists', false);
    }

    const count = await this.db.customer.count({ where: { storeId: payload.storeId } });
    const customerNum = `KD-${String(count + 1).padStart(6, '0')}`;

    const customer = await this.db.customer.create({
      data: {
        id: createId(),
        customerNum, // schema field is customerNum (not customerNumber)
        ...payload,
      },
    });

    logger.info(`Customer created: ${customerNum}`);
    return customer;
  }

  async updateCustomer(rawPayload: unknown) {
    const { id, ...data } = rawPayload as Record<string, unknown>;

    if (!id || typeof id !== 'string') {
      throw new AppError('MISSING_ID', 'Customer ID is required', false);
    }

    const existing = await this.db.customer.findUnique({ where: { id } });
    if (!existing) throw new AppError('CUSTOMER_NOT_FOUND', 'Customer not found', false);

    return this.db.customer.update({
      where: { id },
      data: { ...(data as any), updatedAt: new Date() },
    });
  }
}
