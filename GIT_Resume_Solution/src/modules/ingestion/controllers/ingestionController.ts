import fs from 'fs';
import { Request, Response } from 'express';
import { ResumeParserService } from '../services/ResumeParserService';
import { AlgorithmResumeParser } from '../services/AlgorithmResumeParser';
import { LLMResumeParser } from '../services/LLMResumeParser';
import { EmbeddingService } from '../services/EmbeddingService';
import { ResumeIngestionRepository } from '../repositories/ResumeIngestionRepository';
import { cleanResumeText } from '../utils/textCleaner';
import { detectSkills } from '../../../config/skills';
import env from '../../../config/env';

const resumeParserService = new ResumeParserService();
const algorithmResumeParser = new AlgorithmResumeParser();
const llmResumeParser = new LLMResumeParser();
const embeddingService = new EmbeddingService();
const resumeRepository = new ResumeIngestionRepository();

export const ingestionController = {
  healthCheck: (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      module: 'resume-ingestion',
    });
  },

  uploadResume: (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_FILE_TYPE',
        message: 'Only PDF files are allowed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully',
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  },

  ingestResume: async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_FILE_TYPE',
        message: 'A PDF resume file is required',
      });
    }

    try {
      let cleanedText: string;
      let resume: ReturnType<AlgorithmResumeParser['parseResume']>;
      let parserName: 'algorithm' | 'llm';
      let embedding: number[];

      try {
        const rawText = await resumeParserService.extractTextFromPdf(req.file.path);
        cleanedText = cleanResumeText(rawText);

        if (!cleanedText) {
          throw new Error('The uploaded PDF contains no usable resume text.');
        }

        parserName = env.useLlmParser ? 'llm' : 'algorithm';
        resume = env.useLlmParser
          ? llmResumeParser.parseResume(cleanedText)
          : algorithmResumeParser.parseResume(cleanedText);

        embedding = embeddingService.generateEmbedding({
          name: resume.name,
          role: resume.role ?? undefined,
          skills: resume.skills,
          company: resume.company ?? undefined,
          rawText: cleanedText,
        });
      } catch (error) {
        return res.status(422).json({
          success: false,
          errorCode: 'RESUME_INGESTION_FAILED',
          message: error instanceof Error ? error.message : 'Resume ingestion failed',
        });
      }

      let resumeId: string;
      try {
        resumeId = await resumeRepository.insertResume({
          fileName: req.file.originalname,
          rawText: cleanedText,
          ...resume,
          embedding,
          embeddingModel: 'mistral-embed',
          embeddingDimension: embedding.length,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          errorCode: 'DATABASE_WRITE_FAILED',
          message: error instanceof Error ? error.message : 'Resume could not be saved',
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Resume ingested successfully',
        resumeId,
        parser: parserName,
        resume,
      });
    } finally {
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // The upload may already have been removed by another cleanup path.
      }
    }
  },

  extractResume: async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        errorCode: 'RESUME_EXTRACTION_FAILED',
        message: 'Resume extraction failed',
      });
    }

    try {
      const rawText = await resumeParserService.extractTextFromPdf(req.file.path);
      const cleanedText = rawText.trim();

      if (!cleanedText) {
        throw new Error('The uploaded PDF contains no selectable text. Please upload a text-based PDF or enable OCR support.');
      }

      fs.unlinkSync(req.file.path);

      return res.status(200).json({
        success: true,
        rawText: cleanedText,
        characters: cleanedText.length,
      });
    } catch (error) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // ignore cleanup failures
        }
      }

      const message = error instanceof Error ? error.message : 'Resume extraction failed';
      const isScannedOrEmptyText = message.toLowerCase().includes('no selectable text') || message.toLowerCase().includes('image-based') || message.toLowerCase().includes('too little extractable text');

      return res.status(422).json({
        success: false,
        errorCode: isScannedOrEmptyText ? 'PDF_TEXT_EMPTY' : 'RESUME_EXTRACTION_FAILED',
        message,
        details: 'The uploaded PDF appears to be scanned, image-based, or does not contain machine-readable resume text. Upload a text-based PDF to continue ingestion.',
      });
    }
  },

  cleanResumeText: (req: Request, res: Response) => {
    const { rawText } = req.body ?? {};

    if (typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_RAW_TEXT',
        message: 'rawText is required',
      });
    }

    const cleanText = cleanResumeText(rawText);

    return res.status(200).json({
      success: true,
      cleanText,
    });
  },

  detectSkills: (req: Request, res: Response) => {
    const { rawText } = req.body ?? {};

    if (typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_RAW_TEXT',
        message: 'rawText is required',
      });
    }

    return res.status(200).json({
      success: true,
      skills: detectSkills(rawText),
    });
  },

  parseResume: (req: Request, res: Response) => {
    const { rawText } = req.body ?? {};

    if (typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_RAW_TEXT',
        message: 'rawText is required',
      });
    }

    const parser = env.useLlmParser ? llmResumeParser : algorithmResumeParser;

    if (env.useLlmParser === false) {
      const resume = algorithmResumeParser.parseResume(rawText);
      return res.status(200).json({
        success: true,
        resume,
        parser: 'algorithm',
      });
    }

    try {
      const resume = parser.parseResume(rawText);
      return res.status(200).json({
        success: true,
        resume,
        parser: 'llm',
      });
    } catch (error) {
      return res.status(422).json({
        success: false,
        errorCode: 'RESUME_PARSE_FAILED',
        message: error instanceof Error ? error.message : 'Resume parsing failed',
      });
    }
  },

  generateEmbedding: (req: Request, res: Response) => {
    const { name, role, skills, company, rawText } = req.body ?? {};

    if (!name && !role && !rawText) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_EMBEDDING_INPUT',
        message: 'At least one resume field is required',
      });
    }

    const embedding = embeddingService.generateEmbedding({ name, role, skills, company, rawText });

    return res.status(200).json({
      success: true,
      model: 'mistral-embed',
      dimension: embedding.length,
      embedding,
    });
  },

  storeResume: async (req: Request, res: Response) => {
    const { fileName, resume, rawText, embedding } = req.body ?? {};

    if (!resume || typeof rawText !== 'string') {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STORE_INPUT',
        message: 'resume and rawText are required',
      });
    }

    try {
      const resumeId = await resumeRepository.insertResume({
        fileName,
        rawText,
        name: resume.name,
        email: resume.email ?? null,
        phone: resume.phone ?? null,
        location: resume.location ?? null,
        company: resume.company ?? null,
        role: resume.role ?? null,
        education: resume.education ?? null,
        totalExperience: resume.totalExperience ?? null,
        relevantExperience: resume.relevantExperience ?? null,
        skills: Array.isArray(resume.skills) ? resume.skills : [],
        jobTitles: Array.isArray(resume.jobTitles) ? resume.jobTitles : [],
        experienceSummary: resume.experienceSummary,
        embedding: Array.isArray(embedding) ? embedding : [],
        embeddingModel: 'mistral-embed',
        embeddingDimension: Array.isArray(embedding) ? embedding.length : 1024,
      });

      return res.status(200).json({
        success: true,
        message: 'Resume stored successfully',
        resumeId,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        errorCode: 'INGESTION_FAILED',
        message: error instanceof Error ? error.message : 'Resume ingestion failed',
      });
    }
  },
};
