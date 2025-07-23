import { AirdropEvent } from '@devrev/ts-adaas';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  SentryProject, 
  SentryIssue, 
  SentryMember,
  SentryEvent 
} from './sentry-types';

/**
 * http client for sentry api with rate limit handling
 * see: https://docs.sentry.io/api/
 */
export class SentryHttpClient {
  private apiEndpoint: string;
  private apiToken: string;
  public orgSlug: string; 
  private axiosInstance: AxiosInstance;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second

  constructor(event: AirdropEvent) {
    // extract connection data from the event
    // this comes from the keyring configuration in manifest.yaml
    const connectionData = event.payload.connection_data;
    
    console.log('Connection data received:', JSON.stringify(connectionData, null, 2));
    
    this.apiToken = connectionData.key;
    
    // the organization slug from the org_name field
    this.orgSlug = connectionData.org_name || '';
    
    console.log('Using org slug:', this.orgSlug);
    console.log('Using token:', this.apiToken ? 'Present' : 'Missing');
    
    // sentry uses org-specific subdomains
    this.apiEndpoint = `https://${this.orgSlug}.sentry.io/api/0`;
    
    console.log('Constructed API endpoint:', this.apiEndpoint);
    
    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.apiEndpoint,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });
  }

  /**
   * sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * check if error is rate limit related
   */
  private isRateLimitError(error: AxiosError): boolean {
    return error.response?.status === 429 || error.response?.status === 503;
  }

  /**
   * get retry delay from rate limit headers or use exponential backoff
   */
  private getRetryDelay(error: AxiosError, attempt: number): number {
    // check for Retry-After header (seconds)
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        console.log(`Rate limit hit, Retry-After header suggests ${seconds} seconds`);
        return seconds * 1000; // convert to milliseconds
      }
    }

    // check for X-RateLimit-Reset header (unix timestamp)
    const rateLimitReset = error.response?.headers['x-ratelimit-reset'];
    if (rateLimitReset) {
      const resetTime = parseInt(rateLimitReset, 10) * 1000; // convert to milliseconds
      const now = Date.now();
      const delay = Math.max(0, resetTime - now);
      if (delay > 0 && delay < 300000) { // max 5 minutes
        console.log(`Rate limit reset at ${new Date(resetTime)}, waiting ${delay}ms`);
        return delay;
      }
    }

    // fallback to exponential backoff
    const delay = this.baseDelay * Math.pow(2, attempt - 1);
    console.log(`Using exponential backoff: ${delay}ms for attempt ${attempt}`);
    return delay;
  }

  /**
   * execute request with retry logic for rate limits
   */
  private async executeWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    let lastError: AxiosError | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = axiosError;
        
        if (this.isRateLimitError(axiosError)) {
          if (attempt < this.maxRetries) {
            const delay = this.getRetryDelay(axiosError, attempt);
            console.log(`Rate limit hit (${axiosError.response?.status}), retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
            await this.sleep(delay);
            continue;
          } else {
            console.error(`Rate limit exceeded, max retries (${this.maxRetries}) reached`);
          }
        }
        
        // if not a rate limit error or max retries reached, throw the error
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * get all projects for the org
   * get /organizations/{org_slug}/projects/
   */
  async getProjects(): Promise<SentryProject[]> {
    return this.executeWithRetry(async () => {
      try {
        const response = await this.axiosInstance.get<SentryProject[]>(
          `/organizations/${this.orgSlug}/projects/`
        );
        return response.data;
      } catch (error) {
        console.error('Failed to fetch Sentry projects:', error);
        throw error;
      }
    });
  }

  /**
   * get issues for a project (paginated)
   * get /projects/{org_slug}/{project_slug}/issues/
   */
  async getIssues(projectSlug: string, cursor?: string): Promise<{
    data: SentryIssue[];
    nextCursor?: string;
  }> {
    return this.executeWithRetry(async () => {
      try {
        const params: any = {
          limit: 100, // max 100 per page
          // sentry uses cursor-based pagination
          cursor: cursor,
        };
        
        const url = `/projects/${this.orgSlug}/${projectSlug}/issues/`;
        console.log(`Making Sentry API call to: ${this.apiEndpoint}${url}`);
        console.log(`Request params:`, params);
        
        const response = await this.axiosInstance.get(url, { params });
        
        console.log(`Sentry API response status: ${response.status}`);
        console.log(`Sentry API response headers:`, response.headers);
        console.log(`Issues returned: ${response.data?.length || 0}`);
        if (response.data?.length > 0) {
          console.log(`First issue sample:`, JSON.stringify(response.data[0], null, 2));
        }
        
        // extract next cursor from Link header
        // ex: <https://sentry.io/api/0/projects/.../issues/?cursor=1234:0:1>; rel="next"
        const linkHeader = response.headers.link;
        let nextCursor: string | undefined;
        
        if (linkHeader) {
          console.log(`Link header: ${linkHeader}`);
          const nextLink = linkHeader.split(',').find((link: string) => link.includes('rel="next"'));
          if (nextLink) {
            const match = nextLink.match(/cursor=([^>&]+)/);
            if (match) {
              nextCursor = match[1];
              console.log(`Next cursor: ${nextCursor}`);
            }
          }
        }
        
        return {
          data: response.data,
          nextCursor,
        };
      } catch (error: any) {
        console.error(`Failed to fetch issues for project ${projectSlug}:`, error);
        if (error.response) {
          console.error(`Error response status: ${error.response.status}`);
          console.error(`Error response data:`, error.response.data);
        }
        throw error;
      }
    });
  }

  /**
   * get events (error occurrences) for an issue
   * get /issues/{issue_id}/events/
   */
  async getEvents(issueId: string, cursor?: string): Promise<{
    data: any[];
    nextCursor?: string;
  }> {
    return this.executeWithRetry(async () => {
      try {
        const params: any = {
          limit: 50, // events can be large, use smaller limit
          cursor: cursor,
        };
        
        const response = await this.axiosInstance.get(
          `/issues/${issueId}/events/`,
          { params }
        );
        
        const linkHeader = response.headers.link;
        let nextCursor: string | undefined;
        
        if (linkHeader) {
          const nextLink = linkHeader.split(',').find((link: string) => link.includes('rel="next"'));
          if (nextLink) {
            const match = nextLink.match(/cursor=([^>&]+)/);
            if (match) {
              nextCursor = match[1];
            }
          }
        }
        
        return {
          data: response.data,
          nextCursor,
        };
      } catch (error) {
        console.error(`Failed to fetch events for issue ${issueId}:`, error);
        throw error;
      }
    });
  }

  /**
   * get users in the org
   * get /organizations/{org_slug}/members/
   */
  async getUsers(): Promise<SentryMember[]> {
    return this.executeWithRetry(async () => {
      try {
        const response = await this.axiosInstance.get<SentryMember[]>(
          `/organizations/${this.orgSlug}/members/`
        );
        return response.data;
      } catch (error) {
        console.error('Failed to fetch Sentry users:', error);
        throw error;
      }
    });
  }

  /**
   * get a single project by slug
   * get /projects/{org_slug}/{project_slug}/
   */
  async getProject(projectSlug: string): Promise<any> {
    return this.executeWithRetry(async () => {
      try {
        const response = await this.axiosInstance.get(`/projects/${this.orgSlug}/${projectSlug}/`);
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch project ${projectSlug}:`, error);
        throw error;
      }
    });
  }

  /**
   * update an issue (for reverse sync)
   * put /issues/{issue_id}/
   */
  async updateIssue(issueId: string, updates: {
    status?: 'resolved' | 'unresolved' | 'ignored';
    assignedTo?: string;
    hasSeen?: boolean;
  }): Promise<any> {
    return this.executeWithRetry(async () => {
      try {
        const response = await this.axiosInstance.put(`/issues/${issueId}/`, updates);
        return response.data;
      } catch (error) {
        console.error(`Failed to update issue ${issueId}:`, error);
        throw error;
      }
    });
  }

  /**
   * create a comment on an issue
   * post /issues/{issue_id}/notes/
   */
  async createComment(issueId: string, text: string): Promise<any> {
    return this.executeWithRetry(async () => {
      try {
        const response = await this.axiosInstance.post(`/issues/${issueId}/notes/`, {
          text,
        });
        return response.data;
      } catch (error) {
        console.error(`Failed to create comment on issue ${issueId}:`, error);
        throw error;
      }
    });
  }
}