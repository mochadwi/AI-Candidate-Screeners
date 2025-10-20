import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';
import { FileInfo, FileType } from '../models';
import { RequestHandler } from 'express';

export class FileService {
  private uploadDir: string;
  private maxFileSize: number;

  constructor() {
    this.uploadDir = config.upload.uploadDir;
    this.maxFileSize = config.upload.maxFileSize;
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private getMulterConfig(type: FileType): multer.Options {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, `${type}_${uniqueSuffix}${extension}`);
      }
    });

    const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    };

    return {
      storage,
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter
    };
  }

  getUploadMiddleware(type: FileType): RequestHandler {
    return multer(this.getMulterConfig(type)).single('file');
  }

  async saveFileInfo(
    file: Express.Multer.File,
    type: FileType
  ): Promise<FileInfo> {
    const fileInfo: FileInfo = {
      id: uuidv4(),
      originalName: file.originalname,
      path: file.path,
      type,
      size: file.size,
      uploadedAt: new Date()
    };

    return fileInfo;
  }

  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);

      return {
        id: path.parse(filename).name,
        originalName: filename,
        path: filePath,
        type: filename.startsWith('cv_') ? 'cv' : 'project',
        size: stats.size,
        uploadedAt: stats.mtime
      };
    } catch {
      return null;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async validateFileExists(fileId: string, type: FileType): Promise<FileInfo | null> {
    try {
      const files = await fs.readdir(this.uploadDir);
      const filename = files.find(file =>
        file.startsWith(`${type}_`) && file.includes(fileId)
      );

      if (!filename) {
        return null;
      }

      const filePath = path.join(this.uploadDir, filename);
      return await this.getFileInfo(filePath);
    } catch {
      return null;
    }
  }
}