import { Router, type IRouter } from "express";
import healthRouter from "./health";
import billoRouter from "./billo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(billoRouter);

export default router;
