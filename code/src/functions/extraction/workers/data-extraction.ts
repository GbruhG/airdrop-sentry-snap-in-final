import { ExtractorEventType, processTask } from '@devrev/ts-adaas';
import { 
  normalizeSentryIssue, 
  normalizeSentryUser,
} from '../../external-system/data-normalization';
import { SentryHttpClient } from '../../external-system/sentry-http-client';

const repos = [
  {
    itemType: 'sentry_issues',
    normalize: normalizeSentryIssue,
  },
  {
    itemType: 'sentry_users',
    normalize: normalizeSentryUser,
  },
];

interface ItemTypeToExtract {
  name: 'sentry_issues' | 'sentry_users';
  extractFunction: (client: SentryHttpClient) => Promise<any[]>;
}

const itemTypesToExtract: ItemTypeToExtract[] = [
  {
    name: 'sentry_issues',
    extractFunction: async (client: SentryHttpClient) => {
      console.log('starting issues extraction');
      
      try {
        const projects = await client.getProjects();
        console.log(`found ${projects.length} projects`);
        
        const allIssues: any[] = [];
        
        for (const project of projects) {
          console.log(`extracting issues from project: ${project.name}`);
          
          try {
            let cursor: string | undefined;
            let pageCount = 0;
            
            do {
              pageCount++;
              const response = await client.getIssues(project.slug, cursor);
              console.log(`got ${response.data.length} issues from page ${pageCount}`);
              
              const issuesWithContext = response.data.map(issue => ({
                ...issue,
                _orgSlug: client.orgSlug,
                _projectSlug: project.slug,
              }));
              
              allIssues.push(...issuesWithContext);
              cursor = response.nextCursor;
              
            } while (cursor && pageCount < 10); // safety limit
            
          } catch (error: any) {
            console.error(`failed to extract issues from project ${project.slug}:`, error);
          }
        }
        
        console.log(`issues extraction complete: ${allIssues.length} total issues`);
        return allIssues;
        
      } catch (error: any) {
        console.error('failed to extract issues:', error);
        throw error;
      }
    },
  },
  {
    name: 'sentry_users',
    extractFunction: async (client: SentryHttpClient) => {
      console.log('starting users extraction');
      
      try {
        const users = await client.getUsers();
        console.log(`users extraction complete: ${users.length} users`);
        return users;
      } catch (error: any) {
        console.error('failed to extract users:', error);
        if (error.response?.status === 403) {
          console.log('no permission for users, skipping');
          return [];
        }
        throw error;
      }
    },
  },
];

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);
    const httpClient = new SentryHttpClient(adapter.event);
    
    console.log('starting data extraction');
    
    for (const itemType of itemTypesToExtract) {
      try {
        console.log(`processing ${itemType.name}...`);
        const items = await itemType.extractFunction(httpClient);
        
        if (items.length > 0) {
          const repo = adapter.getRepo(itemType.name);
          if (repo) {
            await repo.push(items);
            console.log(`pushed ${items.length} ${itemType.name} to repo`);
          } else {
            console.error(`no repo found for ${itemType.name}`);
          }
        } else {
          console.log(`no ${itemType.name} to push`);
        }
        
      } catch (error: any) {
        console.error(`failed to extract ${itemType.name}:`, error);
        await adapter.emit(ExtractorEventType.ExtractionDataError, {
          error: {
            message: `failed to extract ${itemType.name}: ${error.message || 'unknown error'}`,
          },
        });
        return;
      }
    }
    
    console.log('data extraction completed successfully');
    await adapter.emit(ExtractorEventType.ExtractionDataDone, {});
  },
  
  onTimeout: async ({ adapter }) => {
    console.warn('extraction timed out');
    await adapter.emit(ExtractorEventType.ExtractionDataProgress, {});
  },
});