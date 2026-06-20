// Client-side types for the CMS admin console. Mirror the JSON shapes the
// admin API (src/app/api/cms) returns.

export interface Site {
  id: string;
  key: string;
  name: string;
  locales: string[];
  defaultLocale: string;
  githubRepo: string;
  dispatchEvent: string;
  createdAt: string;
  // Optional project scope. null = the global (console) namespace.
  projectId: string | null;
  // The owning project's public key (e.g. "practa"), or null when global. Used
  // to group the site list and to carry ?project= on links.
  projectKey?: string | null;
}

// Project mirrors the cms.projects table. Optional scope for sites; selectable
// when creating or moving a site.
export interface Project {
  id: string;
  key: string;
  name: string;
  createdAt: string;
}

export type FieldType =
  | "text"
  | "textarea"
  | "stringlist"
  | "paragraphs"
  | "object"
  | "list"
  | "pairs"
  | "image"
  | "select";

export interface Field {
  key: string;
  type: FieldType;
  label: string;
  readOnly?: boolean;
  fields?: Field[];
  options?: string[]; // allowed values when type === "select"
}

export interface Section {
  id: string;
  siteId: string;
  key: string;
  title: string;
  pageGroup: string;
  position: number;
  localized: boolean;
  flatten: boolean;
  schema: Field[];
}

export interface Asset {
  id: string;
  siteId: string;
  objectKey: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

// localeAll is the pseudo-locale used by non-localized sections.
export const localeAll = "*";
