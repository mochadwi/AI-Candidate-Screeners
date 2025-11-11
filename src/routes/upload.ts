import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/environment";
import { FileService } from "../services/fileService";
import { AppError } from "../middleware/errorHandler";
import { UploadResponse, FileType } from "../models";

const router = Router();
const fileService = new FileService();

// Ensure upload directory exists
const ensureUploadDir = async () => {
  try {
    await fs.access(config.upload.uploadDir);
  } catch {
    await fs.mkdir(config.upload.uploadDir, { recursive: true });
  }
};

// Initialize upload directory
ensureUploadDir();

// Middleware to handle multiple file uploads (CV and project)
const validateMultipleFiles = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, config.upload.uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = uuidv4();
      const extension = path.extname(file.originalname);
      cb(null, `${file.fieldname}_${uniqueSuffix}${extension}`);
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

  const uploadMiddleware = multer({
    storage,
    limits: {
      fileSize: config.upload.maxFileSize,
    },
    fileFilter,
  }).fields([
    { name: "cv", maxCount: 1 },
    { name: "project", maxCount: 1 },
  ]);

  uploadMiddleware(req, res, (error: any) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            "File size too large. Maximum size is 10MB per file",
            400,
          ),
        );
      }
      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError(
            "Unexpected field name. Use 'cv' and 'project' as field names",
            400,
          ),
        );
      }
      return next(new AppError(`File upload error: ${error.message}`, 400));
    }

    if (error) {
      return next(new AppError(error.message, 400));
    }

    next();
  });
};

// Upload both CV and project together
router.post("/", validateMultipleFiles, async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Validate that both files are provided
    if (!files || !files.cv || !files.project) {
      throw new AppError("Both CV and project files are required", 400);
    }

    if (files.cv.length === 0 || files.project.length === 0) {
      throw new AppError("Both CV and project files are required", 400);
    }

    // Save file information for both files
    const [cvFileInfo, projectFileInfo] = await Promise.all([
      fileService.saveFileInfo(files.cv[0], "cv"),
      fileService.saveFileInfo(files.project[0], "project"),
    ]);

    res.status(201).json({
      success: true,
      data: {
        cv: {
          id: cvFileInfo.id,
          originalName: cvFileInfo.originalName,
          size: cvFileInfo.size,
          type: cvFileInfo.type,
        },
        project: {
          id: projectFileInfo.id,
          originalName: projectFileInfo.originalName,
          size: projectFileInfo.size,
          type: projectFileInfo.type,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
});

export default router;
