import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { terminos } = req.body;
  if (!terminos || !Array.isArray(terminos)) {
    return res.status(400).json({ error: 'Se esperaba array de terminos' });
  }

  const client = await pool.connect();

  try {
    const resultados = [];

    for (const termino of terminos) {
      const palabras = termino.toLowerCase()
        .replace(/[^a-záéíóúñ\s]/gi, ' ')
        .split(/\s+/)
        .filter(p => p.length >= 3)
        .slice(0, 5);

      if (palabras.length === 0) continue;

      const rows = new Map();
      for (const palabra of palabras) {
        const r = await client.query(
          `SELECT descrip, precio, marca FROM catalogo WHERE search_text ILIKE $1 LIMIT 25`,
          [`%${palabra}%`]
        );
        for (const row of r.rows) {
          if (!rows.has(row.descrip)) {
            let score = 0;
            const d = row.descrip.toLowerCase();
            for (const p of palabras) { if (d.includes(p)) score++; }
            rows.set(row.descrip, { ...row, score });
          }
        }
      }

      const top = Array.from(rows.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      resultados.push({ termino, productos: top });
    }

    client.release();
    return res.status(200).json({ resultados });

  } catch (err) {
    client.release();
    return res.status(500).json({ error: err.message });
  }
}
