/**
 * @file storage.service.ts
 * @description Storage driver registry. Picks the default driver for new
 *   uploads based on STORAGE_DRIVER env var, and resolves the per-asset
 *   driver for reads/deletes (so old files keep working after migration).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './local-storage.driver';
import { R2StorageDriver } from './r2-storage.driver';
import { StorageDriver } from './storage-driver.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly drivers = new Map<string, StorageDriver>();
  private readonly defaultDriverName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly local: LocalStorageDriver,
    private readonly r2: R2StorageDriver,
  ) {
    this.drivers.set(this.local.name, this.local);
    if (this.r2.isEnabled()) {
      this.drivers.set(this.r2.name, this.r2);
    }

    this.defaultDriverName = this.config.get<string>(
      'STORAGE_DRIVER',
      'local',
    );

    if (!this.drivers.has(this.defaultDriverName)) {
      this.logger.warn(
        `STORAGE_DRIVER=${this.defaultDriverName} not available, falling back to local`,
      );
    }
    this.logger.log(`Default storage driver: ${this.getDefault().name}`);
  }

  /** Driver for NEW uploads. */
  getDefault(): StorageDriver {
    return (
      this.drivers.get(this.defaultDriverName) ?? this.local
    );
  }

  /** Driver for an EXISTING asset (read/delete). */
  getByName(name: string): StorageDriver {
    return this.drivers.get(name) ?? this.local;
  }

  /** All registered drivers (used by health checks). */
  listDrivers(): string[] {
    return Array.from(this.drivers.keys());
  }

  rootDir(): string {
  return this.local.rootDir();
}
}
