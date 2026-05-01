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

  const prompt = `Cotizador eléctrico argentino. El catálogo tiene formato: descripcion|precio|marca

CATÁLOGO:
${catalogo}

SINÓNIMOS: ${sinStr}
REGLAS: ${instrStr}

PEDIDO:
${pedido}

Sinónimos comunes: cupla=union, cano=corrugado, termica=termomag, grampa=grapa, codo=curva, toma=tomacorriente.
Ignorá tildes y mayúsculas. Aplicá las reglas de negocio para elegir marca cuando corresponda.

JSON sin texto extra ni backticks:
{"items":[{"pedido":"linea original","match":"descripcion del catalogo","cantidad":1,"unidad":"u","precio_unit":0,"subtotal":0,"confianza":"alta|media|baja","nota":""}]}`;

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
        max_tokens: 8000,
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
