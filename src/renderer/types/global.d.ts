import type { ArnAIvApi } from '../../shared/types';

declare global {
  interface Window {
    arnAIv: ArnAIvApi;
  }
}

export {};
