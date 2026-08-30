/* بیرون‌کشیدنِ کانفیگ‌های واقعی برای بازرسی */
const path = require('path');
const { Miniflare } = require('miniflare');

(async () => {
  const mf = new Miniflare({
    scriptPath: path.join(__dirname, '..', '_worker.js'),
    modules: true,
    compatibilityDate: '2024-09-23',
    d1Databases: { DB: 'preview' },
  });
  const B = 'http://panel.test';
  const req = (p, init) => mf.dispatchFetch(B + p, Object.assign({ redirect: 'manual' }, init || {}));

  const r = await req('/takht/login', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'user=admin&pass=admin',
  });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const auth = (p, i) => req(p, Object.assign({}, i, { headers: Object.assign({ cookie }, (i && i.headers) || {}) }));

  await auth('/takht/dash');
  const st = await (await auth('/takht/api/state')).json();
  const u = st.users[0];
  console.log('کلیدهای آبجکتِ کاربر:', Object.keys(u).join(', '));
  console.log(JSON.stringify(u, null, 2).slice(0, 900));
  const linkRes = await (await auth('/takht/api/link/' + u.id)).json();
  console.log('لینک از API:', linkRes.url);
  const SUB = String(linkRes.url || '').replace(B, '').replace('/takht/sub/', '');
  if (!SUB) { console.error('ناتوان در یافتنِ توکنِ اشتراک'); process.exit(1); }

  for (const f of ['', '?format=raw', '?format=clash', '?format=singbox']) {
    const res = await req('/takht/sub/' + SUB + f);
    const body = await res.text();
    console.log('\n' + '='.repeat(70));
    console.log('فرمت: ' + (f || 'پیش‌فرض(base64)') + '   content-type: ' + res.headers.get('content-type'));
    console.log('='.repeat(70));
    if (f === '?format=raw') { console.log(body); }
    else if (f === '' ) {
      let dec = '';
      try { dec = Buffer.from(body, 'base64').toString('utf8'); } catch (e) { dec = '(خطا در دیکد) ' + e.message; }
      console.log(dec);
    } else {
      console.log(body.slice(0, 3000));
    }
  }
  console.log('\n' + '='.repeat(70));
  console.log('تنظیماتِ مرتبط:');
  console.log('  host   :', st.settings.host || '(خالی = خودکار)');
  console.log('  route  :', st.settings.route);
  console.log('  ports  :', JSON.stringify(st.settings.ports));
  console.log('  sni    :', st.settings.sni || '(خالی = host)');
  console.log('  cleanIPs:', JSON.stringify(st.settings.cleanIPs));
  console.log('  tls    :', st.settings.tls, '| ech:', st.settings.ech);
  console.log('  naming :', st.settings.naming);
  await mf.dispose();
})().catch(e => { console.error(e); process.exit(1); });
