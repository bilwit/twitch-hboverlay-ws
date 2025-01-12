 import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "stream"
import ChatConnection from "./chatConnection";

export default function requestMetrics(emitter: EventEmitter, db: PrismaClient) {
  return async (action: string, id?: any) => {
    switch (action) {
      default:
        break;
      case 'start':
        // connect to twitch-chat ws
        const connect = await ChatConnection(db); 
        
        if (connect) {
          connect?.(emitter);
          emitter.emit('connect');
        }
        break;
      case 'stop':
        emitter.emit('disconnect');
        break;
      case 'reset':
      case 'pause':
      case 'unpause':
        emitter.emit(action, {
          id: id,
        });
        break;
    }
  };
};
