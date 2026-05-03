/**
 * @file word-renderer.service.ts
 * @description docx@9-based Word renderer. Builds .docx documents from
 *   typed Document trees and returns them as Buffers. The historical
 *   "Word cannot open file" bug came from manually setting Content-Length
 *   in controllers; we centralise streaming via `sendBinary()` and let
 *   Express compute the length itself.
 */

import { Injectable } from '@nestjs/common';
import { Document, Packer } from 'docx';

@Injectable()
export class WordRendererService {
  /** Pack a typed Document into a Buffer suitable for sendBinary(). */
  async render(doc: Document): Promise<Buffer> {
    const buffer = await Packer.toBuffer(doc);
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }
}