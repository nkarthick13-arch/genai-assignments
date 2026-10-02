export interface ResumeEmbeddingInput {
  name?: string;
  role?: string;
  skills?: string[];
  company?: string;
  rawText?: string;
}

export class EmbeddingService {
  getDimension(): number {
    return Number(process.env.EMBEDDING_DIMENSION || 1024);
  }

  generateEmbedding(input: ResumeEmbeddingInput): number[] {
    const text = [
      input.name ?? '',
      input.role ?? '',
      Array.isArray(input.skills) ? input.skills.join(' ') : '',
      input.company ?? '',
      input.rawText ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

    const dimension = this.getDimension();
    const baseSeed = text.split('').reduce((total, ch) => total + ch.charCodeAt(0), 0) || 1;

    return Array.from({ length: dimension }, (_, index) => {
      const weightedIndex = (index + 1) * (baseSeed + 1);
      const charSignal = text.charCodeAt((index + baseSeed) % Math.max(text.length, 1)) || 97;
      const sineComponent = Math.sin(weightedIndex / 13.5 + charSignal / 255);
      const cosineComponent = Math.cos((index + 1) * 0.13 + baseSeed / 31);
      const value = ((charSignal / 255) + sineComponent + cosineComponent) / 3;
      return Number(value.toFixed(6));
    });
  }
}
