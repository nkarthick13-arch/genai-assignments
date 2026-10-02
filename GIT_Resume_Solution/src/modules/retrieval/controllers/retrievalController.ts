import { Request, Response } from 'express';
import { ResumeRetrievalService } from '../services/ResumeRetrievalService';

const resumeRetrievalService = new ResumeRetrievalService();

export const retrievalController = {
  healthCheck: (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      module: 'resume-retrieval',
    });
  },

  searchResumes: async (req: Request, res: Response) => {
    const { query, limit, skills, minExperience, company } = req.body ?? {};

    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_QUERY',
        message: 'query is required',
      });
    }

    try {
      const normalizedSkills = Array.isArray(skills)
        ? skills.filter((skill): skill is string => typeof skill === 'string')
        : typeof skills === 'string'
          ? [skills]
          : [];

      const results = await resumeRetrievalService.search(query, Number(limit ?? 5), {
        skills: normalizedSkills,
        minExperience: typeof minExperience === 'number' ? minExperience : Number(minExperience ?? 0),
        company: typeof company === 'string' ? company : undefined,
      });

      return res.status(200).json({
        success: true,
        query,
        count: results.length,
        results,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        errorCode: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Resume retrieval failed',
      });
    }
  },

  getResumeById: async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_RESUME_ID',
        message: 'resume id is required',
      });
    }

    try {
      const resume = await resumeRetrievalService.getResumeById(id);

      if (!resume) {
        return res.status(404).json({
          success: false,
          errorCode: 'RESUME_NOT_FOUND',
          message: 'Resume not found',
        });
      }

      return res.status(200).json({
        success: true,
        resume,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        errorCode: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Resume retrieval failed',
      });
    }
  },

  getTopMatch: async (req: Request, res: Response) => {
    const { query, skills, minExperience, company } = req.body ?? {};

    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_QUERY',
        message: 'query is required',
      });
    }

    try {
      const normalizedSkills = Array.isArray(skills)
        ? skills.filter((skill): skill is string => typeof skill === 'string')
        : typeof skills === 'string'
          ? [skills]
          : [];

      const result = await resumeRetrievalService.getTopMatch(query, {
        skills: normalizedSkills,
        minExperience: typeof minExperience === 'number' ? minExperience : Number(minExperience ?? 0),
        company: typeof company === 'string' ? company : undefined,
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          errorCode: 'NO_MATCH_FOUND',
          message: 'No matching resume found',
        });
      }

      return res.status(200).json({
        success: true,
        query,
        result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        errorCode: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Resume retrieval failed',
      });
    }
  },

  listResumes: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 10);
    const skip = Number(req.query.skip ?? 0);
    const skillsParam = req.query.skills;
    const company = typeof req.query.company === 'string' ? req.query.company : undefined;
    const minExperience = Number(req.query.minExperience ?? 0);

    const skills = Array.isArray(skillsParam)
      ? skillsParam.filter((item): item is string => typeof item === 'string')
      : typeof skillsParam === 'string'
        ? [skillsParam]
        : [];

    try {
      const resumes = await resumeRetrievalService.listResumes(limit, skip, {
        skills,
        minExperience: Number.isFinite(minExperience) ? minExperience : 0,
        company,
      });

      return res.status(200).json({
        success: true,
        count: resumes.length,
        limit: Math.max(1, Math.min(100, Number(limit) || 10)),
        skip: Math.max(0, Number(skip) || 0),
        results: resumes,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        errorCode: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Resume listing failed',
      });
    }
  },
};
