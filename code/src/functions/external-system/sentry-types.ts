/**
 * Type definitions for Sentry API responses
 * Based on Sentry API v0 documentation
 * 
 * These types are used across:
 * - HTTP Client (API calls)
 * - Normalization (data transformation)
 * - Workers (business logic)
 */

// ============================================
// ORGANIZATION & PROJECT TYPES
// ============================================

export interface SentryOrganization {
  id: string;
  slug: string;
  name: string;
  dateCreated: string;
  status: {
    id: string;
    name: string;
  };
  avatar: {
    avatarType: string;
    avatarUuid: string | null;
  };
  isEarlyAdopter: boolean;
  require2FA: boolean;
}

export interface SentryProject {
  id: string;
  name: string;
  slug: string;
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  dateCreated: string;
  platform?: string;  // 'javascript', 'python', 'ruby', etc.
  status: string;     // 'active', 'disabled', etc.
  isPublic: boolean;
  isBookmarked: boolean;
  hasAccess: boolean;
  team?: {
    id: string;
    name: string;
    slug: string;
  };
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  features: string[];
  firstEvent: string | null;
  avatar: {
    avatarType: string;
    avatarUuid: string | null;
  };
}

// ============================================
// ISSUE & EVENT TYPES
// ============================================

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  permalink: string;
  logger: string | null;
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  status: 'resolved' | 'unresolved' | 'ignored';
  statusDetails: {};
  isPublic: boolean;
  platform: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  type: string;  // 'error', 'default', 'csp', etc.
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
    display_title_with_tree_label?: boolean;
  };
  numComments: number;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  isBookmarked: boolean;
  isSubscribed: boolean;
  subscriptionDetails: {
    reason: string;
  } | null;
  hasSeen: boolean;
  annotations: string[];
  
  // Metrics
  count: string;      // String number like "1234"
  userCount: number;
  firstSeen: string;  // ISO timestamp
  lastSeen: string;   // ISO timestamp
  
  // Tags and context
  tags: Array<{
    key: string;
    value: string;
  }>;
  
  contexts?: {
    [key: string]: any;
  };
}

export interface SentryEvent {
  id: string;
  eventID: string;
  groupID: string;
  message: string;
  title: string;
  location: string | null;
  culprit: string;
  level: string;
  platform: string;
  dateCreated: string;
  dateReceived: string;
  size: number;
  errors: Array<{
    type: string;
    message: string;
    data: any;
  }>;
  
  // Event context
  user: {
    id?: string;
    email?: string;
    username?: string;
    ip_address?: string;
    name?: string;
  } | null;
  
  contexts: {
    browser?: {
      name: string;
      version: string;
    };
    os?: {
      name: string;
      version: string;
    };
    device?: {
      name: string;
      brand: string;
      model: string;
    };
    runtime?: {
      name: string;
      version: string;
    };
  };
  
  sdk: {
    name: string;
    version: string;
  };
  
  // Tags and metadata
  tags: Array<{
    key: string;
    value: string;
  }>;
  
  // Release info
  release: {
    version: string;
    dateCreated: string;
  } | null;
  
  environment: string;
}

// ============================================
// USER & MEMBER TYPES
// ============================================

export interface SentryMember {
  id: string;
  email: string;
  name: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    avatarUrl: string;
    isActive: boolean;
    hasPasswordAuth: boolean;
    dateJoined: string;
  };
  role: 'member' | 'admin' | 'manager' | 'owner';
  roleName: string;
  pending: boolean;
  expired: boolean;
  flags: {
    'sso:linked': boolean;
    'sso:invalid': boolean;
  };
  dateCreated: string;
  inviteStatus: 'approved' | 'requested_to_be_invited' | 'requested_to_join';
  inviterName: string | null;
  teams: string[];  // Team slugs
  teamRoles: Array<{
    teamSlug: string;
    role: string;
  }>;
  orgRole: string;
}

// ============================================
// PAGINATION & API RESPONSE TYPES
// ============================================

export interface SentryPaginatedResponse<T> {
  data: T[];
  headers: {
    link?: string;  // Contains pagination links
    'x-hits'?: string;
  };
}

export interface SentryCursorPagination {
  cursor?: string;
  per_page?: number;
  // Sentry uses cursor-based pagination
  // The cursor is extracted from the Link header
}

// ============================================
// API ERROR TYPES
// ============================================

export interface SentryAPIError {
  detail: string;
  status: number;
  type: string;
  title: string;
  instance: string;
}

// ============================================
// WEBHOOK TYPES (for future use)
// ============================================

export interface SentryWebhookPayload {
  action: 'created' | 'resolved' | 'assigned' | 'ignored';
  actor: {
    id: string;
    name: string;
    type: 'user' | 'application';
  };
  data: {
    issue?: SentryIssue;
    event?: SentryEvent;
  };
  installation: {
    uuid: string;
  };
}

// ============================================
// HELPER TYPES
// ============================================

export type SentryLogLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
export type SentryIssueStatus = 'resolved' | 'unresolved' | 'ignored';
export type SentryPlatform = 'javascript' | 'python' | 'ruby' | 'go' | 'java' | 'php' | 'csharp' | 'other';

// Type guards for runtime validation
export function isSentryIssue(obj: any): obj is SentryIssue {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.title === 'string' &&
    typeof obj.culprit === 'string';
}

export function isSentryProject(obj: any): obj is SentryProject {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string';
}