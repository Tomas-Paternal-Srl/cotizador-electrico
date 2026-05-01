export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pedido, catalogo, sinonimos, instrucciones } = req.body;

  if (!pedido || !catalogo) {
    return res.status(400).json({ error: 'Faltan datos: pedido y catalogo son requeridos' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key no configurada en el servidor' });
  }

  const sinStr = sinonimos && sinonimos.length > 0
    ? sinonimos.map(s => `${s[0]} = ${s[1]}`).join(', ')
    : 'ninguno extra cargado';

  const instrStr = instrucciones && instrucciones.trim()
    ? instrucciones.trim()
    : 'ninguna instrucción especial';

  const prompt = `Sos un cotizador experto en materiales eléctricos argentinos con amplio conocimiento del rubro.

CATÁLOGO DE PRECIOS DISPONIBLE:
${catalogo}

SINÓNIMOS ESPECÍFICOS DEL CLIENTE: ${sinStr}

PEDIDO DEL CLIENTE:
${pedido}

REGLAS DE NEGOCIO (seguir siempre):
${instrStr}

INSTRUCCIONES:
- Para cada línea del pedido, identificá el producto, cantidad y unidad
- Buscá el mejor match en el catálogo usando tu conocimiento del rubro eléctrico argentino
- Usá sinónimos conocidos: cupla=unión, cano=caño, térmica=disyuntor=termomagnética, grampa=grapa, corrugado=caño corrugado, codo=curva, tomacorriente=toma=enchufe, etc.
- Ignorá tildes, mayúsculas y variaciones de escritura
- Si hay varios productos similares, elegí el más probable según el contexto
- Asigná confianza ALTA si el match es claro, MEDIA si usaste sinónimo o aproximación, BAJA si no encontraste match bueno
- En "nota" explicá brevemente si usaste sinónimo o por qué dudás

Respondé ÚNICAMENTE con JSON válido, sin texto antes ni después, sin backticks:
{"items":[{"pedido":"texto original del pedido","match":"descripción exacta del producto en el catálogo","codigo":"código/numart del producto","cantidad":1,"unidad":"unidad","precio_unit":0,"subtotal":0,"confianza":"alta|media|baja","nota":"explicación si aplica"}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Error al procesar: ' + err.message });
  }
}
