import "server-only";

import { z } from "zod";

const originSchema = z.string().url().transform((value) => value.replace(/\/$/, ""));
const secretSchema = z.string().min(32);

export type LineServerConfig = {
  appOrigin: string;
  loginChannelId: string;
  loginChannelSecret: string;
  messagingChannelSecret: string;
  internalCommandSecret: string;
  continuationSecret: string;
};

export type LinePushConfig = {
  appOrigin: string;
  channelAccessToken: string;
};

export function getLineServerConfig(): LineServerConfig | null {
  const result = z.object({
    appOrigin: originSchema,
    loginChannelId: z.string().min(1),
    loginChannelSecret: secretSchema,
    messagingChannelSecret: secretSchema,
    internalCommandSecret: secretSchema,
    continuationSecret: secretSchema,
  }).safeParse({
    appOrigin: process.env.OPSCUE_APP_ORIGIN,
    loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID,
    loginChannelSecret: process.env.LINE_LOGIN_CHANNEL_SECRET,
    messagingChannelSecret: process.env.LINE_MESSAGING_CHANNEL_SECRET,
    internalCommandSecret: process.env.OPSCUE_LINE_INTERNAL_SECRET,
    continuationSecret: process.env.OPSCUE_CONTINUATION_SECRET,
  });
  return result.success ? result.data : null;
}

export function requireLineServerConfig() {
  const config = getLineServerConfig();
  if (!config) throw new Error("LINE server configuration is unavailable");
  return config;
}

export function getContinuationSecret() {
  const result = secretSchema.safeParse(process.env.OPSCUE_CONTINUATION_SECRET);
  return result.success ? result.data : null;
}

export function requireLinePushConfig(): LinePushConfig {
  const result = z.object({
    appOrigin: originSchema.refine((value) => new URL(value).protocol === "https:", "HTTPS origin required"),
    channelAccessToken: secretSchema,
  }).safeParse({
    appOrigin: process.env.OPSCUE_APP_ORIGIN,
    channelAccessToken: process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
  });
  if (!result.success) throw new Error("LINE push configuration is unavailable");
  return result.data;
}

export function lineCallbackUri(config: LineServerConfig) {
  return `${config.appOrigin}/api/line/callback`;
}
