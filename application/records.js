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
    // Proxy the create request to Flask which will handle inserting raw_entries and transactions
    const reqId = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + '-' + Math.random().toString(36).slice(2,8));
    let flaskRes;
    try {
      flaskRes = await postToFlaskWithRetry('/raw-records/create', { user_id, date, raw_text }, { maxRetries: 4, baseDelay: 500, timeout: 60000, headers: { 'X-Request-Id': reqId } });
    } catch (err) {
      console.error('Final failure calling Flask create endpoint:', { reqId, info: axiosErrorInfo(err) });
      return res.status(502).json({ error: 'Connection to Flask service failed', request_id: reqId });
    }

    // Forward Flask's response status and body
    return res.status(flaskRes.status).json(flaskRes.data);

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






