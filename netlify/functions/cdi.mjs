// Busca o CDI anualizado (série 4389 do Banco Central) pelo servidor,
// para a página não depender de o navegador conseguir acessar a API do BC.
const API = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json';

export default async () => {
  try {
    const r = await fetch(API, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const it = (await r.json()).at(-1);
    const valor = parseFloat(it.valor);
    const [d, m, y] = it.data.split('/');
    if (!(valor > 0)) throw new Error('valor inválido');
    return Response.json(
      { valor, data: `${y}-${m}-${d}`, fonte: 'Banco Central do Brasil, SGS 4389' },
      { headers: {
          'cache-control': 'public, max-age=3600',
          'netlify-cdn-cache-control': 'public, s-maxage=21600, stale-while-revalidate=86400'
      } }
    );
  } catch (e) {
    return Response.json({ erro: 'indisponível' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
};

export const config = { path: '/api/cdi' };
