import { 
  setCacheHandler as setCacheTwitchChat, 
  onSubscriptionSendCache as onSubscriptionTwitchChat, 
  updateHandler as updateHandlerTwitchChat, 
  customEventListeners as customEventListenersTwitchChat,
} from './controllers/twitch-chat';
import requestTwitchChat from "./controllers/twitch-chat/request";
import serviceHandler from './controllers/serviceHandler';
import { PrismaClient } from '@prisma/client';

export default function services(db: PrismaClient) {
  const list = new Map();

  list.set(
    'twitch-chat', 
    serviceHandler(
      db,
      requestTwitchChat, 
      ['update'], 
      updateHandlerTwitchChat,
      true,
      false,
      setCacheTwitchChat,
      onSubscriptionTwitchChat,
      undefined,
      undefined,
      customEventListenersTwitchChat,
    ),
  );

  return list;
}
