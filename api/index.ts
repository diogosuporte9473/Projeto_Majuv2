import { createApp } from "../server/_core/index";

export default async (req: any, res: any) => {
  const { app } = await createApp();
  return app(req, res);
};
