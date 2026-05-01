import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // GET - verificar cuántos productos hay
  if (req.method === 'GET') {
    try {
      const result = await sql`SELECT COUNT(*) as total FROM catalogo`;
      return res.status(200).json({ total: parseInt(result[0].total) });
    } catch (err) {
      return res.status(200).json({ total: 0 });
    }
  }

  // POST - cargar catálogo
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { productos } = req.body;
  if (!productos || !Array.isArray(productos)) {
    return res.status(400).json({ error: 'Se esperaba array de productos' });
  }

  try {
    // Crear tabla
    await sql`
      CREATE TABLE IF NOT EXISTS catalogo (
        id SERIAL PRIMARY KEY,
        descrip TEXT NOT NULL,
        precio NUMERIC,
        marca TEXT,
        search_text TEXT
      )
    `;

    // Borrar anterior
    await sql`TRUNCATE TABLE catalogo`;

    // Insertar en lotes de 100
    let insertados = 0;
    const lote = 100;
    for (let i = 0; i < productos.length; i += lote) {
      const chunk = productos.slice(i, i + lote);
      for (const p of chunk) {
        const searchText = `${p.descrip} ${p.marca}`.toLowerCase();
        await sql`
          INSERT INTO catalogo (descrip, precio, marca, search_text)
          VALUES (${p.descrip}, ${p.precio}, ${p.marca}, ${searchText})
        `;
        insertados++;
      }
    }

    return res.status(200).json({ ok: true, insertados, mensaje: `Catálogo actualizado con ${insertados} productos` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
