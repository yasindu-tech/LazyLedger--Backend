import { getDocument } from "../application/user.js";
import express from "express";

const userRouter = express.Router();


userRouter.get("/:id", getDocument);


export default userRouter;