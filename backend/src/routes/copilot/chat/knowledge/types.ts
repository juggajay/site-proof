export interface PageKnowledge {
  route: string;
  title: string;
  keywords: string[];
  roles: string;
  surface: 'office' | 'foreman-shell' | 'subbie-portal';
  body: string;
}

export interface PageKnowledgeSearchResult {
  route: string;
  title: string;
  snippet: string;
}
