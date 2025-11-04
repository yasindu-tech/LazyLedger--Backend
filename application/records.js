import  pool  from '../infastructure/db.js';
import { postToFlaskWithRetry, axiosErrorInfo } from './flaskClient.js';
import crypto from 'crypto';

// flask client helpers are in ./flaskClient.js so importing this file doesn't pull DB code into callers
export const getAllRawRecords = async (req,res) => {
    try {
        const query = 'SELECT * FROM raw_entries';
        const result = await pool.query(query);
        return res.status(200).json(result.rows);
    }
    catch (error) {
        console.error('Error fetching raw records:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}


export const createRawRecord = async (req, res) => {
  const { user_id, date, raw_text } = req.body;

  if (!user_id || !date || !raw_text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const rawInsert = await pool.query(
      'INSERT INTO raw_entries (user_id, date, raw_text) VALUES ($1, $2, $3) RETURNING *',
      [user_id, date, raw_text]
    );
    const rawEntry = rawInsert.rows[0];

    // Generate a request id for tracing through services
    const reqId = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + '-' + Math.random().toString(36).slice(2,8));
    let flaskRes;
    try {
      flaskRes = await postToFlaskWithRetry('/parse-text', { raw_text, date }, { maxRetries: 4, baseDelay: 500, timeout: 60000, headers: { 'X-Request-Id': reqId } });
    } catch (err) {
      // log the full axios error info plus our request id for correlation
      console.error('Final failure calling Flask service:', { reqId, info: axiosErrorInfo(err) });
      // Return a clear status to the client with a request id they can quote when reporting
      return res.status(502).json({ error: 'Connection to Flask service failed', request_id: reqId });
    }

    if (flaskRes.status !== 200) {
      console.error('Flask returned non-200:', { status: flaskRes.status, data: flaskRes.data, reqId });
      return res.status(502).json({ error: 'Flask service returned an error', request_id: reqId });
    }

    const parsedTransactions = flaskRes.data;

    if (!Array.isArray(parsedTransactions) || parsedTransactions.length === 0) {
      return res.status(400).json({ error: 'No transactions found in the raw text' });
    }

    const savedTransactions = [];

    for (const transaction of parsedTransactions) {
      const { amount, type, category, date: txnDate } = transaction;

      if (!amount || !type || !category || !txnDate) {
        continue;
      }

      try {
        const insertQuery = `
          INSERT INTO transactions (user_id, amount, type, category, date)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *`;
        const insertValues = [user_id, amount, type.toUpperCase(), category, txnDate];
        const txnResult = await pool.query(insertQuery, insertValues);
        savedTransactions.push(txnResult.rows[0]);
      } catch (err) {
        console.error('DB insert error:', { transaction, err });
      }
    }

    return res.status(201).json({
      message: 'Raw record and transactions saved successfully',
      raw_entry: rawEntry,
      transactions: savedTransactions,
    });

  } catch (error) {
    console.error('Error creating raw record:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteRawRecord = async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM raw_entries WHERE entry_id = $1 RETURNING *';
        const values = [id];
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        return res.status(200).json({ message: 'Record deleted successfully' });
    } catch (error) {
        console.error('Error deleting raw record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getlastRawRecordDate = async (req, res) => {
    try {
        const query = 'SELECT * FROM raw_entries ORDER BY entry_id DESC LIMIT 1';
        const result = await pool.query(query);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'No records found' });
        }   
        return res.status(200).json(result.rows[0].timestamp);
    } catch (error) {
        console.error('Error fetching last raw record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}






