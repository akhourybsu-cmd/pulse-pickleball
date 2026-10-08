import { QUESTION_BANK_V1 } from './questionBank.ts';
import { QUESTION_BANK_V2 } from './questionBankV2.ts';
import { QUESTION_BANK_V3 } from './questionBankV3.ts';

/** Never substitute a current question for a stored answer's original meaning. */
export function assessmentBank(version: number) {
  if (version === 3) return QUESTION_BANK_V3;
  if (version === 2) return QUESTION_BANK_V2;
  if (version === 1) return QUESTION_BANK_V1;
  throw new Error('This assessment version needs a newer app.');
}
export const CURRENT_QUESTION_BANK = QUESTION_BANK_V3;
