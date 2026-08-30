/* ==========================================================================
   04_config.js — تولید کانفیگ برای کلاینت‌های مختلف
   VLESS · Trojan · Clash · Sing-box · Base64
   ========================================================================== */

/* قالب نام نود: متغیرهای {NAME} {PROTO} {HOST} {IP} {CITY} {FLAG} {NUM} {DATE} */
function applyNaming(template, ctx) {
  let out = String(template || '{FLAG} {CITY} · {NUM}');
  const map = {
    '{NAME}': ctx.name || '',
    '{PROTO}': ctx.proto || '',
    '{HOST}': ctx.host || '',
    '{IP}': ctx.ip || ctx.host || '',
    '{CITY}': ctx.city || '',
    '{COUNTRY}': ctx.country || ctx.city || '',
    '{FLAG}': ctx.flag || '🏛️',
    '{NUM}': String(ctx.num === undefined ? 1 : ctx.num),
    '{DATE}': formatDate(Date.now(), 'fa'),
    '{USER}': ctx.name || '',
  };
  for (const k of Object.keys(map)) out = out.split(k).join(map[k]);
  return out.replace(/\s+/g, ' ').trim();
}

/* پارس کردن یک خط IP تمیز: "1.1.1.1#آلمان" یا "1.1.1.1" */
function parseCleanIPs(list) {
  const arr = Array.isArray(list) ? list : splitLines(list);
  return arr.map((item, i) => {
    if (typeof item === 'object' && item) return { ip: item.ip, name: item.name || item.ip, country: item.country || '' };
    const s = String(item).trim();
    const hash = s.indexOf('#');
    if (hash > -1) {
      const meta = s.slice(hash + 1).trim();
      const parts = meta.split(/[,\-–]/).map(x => x.trim()).filter(Boolean);
      return {
        ip: s.slice(0, hash).trim(),
        name: parts[parts.length - 1] || meta,
        country: parts[0] || '',
      };
    }
    return { ip: s, name: s, country: '' };
  }).filter(x => isValidHost(x.ip));
}

function flagOf(country) {
  if (!country) return '🏛️';
  const c = String(country).trim();
  if (FLAGS[c]) return FLAGS[c];
  // تلاش برای نام کشور انگلیسی
  const lower = c.toLowerCase();
  const found = Object.keys(FLAGS).find(k => k.toLowerCase() === lower);
  return found ? FLAGS[found] : '🏛️';
}

/* پورت‌هایی که کلادفلر روی آن‌ها فقط HTTPِ ساده می‌دهد (بدون TLS).
   فرستادنِ دست‌تکانیِ TLS روی این پورت‌ها شکستِ کاملِ اتصال است —
   کلاینت «کانفیگ کار نمی‌کند» می‌بیند، بی‌آنکه علت روشن باشد.

   منبع: مستنداتِ کلادفلر (Network ports compatible with Cloudflare's proxy)
     HTTP  : 80, 8080, 8880, 2052, 2082, 2086, 2095
     HTTPS : 443, 2053, 2083, 2087, 2096, 8443
*/
const CF_PLAIN_PORTS = [80, 8080, 8880, 2052, 2082, 2086, 2095];

/* آیا این پورت توانِ TLS دارد؟ پورت‌های ناشناس را به انتخابِ کاربر می‌سپاریم. */
function portSupportsTls(port) {
  return CF_PLAIN_PORTS.indexOf(Number(port)) < 0;
}

function buildPath(settings, userId) {
  const base = '/' + String(settings.route || 'takht').replace(/^\/+|\/+$/g, '');
  const suffix = userId ? '/' + encodeURIComponent(userId) : '';
  return base + suffix + '?ed=2048';
}

/* ساخت لینک VLESS */
function buildVlessLink(opts) {
  const o = opts || {};
  const q = [];
  q.push('encryption=none');
  q.push('security=' + (o.tls ? 'tls' : 'none'));
  if (o.tls) {
    if (o.sni) q.push('sni=' + encodeURIComponent(o.sni));
    q.push('fp=randomized');
    q.push('alpn=' + encodeURIComponent('http/1.1'));
    if (o.allowInsecure) q.push('allowInsecure=1');
  }
  q.push('type=ws');
  if (o.hostHeader) q.push('host=' + encodeURIComponent(o.hostHeader));
  q.push('path=' + encodeURIComponent(o.path || '/'));
  if (o.fragment) q.push('fragment=' + o.fragment);
  const name = encodeURIComponent(o.name || PANEL_FA);
  return 'vless://' + o.uuid + '@' + o.address + ':' + o.port + '?' + q.join('&') + '#' + name;
}

/* ساخت لینک Trojan */
function buildTrojanLink(opts) {
  const o = opts || {};
  const q = [];
  q.push('security=' + (o.tls ? 'tls' : 'none'));
  if (o.tls) {
    if (o.sni) q.push('sni=' + encodeURIComponent(o.sni));
    q.push('fp=randomized');
    q.push('alpn=' + encodeURIComponent('http/1.1'));
    if (o.allowInsecure) q.push('allowInsecure=1');
  }
  q.push('type=ws');
  if (o.hostHeader) q.push('host=' + encodeURIComponent(o.hostHeader));
  q.push('path=' + encodeURIComponent(o.path || '/'));
  const name = encodeURIComponent(o.name || PANEL_FA);
  return 'trojan://' + encodeURIComponent(o.password) + '@' + o.address + ':' + o.port + '?' + q.join('&') + '#' + name;
}

/* لیست نودها برای یک کاربر */
function buildNodesForUser(user, settings, hostInfo) {
  const nodes = [];
  const protos = settings.protocol === 'both' ? ['vless', 'trojan'] : [settings.protocol];
  const ports = Array.isArray(settings.ports) && settings.ports.length ? settings.ports : [443];
  const cleanIPs = parseCleanIPs(settings.cleanIPs);
  const baseHost = normalizeHost(settings.host) || hostInfo.host;
  const sni = normalizeHost(settings.sni) || baseHost;
  const path = buildPath(settings, settings.multiUser ? user.token : '');
  const frag = settings.fragment && settings.fragment.enabled
    ? settings.fragment.length + ',' + settings.fragment.interval + ',tlshello'
    : '';

  // حالت پیش‌فرض: اتصال به هاست اصلی روی پورت‌های منتخب
  const targets = cleanIPs.length
    ? cleanIPs.map(c => ({ address: c.ip, city: c.name, country: c.country, sni }))
    : [{ address: baseHost, city: baseHost, country: '', sni }];

  let num = 1;
  for (const target of targets) {
    // برای IP تمیز هر بار یک پورت چرخشی؛ برای هاست اصلی، همه پورت‌ها
    const portList = cleanIPs.length ? [ports[(num - 1) % ports.length]] : ports;
    for (const port of portList) {
      for (const proto of protos) {
        const ctx = {
          name: user.name,
          proto: proto === 'vless' ? 'VLESS' : 'Trojan',
          host: baseHost,
          ip: target.address,
          city: target.city,
          country: target.country,
          flag: flagOf(target.country),
          num,
        };
        const name = applyNaming(settings.naming, ctx);
        const common = {
          address: target.address,
          port: Number(port),
          /* TLS را برای هر پورت جداگانه حساب می‌کنیم: پورت ۸۰ روی کلادفلر
             فقط HTTPِ ساده است و نوشتنِ security=tls برایش نودِ همیشه‌خراب می‌سازد. */
          tls: !!settings.tls && portSupportsTls(port),
          sni: target.sni,
          allowInsecure: !!settings.allowInsecure,
          hostHeader: baseHost,
          path,
          name,
          fragment: frag,
          ech: !!settings.ech,
        };
        if (proto === 'vless') {
          nodes.push(Object.assign({ kind: 'vless', uuid: user.uuid }, common));
        } else {
          nodes.push(Object.assign({ kind: 'trojan', password: user.trojanPass || user.uuid, uuid: user.uuid }, common));
        }
        num++;
      }
    }
  }
  return nodes;
}

function nodeToLink(node) {
  return node.kind === 'vless'
    ? buildVlessLink(node)
    : buildTrojanLink(Object.assign({}, node, { password: node.password || node.uuid }));
}

/* ------------------------------- Clash ------------------------------- */

function clashNode(node) {
  const wsOpts = [
    '      path: "' + (node.path || '/') + '"',
    '      headers:',
    '        Host: "' + (node.hostHeader || '') + '"',
  ];
  if (node.kind === 'vless') {
    return [
      '  - name: "' + String(node.name).replace(/"/g, '\\"') + '"',
      '    type: vless',
      '    server: ' + node.address,
      '    port: ' + node.port,
      '    uuid: ' + node.uuid,
      '    network: ws',
      '    tls: ' + (node.tls ? 'true' : 'false'),
      node.tls ? '    servername: ' + node.sni : null,
      node.tls ? '    client-fingerprint: randomized' : null,
      node.allowInsecure ? '    skip-cert-verify: true' : '    skip-cert-verify: false',
      '    udp: true',
      '    ws-opts:',
    ].concat(wsOpts).filter(Boolean).join('\n');
  }
  return [
    '  - name: "' + String(node.name).replace(/"/g, '\\"') + '"',
    '    type: trojan',
    '    server: ' + node.address,
    '    port: ' + node.port,
    '    password: "' + String(node.password || node.uuid).replace(/"/g, '\\"') + '"',
    '    network: ws',
    '    tls: ' + (node.tls ? 'true' : 'false'),
    node.tls ? '    servername: ' + node.sni : null,
    node.tls ? '    client-fingerprint: randomized' : null,
    node.allowInsecure ? '    skip-cert-verify: true' : '    skip-cert-verify: false',
    '    udp: true',
    '    ws-opts:',
  ].concat(wsOpts).filter(Boolean).join('\n');
}

function buildClashConfig(nodes, settings) {
  const names = nodes.map(n => '"' + String(n.name).replace(/"/g, '\\"') + '"');
  const groups = [
    'proxy-groups:',
    '  - name: "🏛️ ' + PANEL_FA + '"',
    '    type: select',
    '    proxies:',
  ].concat(names.map(n => '      - ' + n)).join('\n');

  const fallbacks = [
    '  - name: "⚡ Auto"',
    '    type: url-test',
    '    url: "https://www.gstatic.com/generate_204"',
    '    interval: 300',
    '    tolerance: 50',
    '    proxies:',
  ].concat(names.map(n => '      - ' + n)).join('\n');

  const rules = [
    'rules:',
    '  - MATCH,🏛️ ' + PANEL_FA,
  ].join('\n');

  const head = [
    '# تخت جمشید — generated by Takht-e Jamshid v' + VERSION,
    'port: 7890',
    'socks-port: 7891',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'external-controller: 127.0.0.1:9090',
    'dns:',
    '  enable: true',
    '  enhanced-mode: fake-ip',
    '  nameserver:',
    '    - https://1.1.1.1/dns-query',
    '    - https://8.8.8.8/dns-query',
    'proxies:',
  ].join('\n');

  return head + '\n' + nodes.map(clashNode).join('\n') + '\n' + groups + '\n' + fallbacks + '\n' + rules + '\n';
}

/* ----------------------------- Sing-box ----------------------------- */

function buildSingboxConfig(nodes, settings) {
  const outbounds = nodes.map((n, i) => {
    const base = {
      type: n.kind === 'vless' ? 'vless' : 'trojan',
      tag: n.name + ' ' + (i + 1),
      server: n.address,
      server_port: Number(n.port),
      transport: {
        type: 'ws',
        path: n.path || '/',
        headers: { Host: n.hostHeader || '' },
        max_early_data: 2048,
        early_data_header_name: 'Sec-WebSocket-Protocol',
      },
    };
    if (n.kind === 'vless') {
      base.uuid = n.uuid;
      base.packet_encoding = 'xudp';
    } else {
      base.password = n.password || n.uuid;
    }
    if (n.tls) {
      base.tls = {
        enabled: true,
        server_name: n.sni,
        insecure: !!n.allowInsecure,
        utls: { enabled: true, fingerprint: 'randomized' },
        alpn: ['http/1.1'],
      };
      // ECH (Encrypted Client Hello) — پشتیبانی در کلاینت‌های Sing-box
      if (n.ech) base.tls.ech = { enabled: true };
    }
    return base;
  });

  const tags = outbounds.map(o => o.tag);

  return JSON.stringify({
    log: { level: 'info' },
    dns: {
      servers: [{ tag: 'cf', address: 'https://1.1.1.1/dns-query' }],
    },
    outbounds: outbounds.concat([
      { type: 'selector', tag: 'select', outbounds: tags },
      { type: 'urltest', tag: 'auto', outbounds: tags, url: 'https://www.gstatic.com/generate_204', interval: '5m' },
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
    ]),
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { clash_mode: 'direct', outbound: 'direct' },
        { clash_mode: 'global', outbound: 'select' },
      ],
      final: 'select',
      auto_detect_interface: true,
    },
  }, null, 2);
}

/* ------------------------- خروجی اشتراک ------------------------- */

function buildSubscription(user, settings, hostInfo, format) {
  const nodes = buildNodesForUser(user, settings, hostInfo);
  const fmt = String(format || 'auto').toLowerCase();

  if (fmt === 'clash' || fmt === 'clash-meta') {
    return { body: buildClashConfig(nodes, settings), type: 'text/yaml; charset=utf-8', count: nodes.length };
  }
  if (fmt === 'singbox' || fmt === 'sing-box' || fmt === 'sb') {
    return { body: buildSingboxConfig(nodes, settings), type: 'application/json; charset=utf-8', count: nodes.length };
  }
  if (fmt === 'raw' || fmt === 'plain') {
    return { body: nodes.map(nodeToLink).join('\n'), type: 'text/plain; charset=utf-8', count: nodes.length };
  }
  const raw = nodes.map(nodeToLink).join('\n');
  return { body: b64encode(raw), type: 'text/plain; charset=utf-8', count: nodes.length };
}

/* اطلاعات هدر subscription-info (مصرف/انقضا) برای کلاینت‌ها */
function buildSubHeaders(user) {
  const total = user.quota || 0;
  const used = user.used || 0;
  const left = Math.max(0, total - used);
  const expire = user.expireAt ? Math.floor(user.expireAt / 1000) : 0;
  return {
    'subscription-userinfo': 'upload=0; download=' + used + '; total=' + total + '; expire=' + expire,
    'profile-update-interval': '12',
    'profile-title': 'base64:' + b64encode(PANEL_FA + ' | ' + user.name),
  };
}
