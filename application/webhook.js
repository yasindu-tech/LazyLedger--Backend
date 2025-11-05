import pool from "../infastructure/db.js";

export const webhookHandler = async (req, res) => {
    try {
        // Parse the webhook payload - handle both raw buffer and already parsed JSON
        let event;
        if (Buffer.isBuffer(req.body)) {
            event = JSON.parse(req.body.toString());
        } else if (typeof req.body === 'string') {
            event = JSON.parse(req.body);
        } else {
            event = req.body;
        }
        
        console.log('Received webhook event:', event.type);
        console.log('Event data keys:', Object.keys(event.data || {}));

        if (event.type === 'user.created') {
            const { id, first_name, last_name, email_addresses } = event.data;
            
            // Validate required fields
            if (!id || !email_addresses || !email_addresses[0] || !email_addresses[0].email_address) {
                console.error('Missing required user data:', { id, email_addresses });
                return res.status(400).send('Missing required user data');
            }
            
            // Use upsert so repeated webhooks update the record instead of failing silently.
            // Clerk/third-party IDs are strings (e.g. "user_..."), while our
            // existing `users.user_id` may be an integer primary key. To avoid
            // type errors we store the external ID in `clerk_id` (text).
            // Migration must add clerk_id (text) and a unique index on it.
            const query = `INSERT INTO users (clerk_id, first_name, last_name, email) 
                           VALUES ($1, $2, $3, $4)
                           ON CONFLICT (clerk_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email RETURNING *`;
            const values = [
                id,
                first_name || '',
                last_name || '',
                email_addresses[0].email_address
            ];
            
            try {
                const result = await pool.query(query, values);
                console.log('User upserted successfully:', id, { row: result.rows[0] });
                res.status(200).send('User created/updated successfully');
            } catch (err) {
                console.error('Error inserting/updating user:', {
                    message: err.message,
                    code: err.code,
                    detail: err.detail,
                    hint: err.hint,
                    stack: err.stack,
                    query: query,
                    values: values
                });
                // Return minimal info but include an error code for debugging
                return res.status(500).json({ error: 'Database error', code: err.code, message: err.message });
            }
            
        } else if (event.type === 'user.updated') {
              const { id, first_name, last_name, email_addresses } = event.data;

            // Validate required fields
            if (!id) {
                console.error('Missing user ID for update');
                return res.status(400).send('Missing user ID');
            }

            // Update by clerk_id (external id string)
            const query = `UPDATE users 
                           SET first_name = $1, last_name = $2, email = $3 
                           WHERE clerk_id = $4`;
            const values = [
                first_name || '', 
                last_name || '', 
                email_addresses && email_addresses[0] ? email_addresses[0].email_address : '', 
                id
            ];
            
            try {
                await pool.query(query, values);
                console.log('User updated successfully:', id);
                res.status(200).send('User updated successfully');
            } catch (err) {
                console.error('Error updating user:', err);
                res.status(500).send('Database error');
            }
            
        } else if (event.type === 'user.deleted') {
              const { id } = event.data;

            // Validate required fields
            if (!id) {
                console.error('Missing user ID for deletion');
                return res.status(400).send('Missing user ID');
            }

            // Delete by clerk_id (external id string)
            const query = `DELETE FROM users WHERE clerk_id = $1`;
            const values = [id];
            
            try {
                await pool.query(query, values);
                console.log('User deleted successfully:', id);
                res.status(200).send('User deleted successfully');
            } catch (err) {
                console.error('Error deleting user:', err);
                res.status(500).send('Database error');
            }
            
        } else {
            console.log('Unsupported event type:', event.type);
            res.status(200).send('Event type not handled');
        }
        
    } catch (error) {
        console.error('Error processing webhook:', error);
        console.error('Request body:', req.body);
        res.status(500).send('Internal Server Error');
    }
};