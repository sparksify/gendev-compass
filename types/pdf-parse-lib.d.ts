/**
 * Minimal type declaration for pdf-parse's inner module. Imported from
 * "pdf-parse/lib/pdf-parse.js" rather than the package root — see the
 * comment in lib/territory/reportImport.ts for why — which @types/pdf-parse
 * doesn't cover (it only declares the "pdf-parse" root).
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdfParse;
}
