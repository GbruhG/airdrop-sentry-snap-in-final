import { ExternalSyncUnit, ExtractorEventType, processTask } from '@devrev/ts-adaas';
import { SentryHttpClient } from '../../external-system/sentry-http-client';
import { normalizeSentryProject } from '../../external-system/data-normalization';

interface SentryProject {
  id: string;
  name: string;
  slug: string;
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  dateCreated: string;
  platform?: string;
  status: string;
}

// fetches all sentry projects available for sync
processTask({
  task: async ({ adapter }) => {
    console.log('starting external sync units extraction');
    
    const sentryClient = new SentryHttpClient(adapter.event);
    
    try {
      // get all projects from sentry
      const projects = await sentryClient.getProjects();
      console.log(`fetched ${projects.length} projects from sentry`);
      
      const externalSyncUnits: ExternalSyncUnit[] = projects.map(
        project => normalizeSentryProject(project)
      );
      
      // filter out projects missing required fields
      const validSyncUnits = externalSyncUnits.filter(unit => {
        if (!unit.id || !unit.name) {
          console.log('skipping project with missing id or name', { unit });
          return false;
        }
        return true;
      });
      
      console.log(`found ${validSyncUnits.length} valid projects to sync`);
      
      await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsDone, {
        external_sync_units: validSyncUnits,
      });
      
    } catch (error) {
      console.log('failed to fetch sentry projects', { error });
      
      let errorMessage = 'unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as any).message);
      }

      await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsError, {
        error: {
          message: `failed to fetch sentry projects: ${errorMessage}`,
        },
      });
    }
  },
  
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsError, {
      error: {
        message: 'timeout while fetching sentry projects',
      },
    });
  },
});