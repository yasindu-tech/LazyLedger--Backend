import { createTransaction,getAllTransactions,getTransactionById,getTransactionsByUserId,deleteTransaction,updateTransaction } from "../application/transactions.js";

import express from "express";

const transactionsRouter = express.Router();

transactionsRouter.get("/", getAllTransactions);
transactionsRouter.post("/create", createTransaction);
transactionsRouter.get("/:id", getTransactionById);
transactionsRouter.get("/user/:user_id", getTransactionsByUserId);
transactionsRouter.delete("/:id", deleteTransaction);
transactionsRouter.put("/:id", updateTransaction);

export default transactionsRouter;
