const WHITESPACE_REGEX = /\s+/g;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

export type ProfileStatusValue = 'INCOMPLETE' | 'COMPLETE';

export const normalizeName = (value: string): string => {
  return value.trim().replace(WHITESPACE_REGEX, ' ');
};

export const containsOnlyPrintableCharacters = (value: string): boolean => {
  return !/\p{C}/u.test(value);
};

export const sanitizeOptionalName = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = normalizeName(value);
  if (normalized.length < NAME_MIN_LENGTH) {
    return null;
  }

  return normalized.length > 0 ? normalized : null;
};

export const resolveProfileStatusFromName = (
  value: string | null | undefined,
): ProfileStatusValue => {
  const sanitized = sanitizeOptionalName(value);
  return sanitized && sanitized.length >= NAME_MIN_LENGTH ? 'COMPLETE' : 'INCOMPLETE';
};

export const isValidName = (value: string): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = normalizeName(value);
  if (normalized.length < NAME_MIN_LENGTH || normalized.length > NAME_MAX_LENGTH) {
    return false;
  }

  return containsOnlyPrintableCharacters(normalized);
};
