import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

// Database connection configuration
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // How long to try to connect before timing out
  maxUses: 7500, // Close and replace a client after it has been used this many times
};

// Create a new pool instance with the configuration
const pool = new Pool(DB_CONFIG);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', {
    errorCode: err.code,
    errorMessage: err.message,
    timestamp: new Date().toISOString(),
    stack: err.stack
  });
  
  // If a client is passed to the event handler, attempt to terminate it
  if (client) {
    client.release(true); // Force release with error
  }
});

// Connection testing and reconnection
const testConnection = async () => {
  let retries = 5;
  let connected = false;
  
  while (retries > 0 && !connected) {
    try {
      const client = await pool.connect();
      console.log('Successfully connected to the database');
      client.release();
      connected = true;
      return true;
    } catch (err) {
      console.error(`Database connection attempt failed (${retries} retries left):`, {
        errorCode: err.code,
        errorMessage: err.message,
        timestamp: new Date().toISOString()
      });
      
      retries--;
      
      if (retries > 0) {
        // Wait before retrying
        console.log(`Waiting 5 seconds before retrying connection...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  if (!connected) {
    console.error('Failed to connect to the database after multiple retries');
    return false;
  }
};

// Initial connection attempt
testConnection()
  .then(success => {
    if (!success) {
      console.warn('Application starting with no database connection');
    }
  })
  .catch(err => {
    console.error('Unexpected error during database connection testing:', err);
  });

// Enhanced query method with automatic reconnection attempts
const enhancedQuery = async (text, params) => {
  let retries = 3;
  
  while (retries > 0) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      // Check if it's a connection error that might benefit from a retry
      if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(err.code) && retries > 1) {
        console.warn(`Database query error (${err.code}), retrying... (${retries-1} attempts left)`);
        retries--;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Unrecoverable error or no more retries, rethrow
        throw err;
      }
    }
  }
};

// Export the enhanced pool with the retry-capable query method
export default {
  ...pool,
  query: enhancedQuery
};
