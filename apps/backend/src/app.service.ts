import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to Acadchestra API! 🎓 Orchestrating Education Excellence';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Acadchestra API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}