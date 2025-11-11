import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { Job, JobStatus, CreateJobRequest, EvaluationResult } from "../models";

export class JobService {
  private jobsFile = path.join(process.cwd(), "data", "jobs.json");
  private jobs: Map<string, Job> = new Map();

  private async ensureDataDir(): Promise<void> {
    const dataDir = path.dirname(this.jobsFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async loadJobs(): Promise<Map<string, Job>> {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(this.jobsFile, "utf-8");
      const jobsArray = JSON.parse(data);
      this.jobs = new Map(Object.entries(jobsArray));
      return this.jobs;
    } catch {
      this.jobs = new Map();
      return this.jobs;
    }
  }

  private async saveJobs(): Promise<void> {
    await this.ensureDataDir();
    const jobsObject = Object.fromEntries(this.jobs);
    await fs.writeFile(this.jobsFile, JSON.stringify(jobsObject, null, 2));
  }

  async createJob(request: CreateJobRequest): Promise<Job> {
    await this.loadJobs();

    const job: Job = {
      id: uuidv4(),
      title: request.title,
      cvFileId: request.cvFileId,
      projectFileId: request.projectFileId,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(job.id, job);
    await this.saveJobs();

    console.log(`📝 Created job ${job.id} with title "${job.title}"`);
    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    await this.loadJobs();
    return this.jobs.get(jobId) || null;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: EvaluationResult,
    error?: string,
  ): Promise<Job | null> {
    await this.loadJobs();
    const job = this.jobs.get(jobId);

    if (!job) {
      console.log(`❌ Cannot update job ${jobId} - not found`);
      return null;
    }

    console.log(`🔄 Updating job ${jobId} status to ${status}`);
    job.status = status;
    job.updatedAt = new Date();

    if (result) {
      job.result = result;
    }

    if (error) {
      job.error = error;
    }

    if (status === "completed" || status === "failed") {
      job.completedAt = new Date();
    }

    this.jobs.set(jobId, job);
    await this.saveJobs();

    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    await this.loadJobs();
    return Array.from(this.jobs.values());
  }

  async getJobsByStatus(status: JobStatus): Promise<Job[]> {
    await this.loadJobs();
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === status,
    );
  }

  async deleteJob(jobId: string): Promise<boolean> {
    await this.loadJobs();
    const deleted = this.jobs.delete(jobId);
    if (deleted) {
      await this.saveJobs();
    }
    return deleted;
  }

  async cleanupOldJobs(maxAgeHours: number = 24): Promise<number> {
    await this.loadJobs();
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime) {
        this.jobs.delete(jobId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await this.saveJobs();
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
    await this.loadJobs();
    const jobs = Array.from(this.jobs.values());

    return {
      total: jobs.length,
      pending: jobs.filter((job) => job.status === "pending").length,
      processing: jobs.filter((job) => job.status === "processing").length,
      completed: jobs.filter((job) => job.status === "completed").length,
      failed: jobs.filter((job) => job.status === "failed").length,
    };
  }
}
