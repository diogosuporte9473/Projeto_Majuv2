import { createApp } from "../server/_core/index.js";

export default async (req: any, res: any) => {
  const { app } = await createApp();
  return app(req, res);
};
