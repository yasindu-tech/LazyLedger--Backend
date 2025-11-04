import axios from 'axios';

const nodeBase = process.env.NODE_BASE || 'http://localhost:3000';
const flaskBase = process.env.FLASK_BASE || 'http://localhost:5000';

async function test() {
  try {
    console.log('Testing Flask create endpoint...');
    const flaskRes = await axios.post(`${flaskBase}/raw-records/create`, {
      user_id: 1,
      date: new Date().toISOString().slice(0,10),
      raw_text: 'coffee 5.50\nsalary 2000'
    }, { timeout: 20000 });
    console.log('Flask response:', flaskRes.status, flaskRes.data);
  } catch (err) {
    console.error('Flask test failed:', err.response?.status, err.response?.data || err.message);
  }

  try {
    console.log('Testing Node (proxy) create endpoint...');
    const nodeRes = await axios.post(`${nodeBase}/api/records/create`, {
      user_id: 1,
      date: new Date().toISOString().slice(0,10),
      raw_text: 'tea 2.50\nfreelance 500'
    }, { timeout: 20000 });
    console.log('Node response:', nodeRes.status, nodeRes.data);
  } catch (err) {
    console.error('Node test failed:', err.response?.status, err.response?.data || err.message);
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
