 import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "stream"
import ChatConnection from "./chatConnection";

export default function requestMetrics(emitter: EventEmitter, db: PrismaClient) {
  return async (action: string) => {
    let isStarted = false;

    if (!isStarted && action === 'start') {
      // connect to twitch-chat ws
      const connect = await ChatConnection(db); 
      isStarted = true;
      
      if (connect) {
        connect?.(emitter);
        emitter.emit('connect');
      }
    }

    if (action === 'stop') {
      emitter.emit('disconnect');
      isStarted = false;
    }
  };
};
