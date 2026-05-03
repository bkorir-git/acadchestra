import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParseDateOptions {
  label?: string;
  endOfDay?: boolean;
  defaultValue?: Date;
}

function invalid(label: string, value: unknown): never {
  throw new BadRequestException(`${label} is invalid: ${String(value)}`);
}

export function parseOptionalDateInput(
  value?: string | Date | null,
  options: ParseDateOptions = {},
): Date | undefined {
  const { label = 'date', endOfDay = false, defaultValue } = options;

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) invalid(label, value);
    return value;
  }

  if (typeof value !== 'string') invalid(label, value);

  if (DATE_ONLY_RE.test(value)) {
    const parsed = new Date(
      `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
    );
    if (Number.isNaN(parsed.getTime())) invalid(label, value);
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid(label, value);
  return parsed;
}

export function parseRequiredDateInput(
  value: string | Date,
  options: ParseDateOptions = {},
): Date {
  const parsed = parseOptionalDateInput(value, options);
  if (!parsed) invalid(options.label ?? 'date', value);
  return parsed;
}
