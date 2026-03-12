// NexusPOS — Customer IPC Handler

import type { DatabaseManager } from '../../database/DatabaseManager';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('CustomerService');

export class CustomerService {
  constructor(private db: DatabaseManager) {}

  async searchCustomers(payload: { query: string; limit?: number }) {
    const { query, limit = 20 } = payload;
    const customers = await this.db.client.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { customerNumber: { contains: query } },
        ],
      },
      take: limit,
      orderBy: { lastName: 'asc' },
    });
    return customers;
  }

  async findCustomer(payload: { id: string }) {
    const customer = await this.db.client.customer.findUnique({
      where: { id: payload.id },
      include: { sales: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async createCustomer(payload: {
    storeId: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }) {
    const count = await this.db.client.customer.count({ where: { storeId: payload.storeId } });
    const customerNumber = `C${String(count + 1).padStart(6, '0')}`;
    const customer = await this.db.client.customer.create({
      data: { ...payload, customerNumber },
    });
    logger.info('Customer created', { id: customer.id, customerNumber });
    return customer;
  }

  async updateCustomer(payload: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }) {
    const { id, ...data } = payload;
    return this.db.client.customer.update({ where: { id }, data });
  }
}
