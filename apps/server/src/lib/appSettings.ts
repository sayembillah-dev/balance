import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appSettings } from '../db/schema/index.js';

/**
 * Typed accessors over the instance-wide `app_settings` key/value table. Add a
 * key here with its default; readers get the default when the row is absent.
 */
export const APP_SETTING_DEFAULTS = {
  allow_open_signups: false as boolean,
  instance_name: 'Balance' as string,
} as const;

export type AppSettingKey = keyof typeof APP_SETTING_DEFAULTS;

export async function getAppSetting<K extends AppSettingKey>(
  key: K,
): Promise<(typeof APP_SETTING_DEFAULTS)[K]> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, key),
  });
  if (!row) return APP_SETTING_DEFAULTS[key];
  return row.value as (typeof APP_SETTING_DEFAULTS)[K];
}

export async function setAppSetting<K extends AppSettingKey>(
  key: K,
  value: (typeof APP_SETTING_DEFAULTS)[K],
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
