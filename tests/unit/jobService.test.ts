import { JobService } from '../../src/services/jobService';
import { CreateJobRequest, JobStatus } from '../../src/models';

describe('JobService', () => {
  let jobService: JobService;

  beforeEach(() => {
    jobService = new JobService();
  });

  describe('createJob', () => {
    it('should create a new job with valid data', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const job = await jobService.createJob(request);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.title).toBe(request.title);
      expect(job.cvFileId).toBe(request.cvFileId);
      expect(job.projectFileId).toBe(request.projectFileId);
      expect(job.status).toBe('pending');
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique job IDs', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const job1 = await jobService.createJob(request);
      const job2 = await jobService.createJob(request);

      expect(job1.id).not.toBe(job2.id);
    });
  });

  describe('getJob', () => {
    it('should return job when it exists', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const createdJob = await jobService.createJob(request);
      const retrievedJob = await jobService.getJob(createdJob.id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(createdJob.id);
      expect(retrievedJob?.title).toBe(createdJob.title);
    });

    it('should return null when job does not exist', async () => {
      const job = await jobService.getJob('non-existent-id');
      expect(job).toBeNull();
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status and add result', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const job = await jobService.createJob(request);
      const result = {
        cvMatchRate: 0.8,
        projectScore: 4,
        cvFeedback: 'Good',
        projectFeedback: 'Nice',
        summary: 'Overall good'
      };

      const updatedJob = await jobService.updateJobStatus(job.id, 'completed', result);

      expect(updatedJob).toBeDefined();
      expect(updatedJob?.status).toBe('completed');
      expect(updatedJob?.result).toEqual(result);
      expect(updatedJob?.completedAt).toBeInstanceOf(Date);
    });

    it('should return null when updating non-existent job', async () => {
      const result = await jobService.updateJobStatus('non-existent-id', 'completed');
      expect(result).toBeNull();
    });
  });

  describe('getAllJobs', () => {
    it('should return empty array when no jobs exist', async () => {
      const jobs = await jobService.getAllJobs();
      expect(jobs).toEqual([]);
    });

    it('should return all created jobs', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      await jobService.createJob(request);
      await jobService.createJob({ ...request, title: 'Junior Developer' });

      const jobs = await jobService.getAllJobs();
      expect(jobs).toHaveLength(2);
    });
  });

  describe('getJobsByStatus', () => {
    it('should return jobs with specified status', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const job1 = await jobService.createJob(request);
      const job2 = await jobService.createJob({ ...request, title: 'Junior Developer' });

      await jobService.updateJobStatus(job1.id, 'completed');

      const pendingJobs = await jobService.getJobsByStatus('pending');
      const completedJobs = await jobService.getJobsByStatus('completed');

      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].id).toBe(job2.id);

      expect(completedJobs).toHaveLength(1);
      expect(completedJobs[0].id).toBe(job1.id);
    });
  });

  describe('deleteJob', () => {
    it('should delete existing job', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const job = await jobService.createJob(request);
      const deleted = await jobService.deleteJob(job.id);

      expect(deleted).toBe(true);

      const retrievedJob = await jobService.getJob(job.id);
      expect(retrievedJob).toBeNull();
    });

    it('should return false when deleting non-existent job', async () => {
      const deleted = await jobService.deleteJob('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('getJobStats', () => {
    it('should return correct statistics', async () => {
      const request: CreateJobRequest = {
        title: 'Senior Developer',
        cvFileId: 'cv-123',
        projectFileId: 'project-456'
      };

      const job1 = await jobService.createJob(request);
      const job2 = await jobService.createJob({ ...request, title: 'Junior Developer' });
      const job3 = await jobService.createJob({ ...request, title: 'Intern' });

      await jobService.updateJobStatus(job1.id, 'completed');
      await jobService.updateJobStatus(job2.id, 'failed');

      const stats = await jobService.getJobStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });
});