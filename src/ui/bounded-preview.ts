import { LIMITS } from '../contracts/limits';
import { utf8Bytes } from '../domain/json/canonical';
export function boundedPreview(text: string): {
  readonly text: string;
  readonly truncated: boolean;
} {
  let bytes = 0,
    result = '';
  for (const scalar of text) {
    bytes += utf8Bytes(scalar);
    if (bytes > LIMITS.MAX_INSPECTOR_PREVIEW_BYTES) return { text: result, truncated: true };
    result += scalar;
  }
  return { text: result, truncated: false };
}
