/* ==========================================================================
   07_proxy.js — هسته پروکسی: VLESS و Trojan روی WebSocket
   --------------------------------------------------------------------------
   ساختار بسته‌ی ورودی VLESS:
     | 1 | 16 بایت  | 1      | N      | 1   | 2      | 1    | ...  | داده |
     |ver|   UUID   |addonLen| addon  | cmd | port   | atyp | addr |     |
   ساختار بسته‌ی ورودی Trojan:
     | 56 بایت هگز | CRLF | 1   | 1    | آدرس | 2    | CRLF | داده |
     |  password   |      | cmd | atyp |      | port |      |      |
   ========================================================================== */

const CMD_TCP = 0x01;
const CMD_UDP = 0x02;
const CMD_MUX = 0x03;

/* --------------------------- تحلیلگر سرآیندها --------------------------- */

function hexToUuid(bytes) {
  const h = bytesToHex(bytes);
  return h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12);
}

function parseVlessHeader(buf) {
  if (buf.byteLength < 24) return null;
  if (buf[0] !== 0) return null;
  const uuid = hexToUuid(buf.subarray(1, 17));
  const addonLen = buf[17];
  let idx = 18 + addonLen;
  if (buf.byteLength < idx + 4) return null;
  const cmd = buf[idx];
  const port = (buf[idx + 1] << 8) | buf[idx + 2];
  const atyp = buf[idx + 3];
  idx += 4;
  let address = '';
  if (atyp === 1) {
    if (buf.byteLength < idx + 4) return null;
    address = Array.from(buf.subarray(idx, idx + 4)).join('.');
    idx += 4;
  } else if (atyp === 2) {
    const len = buf[idx];
    idx += 1;
    if (buf.byteLength < idx + len) return null;
    address = new TextDecoder().decode(buf.subarray(idx, idx + len));
    idx += len;
  } else if (atyp === 3) {
    if (buf.byteLength < idx + 16) return null;
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(((buf[idx + i * 2] << 8) | buf[idx + i * 2 + 1]).toString(16));
    }
    address = parts.join(':');
    idx += 16;
  } else {
    return null;
  }
  return { protocol: 'vless', uuid, cmd, port, address, atyp, headerLength: idx, addonLen };
}

function parseTrojanHeader(buf) {
  const MIN = 56 + 2 + 1 + 1 + 2 + 2;
  if (buf.byteLength < MIN) return null;
  // رویِ سیم، ۵۶ نویسه‌ی هگزِ حاصل از SHA-224 فرستاده می‌شود (همان‌طور که هست)
  const password = new TextDecoder().decode(buf.subarray(0, 56));
  if (!/^[0-9a-f]{56}$/.test(password)) return null;
  let idx = 56;
  if (buf[idx] !== 0x0d || buf[idx + 1] !== 0x0a) return null;
  idx += 2;
  const cmd = buf[idx]; idx += 1;
  const atyp = buf[idx]; idx += 1;
  let address = '';
  if (atyp === 1) {
    if (buf.byteLength < idx + 4) return null;
    address = Array.from(buf.subarray(idx, idx + 4)).join('.');
    idx += 4;
  } else if (atyp === 3) {
    const len = buf[idx]; idx += 1;
    if (buf.byteLength < idx + len) return null;
    address = new TextDecoder().decode(buf.subarray(idx, idx + len));
    idx += len;
  } else if (atyp === 4) {
    if (buf.byteLength < idx + 16) return null;
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(((buf[idx + i * 2] << 8) | buf[idx + i * 2 + 1]).toString(16));
    address = parts.join(':');
    idx += 16;
  } else {
    return null;
  }
  const port = (buf[idx] << 8) | buf[idx + 1];
  idx += 2;
  if (buf[idx] !== 0x0d || buf[idx + 1] !== 0x0a) return null;
  idx += 2;
  return { protocol: 'trojan', password, cmd, port, address, atyp, headerLength: idx };
}

function parseInboundHeader(buf) {
  return parseVlessHeader(buf) || parseTrojanHeader(buf);
}

/* ------------------------------ خروجی ------------------------------ */

async function socks5Connect(socket, host, port) {
  const writer = socket.writable.getWriter();
  // پیشنهاد: بدون احراز هویت
  await writer.write(new Uint8Array([0x05, 0x01, 0x00]));
  const reader = socket.readable.getReader();
  const resp = (await reader.read()).value;
  reader.releaseLock();
  if (!resp || resp[0] !== 0x05 || resp[1] !== 0x00) throw new Error('SOCKS5 handshake failed');

  // آدرس مقصد
  const isIP = isIPv4(host);
  const hostBytes = new TextEncoder().encode(host);
  const req = [0x05, 0x01, 0x00, isIP ? 0x01 : 0x03];
  const parts = [new Uint8Array(req)];
  if (isIP) {
    parts.push(new Uint8Array(host.split('.').map(Number)));
  } else {
    parts.push(new Uint8Array([hostBytes.byteLength]));
    parts.push(hostBytes);
  }
  parts.push(new Uint8Array([(port >> 8) & 0xff, port & 0xff]));
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  await writer.write(out);

  const resp2 = (await reader.read()).value;
  if (!resp2 || resp2[1] !== 0x00) throw new Error('SOCKS5 request rejected');
  // خواندن باقیمانده‌ی پاسخ
  try { reader.releaseLock(); } catch (e) { /* آزاد شده */ }
  writer.releaseLock();
  return socket;
}

async function outboundConnect(host, port, settings, originalHeader) {
  if (settings.outMode === 'socks5' && settings.socks5) {
    const m = String(settings.socks5).match(/^(?:([^:@]*)(?::([^@]*))?@)?([^:]+):(\d+)$/);
    if (!m) throw new Error('SOCKS5 نامعتبر');
    const sock = connect({ hostname: m[3], port: Number(m[4]) });
    await sock.opened;
    await socks5Connect(sock, host, port);
    return sock;
  }
  if (settings.outMode === 'proxyip' && settings.proxyIP) {
    // مقصدِ واسط یک سرور VLESS/Trojan است؛ همان سرآیند برایش فرستاده می‌شود
    const m = String(settings.proxyIP).match(/^([^:]+):(\d+)$/);
    if (!m) throw new Error('ProxyIP نامعتبر');
    const sock = connect({ hostname: m[1], port: Number(m[2]) });
    await sock.opened;
    if (originalHeader) {
      const w = sock.writable.getWriter();
      await w.write(originalHeader);
      w.releaseLock();
    }
    return sock;
  }
  const sock = connect({ hostname: host, port: port });
  await sock.opened;
  return sock;
}

/* --------------------------- پرس‌وجوی DNS روی HTTPS --------------------------- */

async function resolveDoH(query, dohUrl) {
  const b64 = b64urlEncode(query);
  const url = dohUrl + '?dns=' + b64;
  const res = await fetch(new Request(url, {
    method: 'GET',
    headers: { accept: 'application/dns-json' },
  }));
  if (!res.ok) throw new Error('DoH failed: ' + res.status);
  const json = await res.json();
  if (!json.Answer || !json.Answer.length) {
    // پاسخ خالی: یک پاسخ با همان شناسه و بدون رکورد
    return buildDnsResponse(query, []);
  }
  return buildDnsResponse(query, json.Answer.map(a => ({ name: a.name, type: a.type, data: a.data })));
}

/* ساخت پاسخ DNS ساده (فقط A و AAAA و CNAME) */
function buildDnsResponse(query, answers) {
  const id = (query[0] << 8) | query[1];
  const body = [];
  // هدر: id, flags(0x8180), qdcount=1, ancount, nscount=0, arcount=0
  const head = new Uint8Array(12);
  head[0] = query[0]; head[1] = query[1];
  head[2] = 0x81; head[3] = 0x80;
  head[4] = 0; head[5] = 1;
  head[6] = (answers.length >> 8) & 0xff; head[7] = answers.length & 0xff;
  head[8] = 0; head[9] = 0; head[10] = 0; head[11] = 0;
  body.push(head);

  // بخش پرسش (تا انتهای نام)
  let idx = 12;
  while (idx < query.length && query[idx] !== 0) idx += query[idx] + 1;
  idx += 1; // بایت صفر پایانی
  body.push(query.subarray(12, idx + 4));

  for (const a of answers) {
    const nameBytes = encodeDnsName(a.name);
    const data = a.data;
    let rdata = null;
    if (a.type === 1 || a.type === 28) {
      if (a.type === 1 && isIPv4(data)) {
        rdata = new Uint8Array(4);
        const p = data.split('.');
        for (let i = 0; i < 4; i++) rdata[i] = Number(p[i]);
      } else if (a.type === 28 && data.indexOf(':') > -1) {
        rdata = new Uint8Array(16);
        const full = expandIPv6(data);
        for (let i = 0; i < 8; i++) {
          rdata[i * 2] = parseInt(full.substr(i * 4, 2), 16);
          rdata[i * 2 + 1] = parseInt(full.substr(i * 4 + 2, 2), 16);
        }
      }
    } else if (a.type === 5) {
      const nb = encodeDnsName(data);
      rdata = nb;
    }
    if (!rdata) continue;
    const rec = new Uint8Array(nameBytes.length + 10 + rdata.length);
    rec.set(nameBytes, 0);
    let o = nameBytes.length;
    rec[o++] = (a.type >> 8) & 0xff; rec[o++] = a.type & 0xff;
    rec[o++] = 0; rec[o++] = 1;      // کلاس IN
    rec[o++] = 0; rec[o++] = 0; rec[o++] = 0; rec[o++] = 60;  // TTL
    rec[o++] = (rdata.length >> 8) & 0xff; rec[o++] = rdata.length & 0xff;
    rec.set(rdata, o);
    body.push(rec);
  }

  let total = 0;
  for (const b of body) total += b.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of body) { out.set(b, off); off += b.length; }
  return out;
}

function encodeDnsName(name) {
  const parts = String(name || '').replace(/\.$/, '').split('.');
  const bytes = [];
  for (const p of parts) {
    const pb = new TextEncoder().encode(p);
    bytes.push(pb.length);
    for (const b of pb) bytes.push(b);
  }
  bytes.push(0);
  return new Uint8Array(bytes);
}

function expandIPv6(addr) {
  let s = String(addr);
  if (s.indexOf('::') > -1) {
    const sides = s.split('::');
    let left = sides[0] ? sides[0].split(':') : [];
    let right = sides[1] ? sides[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const mid = new Array(Math.max(0, missing)).fill('0');
    const all = left.concat(mid, right);
    return all.map(x => String(x || '0').padStart(4, '0')).join('');
  }
  return s.split(':').map(x => String(x || '0').padStart(4, '0')).join('');
}

/* ------------------------- مدیریت اتصال اصلی ------------------------- */

async function handleProxyRequest(request, env, ctx, settings, pathUser) {
  if (settings.killSwitch) {
    return new Response('Kill switch active', { status: 503 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const ws = pair[1];
  ws.accept();

  /* داده‌ی زودهنگام (early data) که کلاینت در هدر Sec-WebSocket-Protocol فرستاده */
  let earlyData = null;
  let earlyProto = '';
  const protoHeader = request.headers.get('sec-websocket-protocol');
  if (protoHeader) {
    const first = protoHeader.split(',')[0].trim();
    earlyProto = first;
    try { earlyData = b64urlDecode(first); } catch (e) { earlyData = null; }
  }

  const state = {
    ws,
    remote: null,
    remoteWriter: null,
    userId: pathUser ? pathUser.id : null,
    user: pathUser || null,
    headerSent: false,
    header: null,
    isUdp: false,
    udpWriter: null,
    closed: false,
    bytesUp: 0,
    bytesDown: 0,
    pending: 0,          /* بایت‌هایی که هنوز به بافر مصرف نرفته‌اند */
  };

  /* شمارش مصرف: در حافظه جمع می‌شود و هر ۶۴ کیلوبایت به بافر D1 منتقل می‌گردد */
  const addBytes = (n) => {
    if (!n) return;
    state.pending += n;
    if (state.pending >= 65536 && state.userId) {
      bufferUsage(state.userId, state.pending);
      state.pending = 0;
      if (ctx && ctx.waitUntil) ctx.waitUntil(flushUsage(env, false));
    }
  };

  const remoteClose = () => {
    if (state.closed) return;
    state.closed = true;
    try { if (state.remote) state.remote.close(); } catch (e) { /* */ }
    try { if (state.remoteWriter) state.remoteWriter.releaseLock(); } catch (e) { /* */ }
    try { ws.close(); } catch (e) { /* */ }
    if (state.userId && state.pending) {
      bufferUsage(state.userId, state.pending);
      if (ctx && ctx.waitUntil) ctx.waitUntil(flushUsage(env, true));
    }
  };

  /* جریان خواندن از WebSocket کلاینت */
  const readable = new ReadableStream({
    start(controller) {
      if (earlyData && earlyData.byteLength) controller.enqueue(earlyData);
      ws.addEventListener('message', (event) => {
        try {
          const data = typeof event.data === 'string' ? new TextEncoder().encode(event.data) : new Uint8Array(event.data);
          controller.enqueue(data);
        } catch (e) { /* سرریز */ }
      });
      ws.addEventListener('close', () => { try { controller.close(); } catch (e) { /* */ } remoteClose(); });
      ws.addEventListener('error', () => { try { controller.error(); } catch (e) { /* */ } remoteClose(); });
    },
    pull() { /* */ },
    cancel() { remoteClose(); },
  });

  const sendToClient = (data) => {
    try {
      if (!state.headerSent) {
        state.headerSent = true;
        if (state.header && state.header.protocol === 'vless') {
          const out = new Uint8Array(data.byteLength + 2);
          out[0] = 0;   // نسخه
          out[1] = 0;   // طول addon
          out.set(data, 2);
          ws.send(out);
          state.bytesDown += out.byteLength;
          addBytes(out.byteLength);
          return;
        }
      }
      ws.send(data);
      state.bytesDown += data.byteLength;
      addBytes(data.byteLength);
    } catch (e) { remoteClose(); }
  };

  const writable = new WritableStream({
    async write(chunk) {
      state.bytesUp += chunk.byteLength;
      addBytes(chunk.byteLength);

      /* حالت UDP: هر بسته با طول ۲ بایتی شروع می‌شود */
      if (state.isUdp && state.udpWriter) {
        return state.udpWriter(chunk);
      }

      /* اگر اتصال برقرار است، فقط عبور بده */
      if (state.remoteWriter) {
        await state.remoteWriter.write(chunk);
        return;
      }

      /* تحلیل سرآیند */
      const header = parseInboundHeader(chunk);
      if (!header) { remoteClose(); return; }

      /* شناسایی و اعتبارسنجی کاربر */
      let user = state.user;
      if (!user) {
        user = header.protocol === 'vless'
          ? await getUserByUuid(env, header.uuid)
          : await getUserByTrojan(env, header.password);
      }
      if (user) {
        if (!user.enabled) { remoteClose(); return; }
        if (user.expireAt && user.expireAt < nowMs()) { remoteClose(); return; }
        if (user.quota > 0 && user.used >= user.quota) { remoteClose(); return; }
        state.user = user;
        state.userId = user.id;
        if (!user.firstUse && settings.startOnFirstUse) {
          if (ctx && ctx.waitUntil) ctx.waitUntil(touchUser(env, user.id));
        }
      } else if (settings.multiUser) {
        remoteClose();  /* کاربر ناشناس پذیرفته نمی‌شود */
        return;
      }

      state.header = header;

      /* مسدودسازی محتوا */
      if ((settings.blockAds || settings.blockPorn) && header.port === 53) {
        // در ادامه، روی پاسخ DNS اعمال می‌شود
      }

      /* UDP */
      const isUdp = (header.protocol === 'vless' && header.cmd === CMD_UDP)
                 || (header.protocol === 'trojan' && header.cmd === CMD_MUX);
      if (isUdp) {
        if (!settings.udp) { remoteClose(); return; }
        state.isUdp = true;
        state.udpWriter = makeUdpWriter(state, settings, sendToClient, remoteClose, chunk, header);
        // پردازش نخستین بسته
        return state.udpWriter(chunk.subarray(header.headerLength));
      }

      if (header.cmd !== CMD_TCP) { remoteClose(); return; }

      /* اتصال به مقصد */
      let socket;
      try {
        socket = await outboundConnect(header.address, header.port, settings, chunk);
      } catch (e) {
        remoteClose();
        return;
      }
      state.remote = socket;
      state.remoteWriter = socket.writable.getWriter();

      /* ارسال داده‌های همراهِ سرآیند */
      const payload = chunk.subarray(header.headerLength);
      if (payload.byteLength) await state.remoteWriter.write(payload);

      /* بازگشت پاسخ به کلاینت */
      socket.readable.pipeTo(new WritableStream({
        write(data) {
          sendToClient(data);
        },
        close() { remoteClose(); },
        abort() { remoteClose(); },
      })).catch(() => remoteClose());
    },
    close() { remoteClose(); },
    abort() { remoteClose(); },
  });

  readable.pipeTo(writable).catch(() => remoteClose());

  /* پژواکِ زیرپروتکل: اگر کلاینت Sec-WebSocket-Protocol فرستاده باشد (مثلاً برای
     early data) و سرور آن را در پاسخ برنگرداند، کلاینت‌های سخت‌گیر — از جمله
     sing-box و برخی نسخه‌های v2rayNG — اتصال را همان‌جا رد می‌کنند و کاربر
     فقط «وصل نمی‌شود» می‌بیند. همان نخستین مقدار را بازمی‌گردانیم. */
  const respHeaders = {};
  if (earlyProto) respHeaders['Sec-WebSocket-Protocol'] = earlyProto;

  return new Response(null, { status: 101, webSocket: client, headers: respHeaders });
}

/* پردازش بسته‌های UDP (در عمل: DNS روی HTTPS) */
function makeUdpWriter(state, settings, sendToClient, remoteClose, firstChunk, header) {
  let buffer = new Uint8Array(0);

  const parsePacket = (data) => {
    if (data.byteLength < 4) return null;
    const len = (data[0] << 8) | data[1];
    if (data.byteLength < len + 2) return null;
    const body = data.subarray(2, 2 + len);
    let idx = 0;
    const atyp = body[idx]; idx += 1;
    let address = '';
    if (atyp === 1) { address = Array.from(body.subarray(idx, idx + 4)).join('.'); idx += 4; }
    else if (atyp === 2 || atyp === 3) {
      const l = body[idx]; idx += 1;
      address = new TextDecoder().decode(body.subarray(idx, idx + l)); idx += l;
    } else if (atyp === 4) {
      const parts = [];
      for (let i = 0; i < 8; i++) parts.push(((body[idx + i * 2] << 8) | body[idx + i * 2 + 1]).toString(16));
      address = parts.join(':'); idx += 16;
    } else return null;
    const port = (body[idx] << 8) | body[idx + 1];
    idx += 2;
    return { address, port, payload: body.subarray(idx), consumed: len + 2 };
  };

  return async (chunk) => {
    const joined = new Uint8Array(buffer.byteLength + chunk.byteLength);
    joined.set(buffer, 0);
    joined.set(chunk, buffer.byteLength);
    buffer = joined;

    while (buffer.byteLength) {
      const pkt = parsePacket(buffer);
      if (!pkt) break;
      buffer = buffer.subarray(pkt.consumed);

      if (pkt.port === 53) {
        try {
          const answer = await resolveDoH(pkt.payload, settings.doh || DEFAULT_SETTINGS.doh);
          const out = new Uint8Array(answer.byteLength + 2);
          out[0] = (answer.byteLength >> 8) & 0xff;
          out[1] = answer.byteLength & 0xff;
          out.set(answer, 2);
          sendToClient(out);
        } catch (e) { /* در صورت خطا، بسته نادیده گرفته می‌شود */ }
      }
      /* ترافیک UDP غیرـDNS روی Workers پشتیبانی نمی‌شود */
    }
  };
}
