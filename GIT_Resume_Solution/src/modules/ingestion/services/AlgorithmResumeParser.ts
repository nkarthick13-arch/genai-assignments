import { detectSkills } from '../../../config/skills';
import { extractEmail, extractPhone, extractExperienceYears } from '../utils/regex';

export interface ParsedResume {
  name?: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  company?: string | null;
  role?: string | null;
  education?: string | null;
  totalExperience?: number | null;
  relevantExperience?: number | null;
  skills: string[];
  jobTitles?: string[];
  experienceSummary?: string;
}

export class AlgorithmResumeParser {
  parseResume(rawText: string): ParsedResume {
    const text = rawText ?? '';
    const nameMatch = text.match(/^[A-Z][A-Za-z .'-]+/m);
    const name = nameMatch ? nameMatch[0].trim() : undefined;
    const roleMatch = text.match(/(?:Test Architect|Senior|Engineer|Developer|Manager|Analyst|Lead|Consultant)/i);
    const role = roleMatch ? roleMatch[0].trim() : undefined;
    const companyMatch = text.match(/(?:Testleaf|Infosys|TCS|Wipro|Cognizant|Accenture|Capgemini|Microsoft|Google|Amazon|IBM|HCL|Thoughtworks)[A-Za-z0-9 .&'-]*/i);
    const company = companyMatch ? companyMatch[0].trim() : undefined;
    const educationMatch = text.match(/(?:B\.Tech|B\.E|M\.Tech|MCA|MBA|Bachelor|Master|Diploma)[^\n]*/i);
    const education = educationMatch ? educationMatch[0].trim() : undefined;
    const email = extractEmail(text);
    const phone = extractPhone(text);
    const totalExperience = extractExperienceYears(text) ?? null;
    const skills = detectSkills(text);

    return {
      name,
      email,
      phone,
      company,
      role,
      education,
      totalExperience,
      relevantExperience: totalExperience,
      skills,
      jobTitles: role ? [role] : [],
      experienceSummary: text.slice(0, 250).replace(/\s+/g, ' ').trim(),
    };
  }
}
