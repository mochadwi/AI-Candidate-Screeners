import { FileService } from '../../src/services/fileService';
import { FileType } from '../../src/models';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock uuid
jest.mock('uuid');
const mockUUID = require('uuid');
mockUUID.v4.mockReturnValue('test-uuid-123');

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService();
    jest.clearAllMocks();
  });

  describe('saveFileInfo', () => {
    it('should save file info with correct structure', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        path: '/uploads/test-uuid-123.pdf',
        size: 1024
      };

      mockFs.access.mockResolvedValue(undefined);

      const result = await fileService.saveFileInfo(mockFile as any, 'cv');

      expect(result).toEqual({
        id: 'test-uuid-123',
        originalName: 'test.pdf',
        path: '/uploads/test-uuid-123.pdf',
        type: 'cv',
        size: 1024,
        uploadedAt: expect.any(Date)
      });
    });
  });

  describe('validateFileExists', () => {
    it('should return file info when file exists', async () => {
      mockFs.readdir.mockResolvedValue(['cv_test-uuid-123.pdf'] as any);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 1024
      } as any);

      const result = await fileService.validateFileExists('test-uuid-123', 'cv');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-uuid-123');
      expect(result?.type).toBe('cv');
    });

    it('should return null when file does not exist', async () => {
      mockFs.readdir.mockResolvedValue(['other-file.pdf'] as any);

      const result = await fileService.validateFileExists('test-uuid-123', 'cv');

      expect(result).toBeNull();
    });

    it('should handle fs.readdir errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await fileService.validateFileExists('test-uuid-123', 'cv');

      expect(result).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await fileService.deleteFile('/uploads/test.pdf');

      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith('/uploads/test.pdf');
    });

    it('should return false when file deletion fails', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      const result = await fileService.deleteFile('/uploads/non-existent.pdf');

      expect(result).toBe(false);
    });
  });
});