import EventEmitter from 'events';
import { ExtWebSocket } from '..';
import style from '../../../utils/consoleLogStyling';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

export default function serviceHandler(
  db: PrismaClient,
  request: any,
  services: string[],
  updateHandler: (serviceName: string, subscribedClients: SubscribedClients, data: any) => void,
  startImmediately = false,
  stopOnEmpty = true,
  cacheHandler?: (name: string, data: any) => Map<any, any>,
  onSubscriptionSendCache?: (cache: Map<any, any>, client: ExtWebSocket) => void,
  cronService?: CronService,
  onStart?: any,
  customEventListeners?: (client: ExtWebSocket, cache: Map<any, any>, service: any) => void,
) {
  const subscribedClients: SubscribedClients = new Map();
  const emitter = new EventEmitter(); // instantiate an emitter
  const service = request(emitter, db);

  // cache last update of each device
  const cache = new Map();

  for (const serviceName of services) {
    emitter.on(serviceName, (data: any) => {
      cacheHandler && cache.set(serviceName, cacheHandler(serviceName, data));
      updateHandler(serviceName, subscribedClients, data);
    });
  }

  if (startImmediately && service) {
    service('start');
  }

  if (onStart) {
    onStart();
  }

  if (cronService) {
    cron.schedule(cronService.schedule, () => {
      try {
        cronService.fn();
        service(cronService.action);
      } catch (err) {
        console.log(err);
      }
    });
  }

  return function subscribe(client: ExtWebSocket, isSubscribed: boolean, subscription?: string) {
    const userClients = subscribedClients.get(client.userId) || new Map(); // Map of unique user's clients

    if (isSubscribed) {
      // new subscription always triggers a start, start will be ignored if service is already started
      // this way we can manually start in case there are issues and db settings need to be changed
      service('start');

      userClients.set(client.uid, client); // overwrite the client reference even if it already is stored since its channels might be changed

      subscribedClients.set(client.userId, userClients);
      
      !startImmediately && subscribedClients.size === 1 && service('start');

      console.log(style('black', '📞[' + subscription + '][' + Array.from(client?.subscriptions?.get(subscription || '') || new Set([])).join(',') + '] ' + client.userId + ' (' + userClients.size + ')' + ' Subscribed'));

      // send cached update to new subscriber on subscription
      onSubscriptionSendCache && onSubscriptionSendCache(cache, client);

      // custom eventListeners for client upstream messages
      customEventListeners && customEventListeners(client, cache, service);

    } else {
      if (userClients.has(client.uid)) {
        userClients.delete(client.uid);

        if (userClients.size === 0) {
          subscribedClients.delete(client.userId);

          stopOnEmpty && subscribedClients.size === 0 && service('stop');
        } else {
          subscribedClients.set(client.userId, userClients);
        }

        console.log(style('black', '☎️[' + subscription + '] ' + client.userId + ' (' + userClients.size + ')' + ' Unsubscribed'));     
      } 
    }
  }
}

interface CronService {
  schedule: string,
  fn: any,
  action: string,
}

export type SubscribedClients = Map<string, Map<string, ExtWebSocket>>;

export interface SocketOutgoingUpdate {
  channels: string[],
  id: number,
  value: {
    isDead: boolean,
    isPaused: boolean,
    maxHealth: number,
    value: number,
  }
}
