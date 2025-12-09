import * as admin from 'firebase-admin';
import { logger } from './logger';

let firebaseApp: admin.app.App | null = null;

export async function initializeFirebase(): Promise<void> {
  try {
    if (firebaseApp) {
      return;
    }
    
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    };
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
    });
    
    logger.info('Firebase initialized successfully');
  } catch (error) {
    logger.error('Firebase initialization failed:', error);
    // Don't throw - allow app to run without Firebase if not configured
  }
}

export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return firebaseApp;
}

export async function sendPushNotification(
  fcmToken: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
): Promise<void> {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized - skipping push notification');
      return;
    }
    
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };
    
    await admin.messaging().send(message);
    logger.info(`Push notification sent to ${fcmToken}`);
  } catch (error) {
    logger.error('Failed to send push notification:', error);
    throw error;
  }
}

export async function sendMulticastNotification(
  fcmTokens: string[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
): Promise<void> {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized - skipping push notification');
      return;
    }
    
    if (fcmTokens.length === 0) {
      return;
    }
    
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };
    
    const response = await admin.messaging().sendMulticast(message);
    logger.info(`Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
  } catch (error) {
    logger.error('Failed to send multicast notifications:', error);
    throw error;
  }
}

