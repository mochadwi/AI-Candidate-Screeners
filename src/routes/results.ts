import { Router, Request, Response, NextFunction } from "express";
import { JobService } from "../services/jobService";
import { AppError } from "../middleware/errorHandler";
import { JobStatusResponse, JobStatus } from "../models";

const router = Router();
const jobService = new JobService();

// Get job result by ID
router.get(
  "/:jobId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      console.log(`🔍 Results Route: Received request for job ID: ${jobId}`);
      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      // Validate job ID format (UUID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(jobId)) {
        throw new AppError("Invalid job ID format", 400);
      }

      const job = await jobService.getJob(jobId);

      if (!job) {
        throw new AppError("Job not found", 404);
      }

      // Transform job data to response format
      const response: JobStatusResponse = {
        jobId: job.id,
        status: job.status,
        title: job.title,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        result: job.result,
        error: job.error,
      };

      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
