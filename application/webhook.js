import pool from "../infastructure/db.js";
export const webhookHandler = (req, res) => {
    try {
        const event = JSON.parse(req.body.toString());

        if(event.type === 'user.created') {
            const { id, first_name, last_name, email_addresses} = event.data;
            
            const query = `INSERT INTO users (user_id, first_name, last_name, email) 
                           VALUES ($1, $2, $3, $4)
                           ON CONFLICT (user_id) DO NOTHING`;
            const values = [id, first_name, last_name, email_addresses[0].email_address];
            pool.query(query, values)
                .then(() => {
                    res.status(200).send('User created successfully');
                })
                .catch(err => {
                    console.error('Error inserting user:', err);
                    res.status(500).send('Internal Server Error');
                });
            
        }if(event.type === 'user.updated') {
            const { id, first_name, last_name, email_addresses } = event.data;

            const query = `UPDATE users 
                           SET first_name = $1, last_name = $2, email = $3 
                           WHERE user_id = $4`;
            const values = [first_name, last_name, email_addresses[0].email_address, id];
            pool.query(query, values)
                .then(() => {
                    res.status(200).send('User updated successfully');
                })
                .catch(err => {
                    console.error('Error updating user:', err);
                    res.status(500).send('Internal Server Error');
                });
        }if(event.type === 'user.deleted') {
            const { id } = event.data;

            const query = `DELETE FROM users WHERE user_id = $1`;
            const values = [id];
            pool.query(query, values)
                .then(() => {
                    res.status(200).send('User deleted successfully');
                })
                .catch(err => {
                    console.error('Error deleting user:', err);
                    res.status(500).send('Internal Server Error');
                });
        }   
        else {
            res.status(400).send('Unsupported event type');
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal Server Error');
    }
};