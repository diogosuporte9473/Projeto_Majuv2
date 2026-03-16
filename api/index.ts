import { createApp } from "../server/_core/index.ts";

export default async (req: any, res: any) => {
  const { app } = await createApp();
  return app(req, res);
};
