import  pool  from '../infastructure/db.js';
import express from 'express';
import axios from 'axios';

export const getAllRawRecords = async (req,res) => {
    try {
        const query = 'SELECT * FROM raw_entries';
        const result = await pool.query(query);
        return res.status(200).json(result.rows);
    }
    catch (error) {
        console.error('Error fetching raw records:', error);
        return res.status(500).json({ error: 'Failed to fetch raw records', details: error.message });
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

    console.log('Calling Flask service for text parsing...');
    console.log('Flask service URL: https://lazyledger-parser.onrender.com/parse-text');
    console.log('Request payload size:', JSON.stringify({ raw_text, date }).length, 'bytes');
    
    // Call Flask service with extended timeout (2 minutes) to handle cold start
    const flaskRes = await axios.post('https://lazyledger-parser.onrender.com/parse-text', 
      { raw_text, date }, 
      { 
        timeout: 120000, // 2 minutes timeout
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Flask service responded with status:', flaskRes.status);
    console.log('Response data type:', typeof flaskRes.data);
    console.log('Response data preview:', JSON.stringify(flaskRes.data).substring(0, 200));
    if (flaskRes.status !== 200) {
      return res.status(500).json({ error: 'Failed to process text with Flask service' });
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
    
    // Check if it's an axios error (Flask service issue)
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        error: 'Flask service timeout', 
        details: 'The parsing service took too long to respond. This might be due to cold start. Please try again.',
        timeout: true
      });
    } else if (error.response) {
      // Check for rate limiting (429 Too Many Requests)
      if (error.response.status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          details: 'The parsing service is receiving too many requests. Please wait a minute and try again.',
          statusCode: 429,
          rateLimited: true
        });
      }
      
      // Check if we got HTML instead of JSON (502/503 errors from Render)
      const isHtmlResponse = typeof error.response.data === 'string' && 
                            error.response.data.includes('<!DOCTYPE html>');
      
      if (isHtmlResponse) {
        return res.status(503).json({ 
          error: 'Flask service unavailable', 
          details: `The parsing service is currently unavailable (HTTP ${error.response.status}). Please try again in a few minutes.`,
          statusCode: error.response.status,
          serviceDown: true
        });
      } else {
        return res.status(500).json({ 
          error: 'Flask service error', 
          details: error.response.data || error.message,
          statusCode: error.response.status 
        });
      }
    } else if (error.request) {
      return res.status(500).json({ 
        error: 'Failed to connect to Flask service', 
        details: 'No response received from parsing service. The service might be starting up.' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to create raw record', 
        details: error.message 
      });
    }
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
        return res.status(500).json({ 
            error: 'Failed to delete raw record', 
            details: error.message 
        });
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
        return res.status(500).json({ 
            error: 'Failed to fetch last raw record', 
            details: error.message 
        });
    }
}






