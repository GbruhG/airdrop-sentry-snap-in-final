import { ExtractorEventType, processTask } from '@devrev/ts-adaas';
import { SentryHttpClient } from '../../external-system/sentry-http-client';
import staticExternalDomainMetadata from '../../external-system/external_domain_metadata.json';

const repos = [
  {
    itemType: 'external_domain_metadata',
  },
];

// fetches schema info about sentry data - combines static + dynamic metadata
processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);
    
    try {
      const externalDomainMetadata: any = {
        ...staticExternalDomainMetadata,
      };
      
      // try to get dynamic metadata (custom fields)
      try {
        const httpClient = new SentryHttpClient(adapter.event);
        const orgSlug = (adapter.event.payload.connection_data as any).subdomain;
        
        console.log(`fetching dynamic metadata for org: ${orgSlug}`);
        
        const selectedProjects = (adapter.event.payload as any).external_sync_units || [];
        
        if (selectedProjects.length > 0) {
          try {
            const project = await httpClient.getProject(selectedProjects[0].id);
            const issues = await httpClient.getIssues(project.slug);
            
            if (issues.data.length > 0) {
              const sampleIssue = issues.data[0];
              
              // check for custom tags
              if (sampleIssue.tags && Array.isArray(sampleIssue.tags)) {
                const customTags = sampleIssue.tags.map((tag: any) => ({
                  key: tag.key,
                  name: tag.key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                  values: tag.value ? [tag.value] : []
                }));
                
                if (!externalDomainMetadata.record_types.sentry_issues.custom_fields) {
                  externalDomainMetadata.record_types.sentry_issues.custom_fields = {};
                }
                
                customTags.forEach((tag: any) => {
                  externalDomainMetadata.record_types.sentry_issues.custom_fields[`tag_${tag.key}`] = {
                    display_name: `Tag: ${tag.name}`,
                    description: `custom tag from sentry`,
                    type: 'string',
                    required: false,
                    source: 'dynamic'
                  };
                });
                
                console.log(`found ${customTags.length} custom tags`);
              }
              
              // check for custom context
              if (sampleIssue.contexts) {
                const contextKeys = Object.keys(sampleIssue.contexts).filter(
                  key => !['browser', 'os', 'device', 'runtime'].includes(key)
                );
                
                if (!externalDomainMetadata.record_types.sentry_issues.custom_fields) {
                  externalDomainMetadata.record_types.sentry_issues.custom_fields = {};
                }
                
                contextKeys.forEach(key => {
                  externalDomainMetadata.record_types.sentry_issues.custom_fields[`context_${key}`] = {
                    display_name: `Context: ${key}`,
                    description: `custom context data from sentry`,
                    type: 'object',
                    required: false,
                    source: 'dynamic'
                  };
                });
                
                console.log(`found ${contextKeys.length} custom contexts`);
              }
            }
          } catch (error) {
            console.warn('could not fetch dynamic field info:', error);
            // continue with static metadata only
          }
        }
        
        externalDomainMetadata.organization = {
          slug: orgSlug,
          fetched_at: new Date().toISOString(),
          projects_count: selectedProjects.length
        };
        
      } catch (error) {
        console.warn('failed to fetch dynamic metadata, using static only:', error);
      }
      
      await adapter.getRepo('external_domain_metadata')?.push([externalDomainMetadata]);
      
      console.log('metadata extraction completed', {
        record_types: Object.keys(externalDomainMetadata.record_types),
        has_custom_fields: Object.keys(externalDomainMetadata.record_types.sentry_issues.custom_fields || {}).length > 0
      });
      
      await adapter.emit(ExtractorEventType.ExtractionMetadataDone, {});
      
    } catch (error: any) {
      console.error('metadata extraction failed:', error);
      
      await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
        error: { 
          message: `failed to extract metadata: ${error.message || 'unknown error'}` 
        },
      });
    }
  },
  
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
      error: { message: 'metadata extraction timed out' },
    });
  },
});