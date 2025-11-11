import { Router, Request, Response } from "express";
import { MonitoringService } from "../services/monitoringService";
import { JobService } from "../services/jobService";

const router = Router();
const jobService = new JobService();
const monitoringService = new MonitoringService(jobService);

// Basic health check
router.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
