import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/AppError';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const skillSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum(['WAREHOUSE', 'HEALTHCARE', 'CLEANING', 'SECURITY', 'HOSPITALITY', 'LABOUR', 'CERTIFICATION']),
  icon: z.string().optional(),
});

export class SkillController {
  list = async (_req: Request, res: Response) => {
    const skills = await prisma.skill.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Group by category
    const grouped = skills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, typeof skills>);

    res.json({ success: true, data: { skills, grouped } });
  };

  getCategories = async (_req: Request, res: Response) => {
    const categories = [
      { id: 'WAREHOUSE', name: 'Warehouse & Logistics', icon: '🏬' },
      { id: 'HEALTHCARE', name: 'Healthcare & Care', icon: '🏥' },
      { id: 'CLEANING', name: 'Cleaning', icon: '🧹' },
      { id: 'SECURITY', name: 'Security', icon: '🛡️' },
      { id: 'HOSPITALITY', name: 'Hospitality', icon: '🍽️' },
      { id: 'LABOUR', name: 'General Labour', icon: '🔧' },
      { id: 'CERTIFICATION', name: 'Certifications', icon: '📜' },
    ];

    res.json({ success: true, data: categories });
  };

  getByCategory = async (req: Request, res: Response) => {
    const { category } = req.params;

    const skills = await prisma.skill.findMany({
      where: {
        category: category.toUpperCase() as any,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: skills });
  };

  create = async (req: AuthRequest, res: Response) => {
    const data = skillSchema.parse(req.body);

    const skill = await prisma.skill.create({ data });

    res.status(201).json({ success: true, data: skill });
  };

  update = async (req: AuthRequest, res: Response) => {
    const data = skillSchema.partial().parse(req.body);

    const skill = await prisma.skill.update({
      where: { id: req.params.skillId },
      data,
    });

    res.json({ success: true, data: skill });
  };

  delete = async (req: AuthRequest, res: Response) => {
    // Soft delete
    const skill = await prisma.skill.update({
      where: { id: req.params.skillId },
      data: { isActive: false },
    });

    if (!skill) throw new NotFoundError('Skill');

    res.json({ success: true, message: 'Skill deleted' });
  };
}
