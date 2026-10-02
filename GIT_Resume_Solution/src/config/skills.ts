export const SKILLS = [
  'Java',
  'Selenium',
  'Playwright',
  'API Testing',
  'Postman',
  'SQL',
  'MongoDB',
  'Jenkins',
  'Python',
  'C#',
  'REST Assured',
  'Cucumber',
  'GenAI',
  'Langchain',
  'Langgraph',
  'RAG',
  'Azure DevOps',
  'AWS Lambda',
  'GitHub',
  'DeepEval',
  'MCP (Model Context Protocol)',
  'Selenium WebDriver',
  'Core Java',
  'JavaScript',
  'TypeScript',
  'Node.js',
  'Express',
  'Mistral',
];

export function detectSkills(rawText: string): string[] {
  const normalized = rawText ?? '';
  const found = SKILLS.filter((skill) => normalized.toLowerCase().includes(skill.toLowerCase()));
  return found;
}
