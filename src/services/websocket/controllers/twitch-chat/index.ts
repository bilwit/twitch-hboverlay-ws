import { ExtWebSocket } from "../..";
import { SocketOutgoingUpdate, SubscribedClients } from "../serviceHandler";

export function setCacheHandler(name: string, update: any) {
  const cache = new Map();
  cache.set(name, update);

  return cache;
}

export function onSubscriptionSendCache(cache: Map<any, any>, client: ExtWebSocket) {
  for (const [_key, value] of cache) {
    client.send(JSON.stringify({
      message: 'update',
      data: value,
    }));
  }
}

export function updateHandler(_serviceName: string, subscribedClients: SubscribedClients, data: SocketOutgoingUpdate) {
  for (const [_agentId, clientMap] of subscribedClients) {
    for (const [_clientId, client] of clientMap) {
      const clientChannels = client.subscriptions.get('awsConnect');

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
          data: data.data,
        }));
      }
    }
  }
}
