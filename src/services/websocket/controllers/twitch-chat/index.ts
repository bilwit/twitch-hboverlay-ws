import { ExtWebSocket } from "../..";
import { SocketOutgoingUpdate, SubscribedClients } from "../serviceHandler";

export function setCacheHandler(_serviceName: string, update: any) {
  // cache each unique id update
  const cache = new Map();
  cache.set(update.id, update);

  return cache;
}

export function onSubscriptionSendCache(cache: Map<any, any>, client: ExtWebSocket) {
  const clientChannels = client.subscriptions.get('twitch-chat');

  const cacheUpdate = cache.get('update');

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

export function updateHandler(_serviceName: string, subscribedClients: SubscribedClients, data: SocketOutgoingUpdate) {
  for (const [_agentId, clientMap] of subscribedClients) {
    for (const [_clientId, client] of clientMap) {
      const clientChannels = client.subscriptions.get('twitch-chat');

      // payload might be applicable for multiple channels but we only want to send it one time so we need a counter
      let sendCount = 0;

      for (const channel of data.channels) {
        if (clientChannels?.has(channel)) {
          sendCount++;
        }
      }

      if (sendCount > 0) {
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
