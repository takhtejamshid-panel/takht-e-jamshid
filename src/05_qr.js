/* ==========================================================================
   05_qr.js — تولیدکننده QR Code (بدون وابستگی خارجی)
   پیاده‌سازی استاندارد ISO/IEC 18004 · حالت Byte · انتخاب خودکار نسخه و ماسک
   ========================================================================== */

/* تعداد کدواژه‌های تصحیح خطا به‌ازای هر بلوک [نسخه][L,M,Q,H] */
const QR_EC_CW = [ [-1,-1,-1,-1], [7,10,13,17], [10,16,22,28], [15,26,36,44], [20,36,52,64], [26,48,72,88], [36,64,96,112], [40,72,108,130], [48,88,132,156], [60,110,160,192], [72,130,192,224], [80,150,224,264], [96,176,260,308], [104,198,288,352], [120,216,320,384], [132,240,360,432], [144,280,408,480], [168,308,448,532], [180,338,504,588], [196,364,546,650], [224,416,600,700], [224,442,644,750], [252,476,690,816], [270,504,750,900], [300,560,810,960], [312,588,870,1050], [336,644,952,1110], [360,700,1020,1200], [390,728,1050,1260], [420,784,1140,1350], [450,812,1200,1440], [480,868,1290,1530], [510,924,1350,1620], [540,980,1440,1710], [570,1036,1530,1800], [570,1064,1590,1890], [600,1120,1680,1980], [630,1204,1770,2100], [660,1260,1860,2220], [720,1316,1950,2310], [750,1372,2040,2430] ];

/* تعداد بلوک‌های تصحیح خطا [نسخه][L,M,Q,H] */
const QR_EC_BLOCKS = [ [-1,-1,-1,-1], [1,1,1,1], [1,1,1,1], [1,1,2,2], [1,2,2,4], [1,2,4,4], [2,4,4,4], [2,4,6,5], [2,4,6,6], [2,5,8,8], [4,5,8,8], [4,5,8,11], [4,8,10,11], [4,9,12,16], [4,9,16,16], [6,10,12,18], [6,10,17,16], [6,11,16,19], [6,13,18,21], [7,14,21,25], [8,16,20,25], [8,17,23,25], [9,17,23,34], [9,18,25,30], [10,20,27,32], [12,21,29,35], [12,23,34,37], [12,25,34,40], [13,26,35,42], [14,28,38,45], [15,29,40,48], [16,31,43,51], [17,33,45,54], [18,35,48,57], [19,37,51,60], [19,38,53,63], [20,40,56,66], [21,43,59,70], [22,45,62,74], [24,47,65,77], [25,49,68,81] ];

const QR_ECL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
const QR_ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const PENALTY_N1 = 3, PENALTY_N2 = 3, PENALTY_N3 = 40, PENALTY_N4 = 10;

function qrGfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function qrRsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = qrGfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = qrGfMul(root, 0x02);
  }
  return result;
}

function qrRsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let j = 0; j < divisor.length; j++) result[j] ^= qrGfMul(divisor[j], factor);
  }
  return result;
}

function qrRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function qrDataCodewords(ver, eclIdx) {
  // QR_EC_CW تعدادِ کل کدواژه‌های تصحیح خطای آن نسخه است
  return Math.floor(qrRawDataModules(ver) / 8) - QR_EC_CW[ver][eclIdx];
}

function qrCharCountBits(ver) {
  return ver < 10 ? 8 : 16;
}

function qrAlignmentPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const last = ver * 4 + 10;                 // برابر با size - 7
  let step;
  if (ver === 32) {
    step = 26;                               // استثنای استاندارد برای نسخه ۳۲
  } else {
    step = Math.ceil((last - 6) / (numAlign - 1));
    if (step % 2 !== 0) step++;              /* فاصله باید زوج باشد */
  }
  const result = new Array(numAlign);
  result[0] = 6;
  for (let i = numAlign - 1, pos = last; i >= 1; i--, pos -= step) result[i] = pos;
  return result;
}

function getBit(value, i) {
  return ((value >>> i) & 1) !== 0;
}

/**
 * تولید ماتریس QR
 * @returns {{size:number, modules:boolean[][], version:number}}
 */
function qrEncode(text, eclName) {
  const ecl = String(eclName || 'M').toUpperCase();
  const eclIdx = QR_ECL_INDEX[ecl] === undefined ? 1 : QR_ECL_INDEX[ecl];
  const eclBits = QR_ECL_BITS[ecl] === undefined ? 0 : QR_ECL_BITS[ecl];
  const data = new TextEncoder().encode(String(text));

  let version = -1;
  for (let v = 1; v <= 40; v++) {
    const capacity = qrDataCodewords(v, eclIdx) * 8;
    const needed = 4 + qrCharCountBits(v) + data.length * 8;
    if (needed <= capacity) { version = v; break; }
  }
  if (version < 0) throw new Error('QR: داده بیش از حد طولانی است');

  /* --- بیت‌های داده --- */
  const bits = [];
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(4, 4);                              // حالت Byte
  push(data.length, qrCharCountBits(version));
  for (let i = 0; i < data.length; i++) push(data[i], 8);

  const numData = qrDataCodewords(version, eclIdx);
  push(0, Math.min(4, numData * 8 - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < numData * 8; pad ^= 0xec ^ 0x11) push(pad, 8);

  const dataCodewords = new Uint8Array(numData);
  for (let i = 0; i < bits.length; i++) dataCodewords[i >>> 3] |= bits[i] << (7 - (i & 7));

  /* --- کدواژه‌های تصحیح خطا و درهم‌بافی --- */
  const numBlocks = QR_EC_BLOCKS[version][eclIdx];
  const blockEccLen = QR_EC_CW[version][eclIdx] / numBlocks;  // کدواژه به‌ازای هر بلوک
  const rawCodewords = Math.floor(qrRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = qrRsDivisor(blockEccLen);

  const blocks = [];
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const dat = dataCodewords.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    // بلوک همیشه shortBlockLen+1 است؛ بلوک‌های کوتاه یک بایت صفرِ میانی دارند
    const ecc = qrRsRemainder(dat, divisor);
    const blk = Array.from(dat);
    if (i < numShortBlocks) blk.push(0);
    for (let j = 0; j < ecc.length; j++) blk.push(ecc[j]);
    blocks.push(blk);
  }

  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) codewords.push(blocks[j][i]);
    }
  }

  /* --- ساخت ماتریس --- */
  const size = version * 4 + 17;
  const modules = [], isFunc = [];
  for (let i = 0; i < size; i++) {
    modules.push(new Array(size).fill(false));
    isFunc.push(new Array(size).fill(false));
  }
  const setFunc = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark; isFunc[y][x] = true;
  };
  const setAll = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
  };

  // الگوهای زمان‌بندی
  for (let i = 0; i < size; i++) { setFunc(6, i, i % 2 === 0); setFunc(i, 6, i % 2 === 0); }

  // الگوهای یابنده
  const drawFinder = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < size && yy < size) setFunc(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);

  // الگوهای هم‌تراز
  const alignPos = qrAlignmentPositions(version);
  const nAlign = alignPos.length;
  for (let i = 0; i < nAlign; i++) {
    for (let j = 0; j < nAlign; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === nAlign - 1) || (i === nAlign - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunc(alignPos[j] + dx, alignPos[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // بیت‌های قالب (ماسک موقت ۰)
  const drawFormat = (mask) => {
    const d = (eclBits << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fbits = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFunc(8, i, getBit(fbits, i));
    setFunc(8, 7, getBit(fbits, 6));
    setFunc(8, 8, getBit(fbits, 7));
    setFunc(7, 8, getBit(fbits, 8));
    for (let i = 9; i < 15; i++) setFunc(14 - i, 8, getBit(fbits, i));
    for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, getBit(fbits, i));
    for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, getBit(fbits, i));
    setFunc(8, size - 8, true);
  };
  drawFormat(0);

  // بیت‌های نسخه
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(vbits, i);
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFunc(a, b, color); setFunc(b, a, color);
    }
  }

  // قرار دادن داده‌ها به صورت زیگزاگ
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && bi < codewords.length * 8) {
          modules[y][x] = getBit(codewords[bi >>> 3], 7 - (bi & 7));
          bi++;
        }
      }
    }
  }

  /* --- انتخاب بهترین ماسک --- */
  const maskFns = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunc[y][x] && maskFns[mask](x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  const penaltyAddHistory = (run, hist) => {
    let r = run;
    if (hist[0] === 0) r += size;
    hist.pop(); hist.unshift(r);
  };
  const penaltyCount = (hist) => {
    const n = hist[1];
    const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
    return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0)
         + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
  };
  const penaltyTerminate = (color, run, hist) => {
    let r = run;
    if (color) { penaltyAddHistory(r, hist); r = 0; }
    r += size;
    penaltyAddHistory(r, hist);
    return penaltyCount(hist);
  };
  const penaltyScore = () => {
    let result = 0;
    // ردیف‌ها
    for (let y = 0; y < size; y++) {
      let runColor = false, runX = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (modules[y][x] === runColor) {
          runX++;
          if (runX === 5) result += PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          penaltyAddHistory(runX, hist);
          if (!runColor) result += penaltyCount(hist) * PENALTY_N3;
          runColor = modules[y][x]; runX = 1;
        }
      }
      result += penaltyTerminate(runColor, runX, hist) * PENALTY_N3;
    }
    // ستون‌ها
    for (let x = 0; x < size; x++) {
      let runColor = false, runY = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (modules[y][x] === runColor) {
          runY++;
          if (runY === 5) result += PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          penaltyAddHistory(runY, hist);
          if (!runColor) result += penaltyCount(hist) * PENALTY_N3;
          runColor = modules[y][x]; runY = 1;
        }
      }
      result += penaltyTerminate(runColor, runY, hist) * PENALTY_N3;
    }
    // بلوک‌های ۲×۲
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += PENALTY_N2;
      }
    }
    // توازن روشن/تاریک
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
    const total = size * size;
    const kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += kk * PENALTY_N4;
    return result;
  };

  let bestMask = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const score = penaltyScore();
    if (score < bestScore) { bestScore = score; bestMask = m; }
    applyMask(m); // برگرداندن
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return { size, modules, isFunction: isFunc, version, mask: bestMask, ecl };
}

/* خروجی SVG */
function qrToSvg(qr, options) {
  const o = options || {};
  const border = o.border === undefined ? 3 : o.border;
  const dark = o.dark || '#1b1207';
  const light = o.light || 'transparent';
  const dim = qr.size + border * 2;
  let path = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += 'M' + (x + border) + ' ' + (y + border) + 'h1v1h-1z';
    }
  }
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR">';
  if (light !== 'transparent') svg += '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>';
  svg += '<path d="' + path + '" fill="' + dark + '"/></svg>';
  return svg;
}

function qrDataUri(text, options) {
  const qr = qrEncode(text, (options && options.ecl) || 'M');
  const svg = qrToSvg(qr, options);
  return 'data:image/svg+xml;base64,' + b64encode(svg);
}
