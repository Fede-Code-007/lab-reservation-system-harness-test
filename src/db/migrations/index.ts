import { id as initialId, up as initialUp } from './001_initial.js';

export interface Migration {
  id: string;
  up: string;
}

export const migrations: Migration[] = [{ id: initialId, up: initialUp }];
