// Stateful XML-RPC fixture. No network or real Odoo credentials.
export const corporateSchema = Object.fromEntries(Object.entries({
  name: 'char', contact_name: 'char', partner_name: 'char', email_from: 'char',
  phone: 'char', description: 'html', tag_ids: 'many2many', type: 'selection', create_date: 'datetime'
}).map(([name, type]) => [name, { type }]));
const escape = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const decode = x => x.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
function xml(x) {
  if (Array.isArray(x)) return `<value><array><data>${x.map(xml).join('')}</data></array></value>`;
  if (x && typeof x === 'object') return `<value><struct>${Object.entries(x).map(([k, v]) => `<member><name>${k}</name>${xml(v)}</member>`).join('')}</struct></value>`;
  if (typeof x === 'boolean') return `<value><boolean>${x ? 1 : 0}</boolean></value>`;
  return `<value><${typeof x === 'number' ? 'int' : 'string'}>${escape(x ?? '')}</${typeof x === 'number' ? 'int' : 'string'}></value>`;
}
function parseXml(source) {
  const root = { children: [] }, stack = [root];
  for (const token of source.match(/<[^>]+>|[^<]+/g)) {
    if (token.startsWith('<?')) continue;
    if (token.startsWith('</')) stack.pop();
    else if (token.startsWith('<')) {
      const node = { tag: token.slice(1, -1), children: [], text: '' };
      stack.at(-1).children.push(node); stack.push(node);
    } else stack.at(-1).text += token;
  }
  return root.children[0];
}
const child = (node, tag) => node.children.find(x => x.tag === tag);
function value(node) {
  if (node.tag === 'value') return value(node.children[0]);
  if (node.tag === 'array') return child(node, 'data').children.map(value);
  if (node.tag === 'struct') return Object.fromEntries(node.children.map(m => [decode(child(m, 'name').text), value(child(m, 'value'))]));
  if (node.tag === 'boolean') return node.text === '1';
  if (['int', 'i4', 'double'].includes(node.tag)) return Number(node.text);
  return decode(node.text);
}

export function corporateOdoo(options = {}) {
  const records = [], calls = [];
  const state = { records, calls, createDate: '2026-09-18 13:25:42', failCreate: false, loseCreateResponse: false, failWrite: false, loseWriteResponse: false, ...options };
  state.fetch = async (url, init) => {
    if (!String(url).startsWith('https://odoo.example.test/xmlrpc/2/')) throw new Error('External fetch forbidden');
    const tree = parseXml(init.body);
    const params = child(tree, 'params').children.map(p => value(child(p, 'value')));
    const auth = child(tree, 'methodName').text === 'authenticate';
    const [, , , model, method, args, kwargs] = params;
    calls.push({ model: auth ? 'common' : model, method: auth ? 'authenticate' : method, args, kwargs });
    let result;
    if (auth) result = 7;
    else if (model === 'crm.tag' && method === 'search') result = [19];
    else if (model === 'crm.lead' && method === 'fields_get') result = corporateSchema;
    else if (model === 'crm.lead' && method === 'search_read') {
      const tag = args[0].find(x => x[0] === 'tag_ids');
      const text = args[0].find(x => x[0] === 'description');
      if (tag?.[1] !== 'in' || text?.[1] !== 'ilike' || kwargs.context?.active_test !== false) throw new Error('Unsafe search scope');
      result = records.filter(r => r.tag_ids.some(id => tag[2].includes(id)) && r.description.toLowerCase().includes(text[2].toLowerCase())).slice(kwargs.offset, kwargs.offset + kwargs.limit);
    } else if (model === 'crm.lead' && method === 'create') {
      if (state.failCreate) { state.failCreate = false; throw new Error('create failed'); }
      const id = records.length + 1;
      records.push({ ...args[0], id, tag_ids: args[0].tag_ids[0][2], create_date: state.createDate });
      if (state.loseCreateResponse) { state.loseCreateResponse = false; throw new Error('create committed, response lost'); }
      result = id;
    } else if (model === 'crm.lead' && method === 'read') result = records.filter(r => args[0].includes(r.id));
    else if (model === 'crm.lead' && method === 'write') {
      if (Object.keys(args[1]).join() !== 'description') throw new Error('Only description may be updated');
      if (state.failWrite) { state.failWrite = false; throw new Error('write failed'); }
      for (const r of records.filter(r => args[0].includes(r.id))) Object.assign(r, args[1]);
      if (state.loseWriteResponse) { state.loseWriteResponse = false; throw new Error('write committed, response lost'); }
      result = true;
    } else throw new Error(`Unexpected RPC ${model}.${method}`);
    return new Response(`<methodResponse><params><param>${xml(result)}</param></params></methodResponse>`);
  };
  return state;
}
