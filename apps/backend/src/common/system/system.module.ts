import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { GlobalUsersService } from './global-users.service';
import { DatabaseService } from './database.service';
import { SystemController } from './system.controller';

@Module({
  providers: [SystemService, GlobalUsersService, DatabaseService],
  controllers: [SystemController],
  exports: [SystemService, GlobalUsersService, DatabaseService],
})
export class SystemModule {}
