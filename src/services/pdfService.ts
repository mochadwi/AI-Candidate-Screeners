import fs from 'fs/promises';
import { PDFParseResult } from '../models';
import { AppError } from '../middleware/errorHandler';

const pdfParse = require('pdf-parse');

export class PDFService {
  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      // Check if file exists
      await fs.access(filePath);

      // Read the PDF file
      const dataBuffer = await fs.readFile(filePath);

      // Extract text using pdf-parse
      const data = await pdfParse(dataBuffer) as PDFParseResult;

      // Validate extracted text
      if (!data.text || data.text.trim().length === 0) {
        throw new AppError('No text could be extracted from the PDF file', 400);
      }

      if (data.numpages === 0) {
        throw new AppError('PDF file appears to be empty or corrupted', 400);
      }

      return data.text.trim();

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new AppError('PDF file not found', 404);
        }
        if (error.message.includes('EACCES')) {
          throw new AppError('Permission denied accessing PDF file', 403);
        }
        if (error.message.includes('Invalid PDF')) {
          throw new AppError('Invalid or corrupted PDF file', 400);
        }
      }

      throw new AppError('Failed to extract text from PDF file', 500);
    }
  }

  async extractTextFromMultiplePDFs(filePaths: string[]): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};

    for (const filePath of filePaths) {
      try {
        const text = await this.extractTextFromPDF(filePath);
        results[filePath] = text;
      } catch (error) {
        // Continue with other files even if one fails
        console.error(`Failed to extract text from ${filePath}:`, error);
        results[filePath] = '';
      }
    }

    return results;
  }

  async validatePDFFile(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);

      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer) as PDFParseResult;

      return data.numpages > 0 && data.text.trim().length > 0;

    } catch {
      return false;
    }
  }

  async getPDFInfo(filePath: string): Promise<PDFParseResult | null> {
    try {
      await fs.access(filePath);

      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer) as PDFParseResult;

      return data;

    } catch {
      return null;
    }
  }

  cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers and headers/footers patterns
      .replace(/\n\s*\d+\s*\n/g, '\n')
      // Remove email addresses for privacy
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      // Remove phone numbers for privacy
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
      // Clean up extra newlines
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
}