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

    const flaskRes = await axios.post('https://lazyledger-parser.onrender.com/parse-text', { raw_text, date });
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
    if (error.response) {
      return res.status(500).json({ 
        error: 'Flask service error', 
        details: error.response.data || error.message,
        statusCode: error.response.status 
      });
    } else if (error.request) {
      return res.status(500).json({ 
        error: 'Failed to connect to Flask service', 
        details: 'No response received from parsing service' 
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






