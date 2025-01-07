import WebSocket from "ws"
import { IncomingMessage, Server } from "http";
import style from '../../utils/consoleLogStyling';
import dotenv from 'dotenv';
import initServices from "./services";
import { PrismaClient } from "@prisma/client";

dotenv.config();

export default function websocket(server: Server, db: PrismaClient) {
  try {
    const ws = new WebSocket.Server({
      noServer: true,
    });
  
    server.on("upgrade", (request, socket, head) => {
      socket.on('error', onSocketError);

      // ********** NO AUTH IMPLEMENTED **********
      // authenticate(request, function next(err: any, isAuthenticated: boolean) {
      // adds 'userId' field after authentication 
      //   if (err || !isAuthenticated) {
      //     socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      //     socket.destroy();
      //     return;
      //   }

      //   socket.removeListener('error', onSocketError);

        ws.handleUpgrade(request, socket, head, function done(client) {
          ws.emit('connection', client, request);
        });
      // });
    });

    // service handlers
    const services = initServices(db);

    // client handler
    if (ws) {
      ws.on('connection', (client: WebSocket, req) => {
        const r = req as IncomingMessageExt;

        try {
          const extClient = client as ExtWebSocket;
          extClient.isAlive = true;
          extClient.subscriptions = new Map();
          extClient.userId = 'foo';
          extClient.uid = (new Date()).getTime();
          extClient.on('error', console.error);
          extClient.on('pong', () => extClient.isAlive = true);

          console.log(style('success', '🔌[Client Connected] ' + r?.userId));
  
          extClient.addEventListener('message', (event: any) => {
            if (event?.data) {
              try {
                const eventData = JSON.parse(event.data);
                switch (eventData?.message) {
                  case 'subscribe':
                    if (services.has(eventData?.data)) {
                      extClient.subscriptions.set(eventData?.data, new Set(eventData?.channels || []));
                      services.get(eventData?.data)(extClient, true, eventData?.data);
                    }
                    break;
                  case 'unsubscribe':
                    if (services.has(eventData?.data)) {
                      extClient.subscriptions.delete(eventData?.data);
                      services.get(eventData?.data)(extClient, false, eventData?.data);
                    }
                    break;
                  default:
                    break;
                }
              } catch (e) {
                console.log(e);
              }
            }
          });

          // keep alive
          const keepAlive = setInterval(function ping() { 
            if (extClient.isAlive === false) {
              // unsubscribe all services
              for (const [service, emitter] of services) {
                if (extClient.subscriptions.get(service)) {
                  emitter(extClient, false, service);
                }
              }
      
              console.log(style('health', '▥ [Client Removed] ' + extClient.userId ));
      
              extClient.terminate();
              clearInterval(keepAlive);
            }
        
            extClient.isAlive = false;
            extClient.ping();
          }, 30000);
        } catch (e) {
          console.log(e);
        }
      });

      ws.on('close', function close() {
        console.log('close')
      });
    }
  } catch(err) {
    console.log(err);
  }
};

function onSocketError(err: any) {
  console.error(err);
}

export interface IncomingMessageExt extends IncomingMessage {
  userId: string,
  adAccount?: string,
}

export interface ExtWebSocket extends WebSocket {
  uid: number,
  isAlive: boolean,
  subscriptions: Map<string, Set<string>>,
  userId: string,
  adAccount: string,
}
