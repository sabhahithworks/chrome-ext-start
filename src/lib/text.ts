import { LIMITS } from '@/config/app.config';

export interface Truncated {
  text: string;
  shown: number;
  total: number;
  truncated: boolean;
}

export function truncateText(input: string, max: number = LIMITS.TEXT_MAX_CHARS): Truncated {
  const total = input.length;
  if (total <= max) {
    return { text: input, shown: total, total, truncated: false };
  }
  let text = '';
  for (const char of Array.from(input)) {
    if (text.length + char.length > max) break;
    text += char;
  }
  return { text, shown: text.length, total, truncated: true };
}
