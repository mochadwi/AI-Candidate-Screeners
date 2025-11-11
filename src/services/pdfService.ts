import fs from 'fs/promises';
import { PDFParseResult } from '../models';
import { AppError } from '../middleware/errorHandler';
const pdfParse = require('pdf-parse');

export class PDFService {
  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      console.log('📄 Processing PDF:', filePath, '(' + stats.size + ' bytes)');
      const dataBuffer = await fs.readFile(filePath);
      console.log('📖 PDF buffer size:', dataBuffer.length, 'bytes');
      console.log('🔍 Starting PDF text extraction for:', filePath);
      const data = await pdfParse(dataBuffer) as PDFParseResult;
      console.log('✅ PDF extraction completed. Pages:', data.numpages, ', Text length:', data.text?.length || 0);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      console.error('❌ PDF extraction failed for', filePath + ':', error);
      console.error('🔍 Error type:', errorType);
      console.error('🔍 Error message:', errorMessage);
      throw new AppError('Failed to extract text from PDF file', 500);
    }
  }
}