import {
  ExternalSystemItem,
  ExternalSystemItemLoadingParams,
  ExternalSystemItemLoadingResponse,
  LoaderEventType,
  processTask,
} from '@devrev/ts-adaas';

import { SentryHttpClient } from '../../external-system/sentry-http-client';
import { LoaderState } from '../index';

/**
 * Create a new issue in Sentry (reverse sync)
 * Note: Sentry doesn't typically support creating issues via API
 */
async function createSentryIssue({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams<ExternalSystemItem>): Promise<ExternalSystemItemLoadingResponse> {
  console.log('=== CREATE SENTRY ISSUE REQUEST ===');
  console.log('Item:', JSON.stringify(item, null, 2));
  
  // Sentry doesn't support creating issues directly via API
  // Issues are created when errors occur in applications
  return { 
    error: 'Creating issues in Sentry is not supported. Issues are created automatically when errors occur in your applications.' 
  };
}

/**
 * Update an existing issue in Sentry (reverse sync)
 */
async function updateSentryIssue({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams<ExternalSystemItem>): Promise<ExternalSystemItemLoadingResponse> {
  console.log('=== UPDATE SENTRY ISSUE REQUEST ===');
  console.log('Item:', JSON.stringify(item, null, 2));
  
  try {
    const httpClient = new SentryHttpClient(event);
    
    // Extract issue ID from the external item
    const issueId = (item as any).external_id || (item as any).id;
    if (!issueId) {
      return { error: 'No issue ID provided for update' };
    }
    
    // Map DevRev fields to Sentry update payload
    const updates: any = {};
    
    // Handle status changes
    if ((item as any).status) {
      // Map DevRev status to Sentry status
      switch ((item as any).status) {
        case 'resolved':
        case 'closed':
          updates.status = 'resolved';
          break;
        case 'ignored':
          updates.status = 'ignored';
          break;
        case 'open':
        case 'in_progress':
          updates.status = 'unresolved';
          break;
      }
    }
    
    // Handle assignment changes
    if ((item as any).assignedTo) {
      updates.assignedTo = (item as any).assignedTo;
    }
    
    // Handle seen status
    if ((item as any).hasSeen !== undefined) {
      updates.hasSeen = (item as any).hasSeen;
    }
    
    console.log(`Updating Sentry issue ${issueId} with:`, updates);
    
    // Update the issue in Sentry
    const result = await httpClient.updateIssue(issueId, updates);
    
    if (result.error) {
      console.error('Failed to update Sentry issue:', result.error);
      return { error: result.error };
    }
    
    console.log(`Successfully updated Sentry issue ${issueId}`);
    return { id: issueId };
    
  } catch (error: any) {
    console.error('Error updating Sentry issue:', error);
    return { 
      error: `Failed to update issue: ${error.message}`,
      delay: 30000 // Retry after 30 seconds
    };
  }
}

/**
 * Create a comment on Sentry issue (reverse sync)
 */
async function createSentryComment({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams<ExternalSystemItem>): Promise<ExternalSystemItemLoadingResponse> {
  console.log('=== CREATE SENTRY COMMENT REQUEST ===');
  
  try {
    const httpClient = new SentryHttpClient(event);
    
    const issueId = (item as any).parent_id || (item as any).issue_id;
    const commentText = (item as any).text || (item as any).body || (item as any).content;
    
    if (!issueId || !commentText) {
      return { error: 'Missing issue ID or comment text' };
    }
    
    console.log(`Creating comment on Sentry issue ${issueId}`);
    
    const result = await httpClient.createComment(issueId, commentText);
    
    if (result.error) {
      return { error: result.error };
    }
    
    console.log(`Successfully created comment on issue ${issueId}`);
    return { id: result.id || 'comment-created' };
    
  } catch (error: any) {
    console.error('Error creating Sentry comment:', error);
    return { 
      error: `Failed to create comment: ${error.message}`,
      delay: 30000
    };
  }
}

processTask<LoaderState>({
  task: async ({ adapter }) => {
    console.log('=== STARTING SENTRY DATA LOADING ===');
    
    const { reports, processed_files } = await adapter.loadItemTypes({
      itemTypesToLoad: [
        {
          itemType: 'sentry_issues',
          create: createSentryIssue,
          update: updateSentryIssue,
        },
        {
          itemType: 'sentry_comments',
          create: createSentryComment,
          update: createSentryComment, // Comments don't typically get updated
        },
      ],
    });

    console.log('=== SENTRY DATA LOADING COMPLETE ===');
    console.log('Reports:', reports);

    await adapter.emit(LoaderEventType.DataLoadingDone, {
      reports,
      processed_files,
    });
  },
  
  onTimeout: async ({ adapter }) => {
    console.warn('Sentry data loading timed out');
    await adapter.emit(LoaderEventType.DataLoadingProgress, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
