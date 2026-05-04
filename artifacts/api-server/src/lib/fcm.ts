import { logger } from "./logger.js";

type FirebaseApp = import("firebase-admin/app").App;

let _app: FirebaseApp | null = null;
let _initAttempted = false;

async function getApp(): Promise<FirebaseApp | null> {
  if (_initAttempted) return _app;
  _initAttempted = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled");
    return null;
  }

  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const existing = getApps();
    if (existing.length > 0) {
      _app = existing[0];
    } else {
      const serviceAccount = JSON.parse(raw);
      _app = initializeApp({ credential: cert(serviceAccount) });
    }
    logger.info("Firebase Admin SDK initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin SDK");
  }

  return _app;
}

export interface FcmNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushToToken(
  fcmToken: string,
  notification: FcmNotification,
): Promise<boolean> {
  const app = await getApp();
  if (!app) return false;

  try {
    const { getMessaging } = await import("firebase-admin/messaging");
    await getMessaging(app).send({
      token: fcmToken,
      notification: { title: notification.title, body: notification.body },
      data: notification.data ?? {},
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "cityserve_complaints" },
      },
    });
    logger.info({ prefix: fcmToken.slice(0, 20) + "..." }, "FCM push sent");
    return true;
  } catch (err) {
    logger.warn({ err }, "FCM send failed (token may be stale)");
    return false;
  }
}

export function notify(fcmToken: string | null | undefined, notification: FcmNotification): void {
  if (!fcmToken) return;
  sendPushToToken(fcmToken, notification).catch(() => {});
}

export function notifyMany(fcmTokens: Array<string | null | undefined>, notification: FcmNotification): void {
  for (const token of fcmTokens) {
    notify(token, notification);
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; phone?: string; email?: string } | null> {
  const app = await getApp();
  if (!app) {
    // Dev mode: decode without verification
    try {
      const parts = idToken.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      return { uid: payload.uid ?? payload.sub, phone: payload.phone_number, email: payload.email };
    } catch {
      return null;
    }
  }
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return { uid: decoded.uid, phone: decoded.phone_number, email: decoded.email };
  } catch (err) {
    logger.warn({ err }, "Firebase token verification failed");
    return null;
  }
}
