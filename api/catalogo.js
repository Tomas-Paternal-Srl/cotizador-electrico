import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const client = await pool.connect();
  
  if (req.method === 'GET') {
    try {
      const result = await client.query('SELECT COUNT(*) as total FROM catalogo');
      client.release();
      return res.status(200).json({ total: parseInt(result.rows[0].total) });
    } catch (err) {
      client.release();
      return res.status(200).json({ total: 0 });
    }
  }

  if (req.method !== 'POST') {
    client.release();
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { productos } = req.body;
  if (!productos || !Array.isArray(productos)) {
    client.release();
    return res.status(400).json({ error: 'Se esperaba array de productos' });
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS catalogo (
        id SERIAL PRIMARY KEY,
        descrip TEXT NOT NULL,
        precio NUMERIC,
        marca TEXT,
        search_text TEXT
      )
    `);

    await client.query('TRUNCATE TABLE catalogo');

    for (const p of productos) {
      const searchText = `${p.descrip} ${p.marca}`.toLowerCase();
      await client.query(
        'INSERT INTO catalogo (descrip, precio, marca, search_text) VALUES ($1, $2, $3, $4)',
        [p.descrip, p.precio, p.marca, searchText]
      );
    }

    client.release();
    return res.status(200).json({ ok: true, insertados: productos.length, mensaje: `Catálogo actualizado con ${productos.length} productos` });

  } catch (err) {
    client.release();
    return res.status(500).json({ error: err.message });
  }
}
