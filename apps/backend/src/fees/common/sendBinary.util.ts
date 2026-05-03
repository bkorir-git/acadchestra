/**
 * @file sendBinary.util.ts
 * @description Centralised binary streaming helper. The historical
 *   "Word cannot open file" / "PDF is corrupt" bug came from manually
 *   setting Content-Length, which collided with downstream middleware
 *   (compression, response transform). We now let Express compute it.
 *
 */

import type { Response } from 'express';

export const MIME = {
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
  CSV: 'text/csv; charset=utf-8',
} as const;

export function sendBinary(
  res: Response,
  buffer: Buffer,
  mime: string,
  filename: string,
): void {
  const asciiOnly =
    filename
      .replace(/[^\x20-\x7E]/g, '') // drop non-ASCII / control chars
      .replace(/["\\\r\n]/g, '') // drop header-unsafe chars
      .trim() || 'download';

  // RFC 5987 encoded version carries the full Unicode name safely.
  const encoded = encodeURIComponent(filename.trim() || 'download');

  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiOnly}"; filename*=UTF-8''${encoded}`,
  );
  res.setHeader('Content-Transfer-Encoding', 'binary');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(buffer);
}
