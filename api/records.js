import { createRawRecord, deleteRawRecord, getAllRawRecords, getlastRawRecordDate } from "../application/records.js";

import express from "express";

const recordsRouter = express.Router();

recordsRouter.get("/", getAllRawRecords);
recordsRouter.post("/create",createRawRecord);
recordsRouter.delete("/:id",deleteRawRecord);
recordsRouter.get("/last",getlastRawRecordDate);



export default recordsRouter;