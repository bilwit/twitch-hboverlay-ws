 import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "stream"
import ChatConnection from "./chatConnection";

export default function requestMetrics(emitter: EventEmitter, db: PrismaClient) {
  return async (action: string) => {
    let connect;

    if (action === 'start') {
      // connect to twitch-chat ws
      connect = await ChatConnection(db);
      connect?.(emitter);
      
      emitter.emit('connect');
    }

    if (action === 'stop') {
      emitter.emit('disconnect');
    }
  };
};
