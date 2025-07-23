import { AirdropEvent, EventType, spawn } from '@devrev/ts-adaas';

import initialDomainMapping from '../external-system/initial_domain_mapping.json';

// TODO: If needed, you can replace this with state interface that will keep
// track of the loading progress.
export interface LoaderState {}

// TODO: Replace with your initial state that will be passed to the worker.
// This state will be used as a starting point for the loading process.
export const initialLoaderState: LoaderState = {};

function getWorkerPerLoadingPhase(event: AirdropEvent) {
  let path;
  switch (event.payload.event_type) {
    case EventType.StartLoadingData:
    case EventType.ContinueLoadingData:
      // Check if this is a webhook event
      if ((event.payload as any).webhook_event || (event.payload as any).trigger_type === 'webhook') {
        path = __dirname + '/workers/webhook-handler';
      } else {
        path = __dirname + '/workers/load-data';
      }
      break;
    case EventType.StartLoadingAttachments:
    case EventType.ContinueLoadingAttachments:
      path = __dirname + '/workers/load-attachments';
      break;
    // Handle webhook-specific events
    case 'WEBHOOK_RECEIVED' as any:
      path = __dirname + '/workers/webhook-handler';
      break;
  }
  return path;
}

const run = async (events: AirdropEvent[]) => {
  for (const event of events) {
    const file = getWorkerPerLoadingPhase(event);
    await spawn<LoaderState>({
      event,
      initialState: initialLoaderState,
      workerPath: file,
      initialDomainMapping,

      // TODO: If needed you can pass additional options to the spawn function.
      // For example timeout of the lambda, batch size, etc.
      // options: {
      //   timeout: 1 * 1000 * 60, // 1 minute
      // },
    });
  }
};

export default run;
