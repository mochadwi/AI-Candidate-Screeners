import { v4 as uuidv4 } from 'uuid';
import { Job, JobStatus, CreateJobRequest, EvaluationResult } from '../models';

export class JobService {
  private jobs: Map<string, Job> = new Map();

  async createJob(request: CreateJobRequest): Promise<Job> {
    const job: Job = {
      id: uuidv4(),
      title: request.title,
      cvFileId: request.cvFileId,
      projectFileId: request.projectFileId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobs.set(job.id, job);
    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    return job;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: EvaluationResult,
    error?: string
  ): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    job.status = status;
    job.updatedAt = new Date();

    if (result) {
      job.result = result;
    }

    if (error) {
      job.error = error;
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    this.jobs.set(jobId, job);
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getJobsByStatus(status: JobStatus): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const deleted = this.jobs.delete(jobId);
    return deleted;
  }

  async cleanupOldJobs(maxAgeHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime) {
        this.jobs.delete(jobId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async getJobStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const jobs = Array.from(this.jobs.values());

    return {
      total: jobs.length,
      pending: jobs.filter(job => job.status === 'pending').length,
      processing: jobs.filter(job => job.status === 'processing').length,
      completed: jobs.filter(job => job.status === 'completed').length,
      failed: jobs.filter(job => job.status === 'failed').length
    };
  }
}