import { Router } from "express";
import { upload_measurement, confirm_measurement, list_users_measurements } from "../controller/measure.controller";

const router = Router();

router.post('/upload', upload_measurement);
router.patch('/confirm', confirm_measurement);
router.get('/:customer_code/list', list_users_measurements);

export default router;