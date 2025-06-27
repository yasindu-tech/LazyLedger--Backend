import  pool  from '../infastructure/db.js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JWT } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const credentials = JSON.parse(
  readFileSync(path.join(__dirname, '../path-to-service-account.json'))
);
const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/documents.readonly'],
});
const docs = google.docs({ version: 'v1', auth });

function extractDocId(link) {
  const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export const getDocument = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const docLink = result.rows[0].doc_link;
    const docId = extractDocId(docLink);
    console.log('Document ID:', docId);
    if (!docId) return res.status(400).json({ error: 'Invalid document link' });

    const response = await docs.documents.get({ documentId: docId });
    const content = response.data.body.content;

    const lines = content
      .map(el => el.paragraph?.elements?.map(e => e.textRun?.content).join(''))
      .filter(Boolean);

    res.json({ lines });
  } catch (err) {
    console.error('Error fetching doc:', err);
    res.status(500).json({ error: 'Error reading document' });
  }
};
