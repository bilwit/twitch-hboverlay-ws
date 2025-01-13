import { ExtWebSocket } from "../..";
import { SocketOutgoingUpdate, SubscribedClients } from "../serviceHandler";

export function setCacheHandler(serviceName: string, update: any) {
  if (serviceName === 'update') {
    const cache = new Map();

    // cache each unique id update
    const updateCache = new Map();
    updateCache.set(update.id, update);

    cache.set('update', updateCache);

    return cache;
  }

  if (serviceName === 'connection-status') {
    return update;
  }


}

export function onSubscriptionSendCache(cache: Map<any, any>, client: ExtWebSocket) {
  const clientChannels = client.subscriptions.get('twitch-chat');

  const cacheUpdate = cache.get('update');
  if (cacheUpdate && cacheUpdate.size > 0) {
    for (const [_key, value] of cacheUpdate) {
      if (clientChannels?.has(value.id)) {
        client.send(JSON.stringify({
          message: 'update',
          channels: value.channels,
          data: {
            id: value.id,
            value: value.value,
          },
        }));
      }
    }
  }

  const cacheConnection = cache.get('connection-status');
  if (cacheConnection) {
    client.send(JSON.stringify({
      message: 'connection-status',
      channels: cacheConnection.channels,
      data: cacheConnection.isConnected,
    }));
  }
}

export function customEventListeners(client: ExtWebSocket, cache: Map<any, any>, service: (action: string, id?: string) => Promise<void>) {
  client.addEventListener('message', (event: any) => {
    if (event?.data) {
      try {
        const eventData = JSON.parse(event.data);

        switch (eventData?.message) {
          default:
            service(eventData?.message, eventData?.id);
            break;
          // send current data of requested id
          case 'current':
            const cacheUpdate = cache.get('update');
            const requestedCurrent = cacheUpdate.get(eventData?.id);

            if (requestedCurrent) {
              client.send(JSON.stringify({
                message: 'update',
                channels: [eventData?.id],
                data: {
                  id: requestedCurrent?.id,
                  value: requestedCurrent?.value,
                },
              })); 
            }
            break;            
        }
      } catch (e) {
        console.log(e);
      }
    }
  });
}

export function updateHandler(_serviceName: string, subscribedClients: SubscribedClients, data: SocketOutgoingUpdate) {
  for (const [_agentId, clientMap] of subscribedClients) {
    for (const [_clientId, client] of clientMap) {
      const clientChannels = client.subscriptions.get('twitch-chat');

      // payload might be applicable for multiple channels but we only want to send it one time so we need a counter
      let sendCount = 0;
      let isConnectionStatus = false;

      if (data?.channels && data.channels.length > 0) {
        for (const channel of data.channels) {
          if (clientChannels?.has(channel)) {
            if (channel === 'connection-status') {
              isConnectionStatus = true;
            }
            sendCount++;
          }
        }
  
        if (sendCount > 0)  {
          if (isConnectionStatus) {
            client.send(JSON.stringify({
              message: 'connection-status',
              channels: data.channels,
              data: data.isConnected,
            }));
          } else {
            client.send(JSON.stringify({
              message: 'update',
              channels: data.channels,
              data: {
                id: data.id,
                value: data.value,
              },
            }));
          }
        }
      }
    }
  }
}
