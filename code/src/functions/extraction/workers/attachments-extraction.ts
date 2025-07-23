import { ExtractorEventType, processTask } from '@devrev/ts-adaas';

processTask({
  task: async ({ adapter }) => {
    console.log('Skipping attachments extraction - Sentry issues include context inline');
    
    // Immediately mark as done since we don't have attachments to process
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone, {});
  },
  
  onTimeout: async ({ adapter }) => {
    // Even on timeout, we're done (nothing to process)
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone, {});
  },
});