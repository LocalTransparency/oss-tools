import { HAMILTON } from './hamilton';

/** Registry of Indiana counties covered by this tool. */
export const COUNTIES = { hamilton: HAMILTON } as const;

export type CountyId = keyof typeof COUNTIES;
