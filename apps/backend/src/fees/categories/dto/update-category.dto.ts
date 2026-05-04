/**
 * @file update-category.dto.ts
 * @description Partial update for a fee category. Mirrors create with all
 *   fields optional; controller forbids changing `baseCategory` once the
 *   category has components attached (to keep reporting groups stable)
 */

import { PartialType } from '@nestjs/swagger';
import { CreateFeeCategoryDto } from './create-category.dto';

export class UpdateFeeCategoryDto extends PartialType(CreateFeeCategoryDto) {}