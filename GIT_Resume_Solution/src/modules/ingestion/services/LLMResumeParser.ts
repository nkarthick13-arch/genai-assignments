import { AlgorithmResumeParser, ParsedResume } from './AlgorithmResumeParser';

export class LLMResumeParser {
  private readonly fallbackParser = new AlgorithmResumeParser();

  parseResume(rawText: string): ParsedResume {
    if (typeof rawText !== 'string' || !rawText.trim()) {
      throw new Error('rawText is required');
    }

    return this.fallbackParser.parseResume(rawText);
  }
}
