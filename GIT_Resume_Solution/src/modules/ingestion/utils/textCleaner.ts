export function cleanResumeText(rawText: string): string {
  if (typeof rawText !== 'string') {
    return '';
  }

  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ ]*\n[ ]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .trim();
}
