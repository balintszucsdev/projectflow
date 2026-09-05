#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/32e16c0c3a2775de3f3c3a8059d41bfbabfe50d4de4951406aff841cf596ef70/contract';
import startContract from '../../snapshots/32e16c0c3a2775de3f3c3a8059d41bfbabfe50d4de4951406aff841cf596ef70/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8fdee3b691ef96564d673c0a46c5332f35b860abf4754bcab9d0a4a1351b1d5b/contract';
import endContract from '../../snapshots/8fdee3b691ef96564d673c0a46c5332f35b860abf4754bcab9d0a4a1351b1d5b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addCheckConstraint({
        schema: 'public',
        table: 'project',
        constraint: 'project_status_check_aebaa98b',
        expression: "\"status\" IN ('PLANNED', 'ACTIVE', 'COMPLETED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
