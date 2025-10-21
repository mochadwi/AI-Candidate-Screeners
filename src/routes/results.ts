import { Router, Request, Response, NextFunction } from 'express';
import { JobService } from '../services/jobService';
import { AppError } from '../middleware/errorHandler';
import { JobStatusResponse, JobStatus } from '../models';

const router = Router();
const jobService = new JobService();

// Get job result by ID
router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    // Validate job ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      throw new AppError('Invalid job ID format', 400);
    }

    const job = await jobService.getJob(jobId);

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    // Transform job data to response format
    const response: JobStatusResponse = {
      jobId: job.id,
      status: job.status,
      title: job.title,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result,
      error: job.error
    };

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Get multiple results by job IDs
router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobIds } = req.body;

    if (!jobIds || !Array.isArray(jobIds)) {
      throw new AppError('Job IDs array is required', 400);
    }

    if (jobIds.length === 0) {
      throw new AppError('At least one job ID is required', 400);
    }

    if (jobIds.length > 50) {
      throw new AppError('Maximum 50 job IDs allowed per request', 400);
    }

    // Validate each job ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const jobId of jobIds) {
      if (!uuidRegex.test(jobId)) {
        throw new AppError(`Invalid job ID format: ${jobId}`, 400);
      }
    }

    // Get jobs in parallel
    const jobPromises = jobIds.map(jobId => jobService.getJob(jobId));
    const jobs = await Promise.all(jobPromises);

    // Filter out null results (not found jobs) and transform to response format
    const results = jobs
      .filter(job => job !== null)
      .map(job => ({
        jobId: job!.id,
        status: job!.status,
        title: job!.title,
        createdAt: job!.createdAt,
        updatedAt: job!.updatedAt,
        result: job!.result,
        error: job!.error
      }));

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        requested: jobIds.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Get results by status
router.get('/status/:status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.params;

    if (!status) {
      throw new AppError('Status is required', 400);
    }

    // Validate status
    const validStatuses: JobStatus[] = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status as JobStatus)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const jobs = await jobService.getJobsByStatus(status as JobStatus);

    const results = jobs.map(job => ({
      jobId: job.id,
      status: job.status,
      title: job.title,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result,
      error: job.error,
      completedAt: job.completedAt
    }));

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Get recent completed results
router.get('/recent/completed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    if (limit <= 0 || limit > 100) {
      throw new AppError('Limit must be between 1 and 100', 400);
    }

    const jobs = await jobService.getJobsByStatus('completed');

    // Sort by completion time (newest first) and limit
    const completedJobs = jobs
      .filter(job => job.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(0, limit);

    const results = completedJobs.map(job => ({
      jobId: job.id,
      status: job.status,
      title: job.title,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      result: job.result
    }));

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

// Search results by title
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      throw new AppError('Search query is required', 400);
    }

    if (query.trim().length === 0) {
      throw new AppError('Search query cannot be empty', 400);
    }

    const allJobs = await jobService.getAllJobs();

    // Search in job titles (case-insensitive)
    const matchingJobs = allJobs.filter(job =>
      job.title.toLowerCase().includes(query.toLowerCase())
    );

    const results = matchingJobs.map(job => ({
      jobId: job.id,
      status: job.status,
      title: job.title,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result,
      error: job.error,
      completedAt: job.completedAt
    }));

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        query
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

export default router;