import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [ 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Database disconnected');
  }

  async cleanDb() {
    // For testing purposes
    if (process.env.NODE_ENV === 'production') return;
    
    // Get all model names dynamically
    const modelNames = Object.keys(this).filter(
      key => !key.startsWith('_') && !key.startsWith('$') && typeof this[key as keyof this] === 'object'
    );
    
    return Promise.all(
      modelNames.map((modelName) => {
        const model = this[modelName as keyof this] as any;
        if (model && typeof model.deleteMany === 'function') {
          return model.deleteMany();
        }
      }).filter(Boolean)
    );
  }
}