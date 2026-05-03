/**
 * @file pdf-renderer.service.ts
 * @description Puppeteer-based PDF renderer. Replaces the broken pdfkit
 *   pipeline with full HTML/CSS templates that look identical to a printed
 *   browser page. The Chromium instance is launched once and reused; on
 *   shutdown it's torn down cleanly via OnModuleDestroy.
 *
 *   Usage:
 *     const buf = await pdf.renderHtml(html, { format: 'A4', landscape: false });
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import puppeteer, { Browser, PaperFormat } from 'puppeteer';

export interface RenderOptions {
  format?: PaperFormat;
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

@Injectable()
export class PdfRendererService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async onModuleInit(): Promise<void> {
    // Lazy launch — first request triggers it.
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        this.logger.warn(`Browser close error: ${(e as Error).message}`);
      }
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    if (this.launching) return this.launching;
    this.launching = puppeteer
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      })
      .then((b) => {
        this.browser = b;
        this.launching = null;
        this.logger.log('Puppeteer launched');
        return b;
      })
      .catch((err) => {
        this.launching = null;
        throw err;
      });
    return this.launching;
  }

  async renderHtml(html: string, options: RenderOptions = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 30_000,
      });
      const pdf = await page.pdf({
        format: options.format ?? 'A4',
        landscape: options.landscape ?? false,
        printBackground: options.printBackground ?? true,
        margin: options.margin ?? {
          top: '15mm',
          right: '12mm',
          bottom: '15mm',
          left: '12mm',
        },
        displayHeaderFooter: options.displayHeaderFooter ?? false,
        headerTemplate: options.headerTemplate ?? '<div></div>',
        footerTemplate:
          options.footerTemplate ??
          '<div style="font-size:8px;width:100%;text-align:center;color:#999;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      });
      return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}