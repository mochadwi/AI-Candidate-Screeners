import { JobService } from './jobService';
import { config } from '../config/environment';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: HealthCheck;
    ai: HealthCheck;
    storage: HealthCheck;
    memory: HealthCheck;
  };
  metrics: {
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    systemLoad: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  responseTime?: number;
  details?: any;
}

export class MonitoringService {
  private jobService: JobService;
  private startTime: Date;

  constructor(jobService: JobService) {
    this.jobService = jobService;
    this.startTime = new Date();
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkAI(),
      this.checkStorage(),
      this.checkMemory()
    ]);

    const [aiResult, storageResult, memoryResult] = checks;

    const aiCheck = aiResult.status === 'fulfilled' ? aiResult.value : {
      status: 'fail' as const,
      message: aiResult.reason?.message || 'AI check failed'
    };

    const storageCheck = storageResult.status === 'fulfilled' ? storageResult.value : {
      status: 'fail' as const,
      message: storageResult.reason?.message || 'Storage check failed'
    };

    const memoryCheck = memoryResult.status === 'fulfilled' ? memoryResult.value : {
      status: 'fail' as const,
      message: memoryResult.reason?.message || 'Memory check failed'
    };

    // Overall health status
    const overallStatus = this.calculateOverallStatus([aiCheck, storageCheck, memoryCheck]);

    // Get job metrics
    const jobStats = await this.jobService.getJobStats();
    const systemMetrics = this.getSystemMetrics();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
      version: '1.0.0',
      checks: {
        database: { status: 'pass', message: 'In-memory storage active' }, // Always pass for in-memory
        ai: aiCheck,
        storage: storageCheck,
        memory: memoryCheck
      },
      metrics: {
        activeJobs: jobStats.pending + jobStats.processing,
        completedJobs: jobStats.completed,
        failedJobs: jobStats.failed,
        systemLoad: systemMetrics.load,
        memoryUsage: systemMetrics.memory
      }
    };
  }

  private calculateOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
    const failedChecks = checks.filter(check => check.status === 'fail').length;
    const warnChecks = checks.filter(check => check.status === 'warn').length;

    if (failedChecks > 0) {
      return 'unhealthy';
    }

    if (warnChecks > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async checkAI(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Check if OpenAI API key is configured
      if (!config.ai.openaiApiKey || config.ai.openaiApiKey === '') {
        return {
          status: 'fail',
          message: 'OpenAI API key not configured'
        };
      }

      // Simple check - just validate the key format
      const keyFormatValid = config.ai.openaiApiKey.startsWith('sk-') && config.ai.openaiApiKey.length > 20;

      if (!keyFormatValid) {
        return {
          status: 'warn',
          message: 'OpenAI API key format appears invalid'
        };
      }

      const responseTime = Date.now() - startTime;

      return {
        status: 'pass',
        responseTime,
        details: {
          provider: 'OpenAI',
          model: config.ai.model
        }
      };

    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown AI error',
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkStorage(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Check if upload directory exists and is accessible
      const fs = require('fs/promises');
      await fs.access(config.upload.uploadDir);

      // Check available space (basic check)
      const stats = await fs.stat(config.upload.uploadDir);

      const responseTime = Date.now() - startTime;

      return {
        status: 'pass',
        responseTime,
        details: {
          uploadDir: config.upload.uploadDir,
          accessible: true
        }
      };

    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Storage access failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const usedMemory = memUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message: string | undefined;

      if (memoryPercentage > 90) {
        status = 'fail';
        message = 'Memory usage critically high';
      } else if (memoryPercentage > 75) {
        status = 'warn';
        message = 'Memory usage high';
      }

      const responseTime = Date.now() - startTime;

      return {
        status,
        message,
        responseTime,
        details: {
          heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
          percentage: `${Math.round(memoryPercentage)}%`
        }
      };

    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Memory check failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  private getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const loadAvg = require('os').loadavg();

    return {
      load: loadAvg[0] || 0, // 1-minute load average
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / totalMemory) * 100)
      }
    };
  }

  async getMetrics(): Promise<any> {
    const jobStats = await this.jobService.getJobStats();
    const systemMetrics = this.getSystemMetrics();

    return {
      jobs: jobStats,
      system: systemMetrics,
      uptime: process.uptime(),
      startTime: this.startTime.toISOString(),
      timestamp: new Date().toISOString(),
      environment: config.app.env
    };
  }
}