import { Router, Request, Response } from 'express';
import { MonitoringService } from '../services/monitoringService';
import { JobService } from '../services/jobService';

const router = Router();
const jobService = new JobService();
const monitoringService = new MonitoringService(jobService);

// Basic health check
router.get('/basic', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus();

    // Determine HTTP status code based on health
    let statusCode = 200;
    if (healthStatus.status === 'unhealthy') {
      statusCode = 503;
    } else if (healthStatus.status === 'degraded') {
      statusCode = 200; // Still serve traffic but indicate issues
    }

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Readiness probe (for Kubernetes/container orchestration)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus();

    // Check if all critical systems are ready
    const criticalChecks = ['ai', 'storage'];
    const allCriticalReady = criticalChecks.every(check =>
      healthStatus.checks[check as keyof typeof healthStatus.checks].status !== 'fail'
    );

    if (allCriticalReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: criticalChecks.map(check => ({
          name: check,
          status: healthStatus.checks[check as keyof typeof healthStatus.checks].status
        }))
      });
    }

  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Liveness probe (for Kubernetes/container orchestration)
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're live
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getMetrics();

    res.status(200).json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;