import {
  ExternalSystemAttachment,
  ExternalSystemItemLoadingParams,
  LoaderEventType,
  processTask,
} from '@devrev/ts-adaas';

import { SentryHttpClient } from '../../external-system/sentry-http-client';
import { LoaderState } from '../index';

// TODO: Replace with your create function that will be used to make API calls
// to the external system to create a new attachment. Function must return
// object with http stream or error depending on the response from the external system.
async function createAttachment({ item, mappers, event }: ExternalSystemItemLoadingParams<ExternalSystemAttachment>) {
  // TODO: Replace with your HTTP client that will be used to make API calls
  // to the external system.
  // TODO: Implement attachment creation for Sentry
  // const httpClient = new SentryHttpClient(event);
  // const createAttachmentResponse = await httpClient.createAttachment(item);
  return { error: 'Attachment creation not implemented for Sentry' };
}

processTask<LoaderState>({
  task: async ({ adapter }) => {
    const { reports, processed_files } = await adapter.loadAttachments({
      create: createAttachment,
    });

    await adapter.emit(LoaderEventType.AttachmentLoadingDone, {
      reports,
      processed_files,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.AttachmentLoadingProgress, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
