import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { FileService } from '../services/fileService';
import { AppError } from '../middleware/errorHandler';
import { UploadResponse, FileType } from '../models';

const router = Router();
const fileService = new FileService();

// Middleware to handle file validation
const validateFileUpload = (type: FileType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const uploadMiddleware = fileService.getUploadMiddleware(type);

    uploadMiddleware(req, res, (error: any) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('File size too large. Maximum size is 10MB', 400));
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError('Unexpected field name. Use "file" as field name', 400));
        }
        return next(new AppError(`File upload error: ${error.message}`, 400));
      }

      if (error) {
        return next(new AppError(error.message, 400));
      }

      next();
    });
  };
};

// Upload CV endpoint
router.post('/cv', validateFileUpload('cv'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileInfo = await fileService.saveFileInfo(req.file, 'cv');

    res.json({
      success: true,
      data: {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        type: fileInfo.type
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

// Upload project endpoint
router.post('/project', validateFileUpload('project'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileInfo = await fileService.saveFileInfo(req.file, 'project');

    res.json({
      success: true,
      data: {
        id: fileInfo.id,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        type: fileInfo.type
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

// Upload both CV and project together
router.post('/both', async (req: Request, res: Response) => {
  try {
    // For simplicity, we'll handle this as two separate uploads
    // In a real application, you might want to use multer.array() or multer.fields()
    res.status(501).json({
      success: false,
      error: {
        message: 'Please upload CV and project files separately using /upload/cv and /upload/project endpoints'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

export default router;