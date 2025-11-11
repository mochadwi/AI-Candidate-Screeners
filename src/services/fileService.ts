import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/environment";
import { FileInfo, FileType } from "../models";
import { RequestHandler } from "express";

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
      },
    });

    const fileFilter = (
      req: any,
      file: Express.Multer.File,
      cb: multer.FileFilterCallback,
    ) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files are allowed"));
      }
    };

    return {
      storage,
      limits: {
        fileSize: this.maxFileSize,
      },
      fileFilter,
    };
  }

  getUploadMiddleware(type: FileType): RequestHandler {
    return multer(this.getMulterConfig(type)).single("file");
  }

  async saveFileInfo(
    file: Express.Multer.File,
    type: FileType,
  ): Promise<FileInfo | null> {
    const filename = file.filename;
    const fullPath = path.join(this.uploadDir, filename);
    const fileId = path.parse(filename).name.replace(/^(cv_|project_)/, "");
    const fileInfo: FileInfo = {
      id: fileId,
      originalName: file.originalname,
      size: file.size,
      type,
      path: fullPath,
      uploadedAt: new Date(),
    };

    // Check if file already exists to avoid duplicates and use existing file path
    try {
      await fs.access(fullPath);
      console.log(`⚠️ File already exists, using existing: ${fullPath}`);

      // Return existing file info instead of creating new one
      const existingFileInfo = this.getFileInfo(fullPath);
      if (existingFileInfo !== null) {
        return existingFileInfo;
      }
    } catch {
      // File doesn't exist
    }

    console.log(`📝 Saved file: ${filename} with ID: ${fileInfo.id}`);
    return fileInfo;
  }

  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);
      const fileId = path.parse(filename).name.replace(/^(cv_|project_)/, "");
      return {
        id: fileId,
        originalName: filename,
        path: filePath,
        type: filename.startsWith("cv_") ? "cv" : "project",
        size: stats.size,
        uploadedAt: stats.mtime,
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

  async validateFileExists(
    fileId: string,
    type: FileType,
  ): Promise<FileInfo | null> {
    try {
      const files = await fs.readdir(this.uploadDir);
      const filename = files.find((file) =>
        file.startsWith(`${type}_${fileId}`),
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
