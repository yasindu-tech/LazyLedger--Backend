import  pool  from '../infastructure/db.js';


export const getAllTransactions = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Error fetching transactions' });
  }
}

export const createTransaction = async (req, res) => {
  const { user_id, amount, type,category,date } = req.body;

 try {
    const result = await pool.query(
      'INSERT INTO transactions (user_id, amount, type, category, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, amount, type, category, date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: 'Error creating transaction' });
  }
}

export const deleteTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM transactions WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: 'Error deleting transaction' });
  }
}

export const getTransactionById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching transaction:', err);
    res.status(500).json({ error: 'Error fetching transaction' });
  }
}

export const getTransactionsByUserId = async (req, res) => {
    const { user_id } = req.params;
    
    try {
        const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1', [user_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'No transactions found for this user' });
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching transactions by user ID:', err);
        res.status(500).json({ error: 'Error fetching transactions by user ID' });
    }
}

export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { user_id, amount, type, category, date } = req.body;

  try {
    const result = await pool.query(
      'UPDATE transactions SET user_id = $1, amount = $2, type = $3, category = $4, date = $5 WHERE id = $6 RETURNING *',
      [user_id, amount, type, category, date, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: 'Error updating transaction' });
  }
}
