import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Temporary endpoint to debug and fix worker skill relationships
 * This should be removed in production
 */
export class SkillDebugController {
  // Get detailed worker info with skills
  getWorkerSkillsDebug = async (req: AuthRequest, res: Response) => {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    try {
      // Find the worker
      const worker = await prisma.user.findFirst({
        where: {
          email: email as string,
          role: 'WORKER',
          organizationId: req.user!.organizationId,
        },
        include: {
          workerSkills: {
            include: { skill: true }
          },
          workerProfile: true,
        },
      });

      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Get all available skills
      const allSkills = await prisma.skill.findMany();

      // Get all worker skill relationships for this organization
      const allWorkerSkills = await prisma.workerSkill.findMany({
        where: {
          worker: {
            organizationId: req.user!.organizationId,
          },
        },
        include: {
          worker: {
            select: { id: true, fullName: true, email: true }
          },
          skill: true,
        },
      });

      res.json({
        success: true,
        data: {
          worker: {
            id: worker.id,
            fullName: worker.fullName,
            email: worker.email,
            workerSkillsCount: worker.workerSkills.length,
            workerSkills: worker.workerSkills,
          },
          allSkills: allSkills.map(skill => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
          })),
          allWorkerSkills: allWorkerSkills.slice(0, 10), // Limit for readability
          totalWorkerSkills: allWorkerSkills.length,
        },
      });
    } catch (error) {
      console.error('Skill debug error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Add skills to a worker
  addSkillsToWorker = async (req: AuthRequest, res: Response) => {
    const { email, skillIds } = req.body;

    if (!email || !skillIds || !Array.isArray(skillIds)) {
      return res.status(400).json({ 
        error: 'Email and skillIds array are required' 
      });
    }

    try {
      // Find the worker
      const worker = await prisma.user.findFirst({
        where: {
          email,
          role: 'WORKER',
          organizationId: req.user!.organizationId,
        },
      });

      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Create worker skill relationships
      const workerSkills = await prisma.workerSkill.createMany({
        data: skillIds.map((skillId: string) => ({
          workerId: worker.id,
          skillId,
        })),
        skipDuplicates: true,
      });

      // Return updated worker with skills
      const updatedWorker = await prisma.user.findFirst({
        where: { id: worker.id },
        include: {
          workerSkills: {
            include: { skill: true }
          },
        },
      });

      res.json({
        success: true,
        data: {
          message: `Added ${workerSkills.count} skills to ${worker.fullName}`,
          worker: {
            id: updatedWorker!.id,
            fullName: updatedWorker!.fullName,
            email: updatedWorker!.email,
            workerSkills: updatedWorker!.workerSkills,
          },
        },
      });
    } catch (error) {
      console.error('Add skills error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Remove skills from a worker
  removeSkillsFromWorker = async (req: AuthRequest, res: Response) => {
    const { email, skillIds } = req.body;

    if (!email || !skillIds || !Array.isArray(skillIds)) {
      return res.status(400).json({ 
        error: 'Email and skillIds array are required' 
      });
    }

    try {
      // Find the worker
      const worker = await prisma.user.findFirst({
        where: {
          email,
          role: 'WORKER',
          organizationId: req.user!.organizationId,
        },
      });

      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Delete worker skill relationships
      const deletedSkills = await prisma.workerSkill.deleteMany({
        where: {
          workerId: worker.id,
          skillId: { in: skillIds },
        },
      });

      // Return updated worker with skills
      const updatedWorker = await prisma.user.findFirst({
        where: { id: worker.id },
        include: {
          workerSkills: {
            include: { skill: true }
          },
        },
      });

      res.json({
        success: true,
        data: {
          message: `Removed ${deletedSkills.count} skills from ${worker.fullName}`,
          worker: {
            id: updatedWorker!.id,
            fullName: updatedWorker!.fullName,
            email: updatedWorker!.email,
            workerSkills: updatedWorker!.workerSkills,
          },
        },
      });
    } catch (error) {
      console.error('Remove skills error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
