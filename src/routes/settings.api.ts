import express, { Response } from 'express';

const router = express.Router();

router.get('/', async (req: any, res: Response) => {
  try {
    
    const settings = await req.db.settings.findFirst();
    if (settings && settings?.id > 0) {
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } else {
      throw new Error('No settings found');
    }
  } catch (e) {
    return res.status(500).json({
      success: false,
    });
  }
});

router.put('/', async (req: any, res: Response) => {
  try {
    const settings = await req.db.settings.upsert({
      where: {
        id: 1,
      },
      update: {
        listener_auth_code: req.body.listener_auth_code,
        listener_client_id: req.body.listener_client_id,
        listener_secret: req.body.listener_secret,
        listener_user_name: req.body.listener_user_name,
        channel_name: req.body.channel_name,
        is_connected: true,
      },
      create: {
        listener_auth_code: req.body.listener_auth_code,
        listener_client_id: req.body.listener_client_id,
        listener_secret: req.body.listener_secret,
        listener_user_name: req.body.listener_user_name,
        channel_name: req.body.channel_name,
        is_connected: true,
      },
    });
  
    if (settings && settings?.id > 0) {
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } else {
      throw true;
    }
  } catch (e) {
    if (e !== true) {
      console.error(e);
    }
    return res.status(500).json({
      success: false,
    });
  }
});

router.delete('/', async (req: any, res: Response) => {
  try {
    const settings = await req.db.settings.deleteMany({});
  
    if (settings && settings.count > 0) {
      return res.status(200).json({
        success: true,
      });
    } else {
      throw true;
    }
  } catch (e) {
    if (e !== true) {
      console.error(e);
    }
    return res.status(500).json({
      success: false,
    });
  }
});

module.exports = router;
