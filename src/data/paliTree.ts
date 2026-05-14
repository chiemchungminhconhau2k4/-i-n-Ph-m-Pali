export type TranslationMode = 'line-by-line' | 'summary' | 'vocabulary';

export interface PaliNode {
  id?: string | number;
  text: string;
  type?: 'folder' | 'leaf' | 'document';
  children?: PaliNode[];
  a_attr?: {
     href?: string;
     originalHref?: string;
  };
  name?: string;     // Backwards compatibility for UI
  paliName?: string; // Backwards compatibility for UI
  content?: string;
}
