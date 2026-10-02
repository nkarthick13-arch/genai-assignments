import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, getDatabase } from '../../../config/database';
import { EmbeddingService } from '../../ingestion/services/EmbeddingService';

export interface ResumeSearchFilters {
  skills?: string[];
  minExperience?: number;
  company?: string;
}

export interface ResumeSearchResult {
  id: string;
  name?: string;
  role?: string | null;
  company?: string | null;
  skills?: string[];
  totalExperience?: number | null;
  score: number;
  snippet?: string;
  matchedSkills?: string[];
  matchedKeywords?: string[];
}

export class ResumeRetrievalService {
  private readonly embeddingService = new EmbeddingService();

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private normalizeSnippet(rawText?: string): string {
    if (!rawText) return '';
    return rawText.replace(/\s+/g, ' ').trim().slice(0, 220);
  }

  async search(query: string, limit = 5, filters: ResumeSearchFilters = {}): Promise<ResumeSearchResult[]> {
    await connectToDatabase();
    const db: Db = getDatabase();
    const resumes = await db.collection('resumes').find({ embedding: { $exists: true, $ne: [] } }).toArray();

    if (!resumes.length) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const queryTokens = queryLower
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    const normalizedSkillFilters = (filters.skills ?? []).map((skill) => skill.toLowerCase());
    const minExperience = Number(filters.minExperience ?? 0);
    const companyFilter = (filters.company ?? '').trim().toLowerCase();

    const queryEmbedding = this.embeddingService.generateEmbedding({ rawText: query });

    const scored = resumes
      .map((resume): ResumeSearchResult | null => {
        const storedEmbedding = Array.isArray(resume.embedding) ? resume.embedding : [];
        const resumeSkills = Array.isArray(resume.skills) ? resume.skills : [];
        const resumeText = `${resume.name ?? ''} ${resume.role ?? ''} ${resume.company ?? ''} ${resumeSkills.join(' ')} ${resume.rawText ?? ''}`.toLowerCase();
        const matchedSkills = resumeSkills.filter((skill) => {
          const skillLower = skill.toLowerCase();
          return queryLower.includes(skillLower) || normalizedSkillFilters.some((filter) => skillLower.includes(filter));
        });
        const matchedKeywords = queryTokens.filter((token) => resumeText.includes(token));

        if (normalizedSkillFilters.length > 0) {
          const hasRequiredSkill = resumeSkills.some((skill) => normalizedSkillFilters.some((filter) => skill.toLowerCase().includes(filter)));
          if (!hasRequiredSkill) return null;
        }

        if (companyFilter && !(resume.company ?? '').toString().toLowerCase().includes(companyFilter)) {
          return null;
        }

        if (minExperience > 0 && Number(resume.totalExperience ?? 0) < minExperience) {
          return null;
        }

        const vectorScore = this.cosineSimilarity(queryEmbedding, storedEmbedding);
        const skillBoost = matchedSkills.length > 0 ? 0.2 + matchedSkills.length * 0.12 : 0;
        const keywordBoost = matchedKeywords.length > 0 ? Math.min(matchedKeywords.length * 0.08, 0.24) : 0;
        const experienceBoost = Number(resume.totalExperience ?? 0) >= minExperience && minExperience > 0 ? 0.1 : 0;
        const score = Math.min(1, Math.max(0, vectorScore + skillBoost + keywordBoost + experienceBoost));

        return {
          id: resume._id?.toString() ?? '',
          name: resume.name,
          role: resume.role,
          company: resume.company,
          skills: resumeSkills,
          totalExperience: resume.totalExperience ?? null,
          score,
          snippet: this.normalizeSnippet(String(resume.rawText ?? '')),
          matchedSkills,
          matchedKeywords,
        };
      })
      .filter((item): item is ResumeSearchResult => item !== null && !!item.id)
      .sort((a: ResumeSearchResult, b: ResumeSearchResult) => b.score - a.score)
      .slice(0, Math.max(1, Number(limit) || 5));

    return scored;
  }

  async getResumeById(id: string): Promise<Record<string, unknown> | null> {
    if (!id || !ObjectId.isValid(id)) {
      return null;
    }

    await connectToDatabase();
    const db: Db = getDatabase();
    const resume = await db.collection('resumes').findOne({ _id: new ObjectId(id) });

    if (!resume) {
      return null;
    }

    const { _id, ...rest } = resume as Record<string, unknown> & { _id: ObjectId };
    return {
      id: _id.toString(),
      ...rest,
    };
  }

  async getTopMatch(query: string, filters: ResumeSearchFilters = {}): Promise<ResumeSearchResult | null> {
    const results = await this.search(query, 1, filters);
    return results[0] ?? null;
  }

  async listResumes(limit = 10, skip = 0, filters: ResumeSearchFilters = {}): Promise<ResumeSearchResult[]> {
    await connectToDatabase();
    const db: Db = getDatabase();

    const normalizedSkillFilters = (filters.skills ?? []).map((skill) => skill.toLowerCase());
    const companyFilter = (filters.company ?? '').trim().toLowerCase();
    const minExperience = Number(filters.minExperience ?? 0);

    const query: Record<string, unknown> = { embedding: { $exists: true, $ne: [] } };

    if (companyFilter) {
      query.company = { $regex: companyFilter, $options: 'i' };
    }

    if (minExperience > 0) {
      query.totalExperience = { $gte: minExperience };
    }

    const resumes = await db.collection('resumes')
      .find(query)
      .skip(Math.max(0, Number(skip) || 0))
      .limit(Math.max(1, Math.min(100, Number(limit) || 10)))
      .toArray();

    const results: ResumeSearchResult[] = [];

    for (const resume of resumes) {
      const skillList = Array.isArray(resume.skills) ? resume.skills : [];

      if (normalizedSkillFilters.length > 0) {
        const hasRequiredSkill = skillList.some((skill) => normalizedSkillFilters.some((filter) => skill.toLowerCase().includes(filter)));
        if (!hasRequiredSkill) continue;
      }

      results.push({
        id: resume._id?.toString() ?? '',
        name: resume.name,
        role: resume.role,
        company: resume.company,
        skills: skillList,
        totalExperience: resume.totalExperience ?? null,
        score: 0,
        snippet: this.normalizeSnippet(String(resume.rawText ?? '')),
      });
    }

    return results;
  }
}
