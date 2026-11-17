import { ExactDecimal } from './decimal';
import { Fraction, gcdBigInt } from './fraction';

export class LoiBPT extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoiBPT';
  }
}

export interface ColorDef {
  label: string;
  tikz: string;
  rgb: readonly [number, number, number];
}

export const BANG_MAU: readonly ColorDef[] = [
  { label: 'Black', tikz: 'black', rgb: [0, 0, 0] },
  { label: 'Cyan', tikz: 'cyan', rgb: [0, 255, 255] },
  { label: 'Green', tikz: 'green', rgb: [0, 255, 0] },
  { label: 'Blue', tikz: 'blue', rgb: [0, 0, 255] },
  { label: 'Gray', tikz: 'gray', rgb: [128, 128, 128] },
  { label: 'Orange', tikz: 'orange', rgb: [255, 128, 0] },
  { label: 'Purple', tikz: 'purple', rgb: [191, 0, 64] },
  { label: 'Teal', tikz: 'teal', rgb: [0, 128, 128] },
  { label: 'Magenta', tikz: 'magenta', rgb: [255, 0, 255] },
];

export const MAU_RGB: Record<string, readonly [number, number, number]> = Object.fromEntries(
  BANG_MAU.map((m) => [m.tikz, m.rgb])
);

export const MAX_VACH = 60;
export const KICH_THUOC_HINH = 6.0;
export const CM_MOI_PT = 2.54 / 72.27;
export const VI_TRI_NHAN = [0.75, 0.25, 0.6, 0.4] as const;
export const BAN_KINH_BAT = 12.0;
export const CHU_CAI_DIEM = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';
export const BK_NHAN_PT = 7.0;
export const SO_DIEM_TOI_DA = 2;
export const SO_THAP_PHAN = 2;
export const LENH_PHAN_SO = '\\frac';

export type Dang = [Fraction, Fraction, Fraction]; // (a, b, c) ~ a*x + b*y + c

type TokenType = 'num' | 'var' | '+' | '-' | '*' | '/' | '(' | ')';
type Token = [TokenType, string];

function _tach_token(s: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) {
        j++;
      }
      toks.push(['num', s.slice(i, j)]);
      i = j;
    } else if (ch === 'x' || ch === 'y' || ch === 'X' || ch === 'Y') {
      toks.push(['var', ch.toLowerCase()]);
      i++;
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      toks.push([ch, ch]);
      i++;
    } else {
      throw new LoiBPT(`Ký tự không hợp lệ: '${ch}'`);
    }
  }
  return toks;
}

function _cong(p: Dang, q: Dang): Dang {
  return [p[0].add(q[0]), p[1].add(q[1]), p[2].add(q[2])];
}

function _nhan_hang(p: Dang, k: Fraction): Dang {
  return [p[0].mul(k), p[1].mul(k), p[2].mul(k)];
}

function _la_hang(p: Dang): boolean {
  return p[0].isZero() && p[1].isZero();
}

function _nhan(p: Dang, q: Dang): Dang {
  if (_la_hang(p)) return _nhan_hang(q, p[2]);
  if (_la_hang(q)) return _nhan_hang(p, q[2]);
  throw new LoiBPT('Chỉ nhận bất phương trình bậc nhất (không có xy, x², ...)');
}

function _chia(p: Dang, q: Dang): Dang {
  if (!_la_hang(q)) throw new LoiBPT('Không chia cho biểu thức chứa x, y');
  if (q[2].isZero()) throw new LoiBPT('Chia cho 0');
  return _nhan_hang(p, Fraction.ONE.div(q[2]));
}

class _PhanTich {
  private readonly ten: string;
  private readonly toks: Token[];
  private i = 0;

  constructor(s: string, ten: string) {
    this.ten = ten;
    this.toks = _tach_token(s);
  }

  private _xem(): TokenType | null {
    return this.i < this.toks.length ? this.toks[this.i][0] : null;
  }

  private _lay(): Token {
    const t = this.toks[this.i];
    this.i += 1;
    return t;
  }

  chay(): Dang {
    if (this.toks.length === 0) {
      throw new LoiBPT(`Thiếu ${this.ten}`);
    }
    const v = this._expr();
    if (this.i !== this.toks.length) {
      const cap = this.ten.charAt(0).toUpperCase() + this.ten.slice(1);
      throw new LoiBPT(`${cap} không hợp lệ`);
    }
    return v;
  }

  private _expr(): Dang {
    let v = this._term();
    while (this._xem() === '+' || this._xem() === '-') {
      const op = this._lay()[0];
      const r = this._term();
      v = op === '+' ? _cong(v, r) : _cong(v, _nhan_hang(r, Fraction.MINUS_ONE));
    }
    return v;
  }

  private _term(): Dang {
    let v = this._unary();
    while (true) {
      const t = this._xem();
      if (t === '*') {
        this._lay();
        v = _nhan(v, this._unary());
      } else if (t === '/') {
        this._lay();
        v = _chia(v, this._unary());
      } else if (t === 'num' || t === 'var' || t === '(') {
        v = _nhan(v, this._unary()); // implicit multiplication
      } else {
        return v;
      }
    }
  }

  private _unary(): Dang {
    const t = this._xem();
    if (t === '+') {
      this._lay();
      return this._unary();
    }
    if (t === '-') {
      this._lay();
      return _nhan_hang(this._unary(), Fraction.MINUS_ONE);
    }
    return this._atom();
  }

  private _atom(): Dang {
    const t = this._xem();
    const cap = this.ten.charAt(0).toUpperCase() + this.ten.slice(1);
    if (t === null) {
      throw new LoiBPT(`${cap} thiếu toán hạng`);
    }
    if (t === 'num') {
      const raw = this._lay()[1];
      let val: Fraction;
      try {
        val = Fraction.fromDecimalString(raw);
      } catch {
        throw new LoiBPT('Số không hợp lệ');
      }
      return [Fraction.ZERO, Fraction.ZERO, val];
    }
    if (t === 'var') {
      return this._lay()[1] === 'x'
        ? [Fraction.ONE, Fraction.ZERO, Fraction.ZERO]
        : [Fraction.ZERO, Fraction.ONE, Fraction.ZERO];
    }
    if (t === '(') {
      this._lay();
      const v = this._expr();
      if (this._xem() !== ')') {
        throw new LoiBPT('Thiếu dấu ngoặc đóng');
      }
      this._lay();
      return v;
    }
    throw new LoiBPT(`${cap} không hợp lệ`);
  }
}

export function tach_bpt(text: string): [Dang, Dang, '>' | '<'] {
  const s = text.replace(/\s+/g, '');
  const n_lon = (s.match(/>/g) || []).length;
  const n_nho = (s.match(/</g) || []).length;
  if (n_lon + n_nho !== 1) {
    throw new LoiBPT('Cần đúng một dấu > hoặc <');
  }
  const dau: '>' | '<' = n_lon ? '>' : '<';
  const [trai, phai] = s.split(dau);
  const L = new _PhanTich(trai, 'vế trái').chay();
  const R = new _PhanTich(phai, 'vế phải').chay();
  return [L, R, dau];
}

export function chuan_hoa_bpt(L: Dang, R: Dang, dau: '>' | '<'): Dang {
  let hieu = _cong(L, _nhan_hang(R, Fraction.MINUS_ONE));
  if (dau === '<') {
    hieu = _nhan_hang(hieu, Fraction.MINUS_ONE);
  }
  if (hieu[0].isZero() && hieu[1].isZero()) {
    throw new LoiBPT('Hệ số của x và y đều bằng 0');
  }
  return hieu;
}

export function phan_tich_bpt(text: string): Dang {
  const [L, R, dau] = tach_bpt(text);
  return chuan_hoa_bpt(L, R, dau);
}

// ------------------- boundary label formatting -------------------

function _so_tex(f: Fraction): string {
  const af = f.abs();
  if (af.denominator === 1n) {
    return af.numerator.toString();
  }
  return `${LENH_PHAN_SO}{${af.numerator.toString()}}{${af.denominator.toString()}}`;
}

function _so_van(f: Fraction, sau_la_bien: boolean): string {
  const af = f.abs();
  if (af.denominator === 1n) {
    return af.numerator.toString();
  }
  const s = `${af.numerator.toString()}/${af.denominator.toString()}`;
  return sau_la_bien ? `(${s})` : s;
}

function _dang_tex_van(p: Dang): [string, string] {
  let tex = '';
  let van = '';
  const items: Array<[Fraction, string]> = [
    [p[0], 'x'],
    [p[1], 'y'],
    [p[2], ''],
  ];
  for (const [k, ten] of items) {
    if (k.isZero()) continue;
    const dau = k.sign() < 0 ? '-' : tex ? '+' : '';
    let ht: string;
    let hv: string;
    if (ten && k.abs().eq(Fraction.ONE)) {
      ht = '';
      hv = '';
    } else {
      ht = _so_tex(k);
      hv = _so_van(k, Boolean(ten));
    }
    tex += `${dau}${ht}${ten}`;
    van += `${dau}${hv}${ten}`;
  }
  return tex ? [tex, van] : ['0', '0'];
}

export function nhan_tu_dang(L: Dang, R: Dang): [string, string] {
  const [lt, lv] = _dang_tex_van(L);
  const [rt, rv] = _dang_tex_van(R);
  return [`${lt}=${rt}`, `${lv}=${rv}`];
}

// ------------------------------ numbers & formatting ------------------------------

export function doc_so(text: string, ten: string): number {
  const t = text.trim().replace(/,/g, '.');
  if (!t) {
    throw new LoiBPT(`${ten}: chưa nhập`);
  }
  const v = Number(t);
  if (Number.isNaN(v)) {
    throw new LoiBPT(`${ten}: '${text.trim()}' không phải là số`);
  }
  if (!Number.isFinite(v) || Math.abs(v) > 1e15) {
    throw new LoiBPT(`${ten}: giá trị quá lớn (tối đa 1e15)`);
  }
  return v;
}

export function doc_buoc(text: string, ten: string): ExactDecimal {
  const t = text.trim().replace(/,/g, '.');
  if (!t) {
    throw new LoiBPT(`${ten}: chưa nhập`);
  }
  let d: ExactDecimal;
  try {
    d = ExactDecimal.parse(t);
  } catch {
    throw new LoiBPT(`${ten}: '${text.trim()}' không phải là số`);
  }
  if (!d.isPositive()) {
    throw new LoiBPT(`${ten} phải là số dương`);
  }
  return d;
}

export function so(v: number, nd: number = SO_THAP_PHAN): string {
  const fixed = v.toFixed(nd);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return trimmed === '' || trimmed === '-0' ? '0' : trimmed;
}

const SUP_MAP: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function toSuperscript(s: string): string {
  return s
    .split('')
    .map((ch) => SUP_MAP[ch] ?? ch)
    .join('');
}

export function dinh_dang_nhan(d: ExactDecimal): [string, string] {
  if (d.isZero()) return ['0', '0'];
  const dau = d.coeff < 0n ? '-' : '';
  const absD = new ExactDecimal(d.coeff < 0n ? -d.coeff : d.coeff, d.exp);
  const e = absD.adjusted();
  if (e >= -3 && e < 5) {
    const s = dau + absD.toFixedPlain();
    return [s, s];
  }
  const mant = new ExactDecimal(absD.coeff, absD.exp - e).toFixedPlain();
  const mu = toSuperscript(String(e));
  if (mant === '1') {
    return [`${dau}10^{${e}}`, `${dau}10${mu}`];
  }
  return [`${dau}${mant}\\cdot 10^{${e}}`, `${dau}${mant}·10${mu}`];
}

export function buoc_dep(khoang: number, muc_tieu = 12): ExactDecimal {
  const raw = khoang / muc_tieu;
  const e = Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) {
    const d = ExactDecimal.fromIntExp(m, e);
    if (d.toNumber() >= raw * (1 - 1e-9)) {
      return d;
    }
  }
  return ExactDecimal.fromIntExp(10, e);
}

// ----------------------------- scene data structures -----------------------------

export interface Ham {
  text: string;
  mau?: string;
  goc?: number | null;
  kc?: number;
  vi_tri?: number | null;
  hien_nhan?: boolean;
  to_mau?: boolean;
  do_dam?: number;
  he_so?: Dang | null;
}

export interface Vach {
  k: number;
  tex: string;
  van: string;
  co_nhan: boolean;
}

export interface HamHinh {
  chi_so: number;
  mau: string;
  goc: number;
  kc: number;
  da_giac: Array<[number, number]>;
  doan: [[number, number], [number, number]] | null;
  nhan: string;
  vi_tri_nhan: number;
  nhan_phia_tren: boolean;
  bpt: string;
  an_nhan: boolean;
  to_mau: boolean;
  do_dam: number;
  nhan_van: string;
  he: Dang | null;
}

export interface GiaoDiem {
  x: Fraction;
  y: Fraction;
  u: number;
  v: number;
  ham: number[];
}

export interface DiemPhu {
  ma: string;
  ten: string;
  ten_tex: string;
  x: Fraction;
  y: Fraction;
  u: number;
  v: number;
  ham: number[];
  goc_nhan: number;
}

export interface Canh {
  buoc_x: ExactDecimal;
  buoc_y: ExactDecimal;
  umin: number;
  umax: number;
  vmin: number;
  vmax: number;
  lu: number;
  kx: [number, number];
  ky: [number, number];
  vach_x: Vach[];
  vach_y: Vach[];
  ham: HamHinh[];
  loi: Record<number, string>;
  giao_diem: GiaoDiem[];
  diem_phu: DiemPhu[];
  hien_ten_diem: boolean;
  hien_so: boolean;
  hien_gach: boolean;
}

// --------------------------------- geometry ---------------------------------

function _cat_nua_mat_phang(
  poly: Array<[number, number]>,
  a: number,
  b: number,
  c: number
): Array<[number, number]> {
  const ra: Array<[number, number]> = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const fp = a * p[0] + b * p[1] + c;
    const fq = a * q[0] + b * q[1] + c;
    const p_trong = fp <= 0;
    const q_trong = fq <= 0;
    if (p_trong) ra.push(p);
    if (p_trong !== q_trong) {
      const t = fp / (fp - fq);
      ra.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return ra;
}

function _don_gian(poly: Array<[number, number]>): Array<[number, number]> {
  const ra: Array<[number, number]> = [];
  for (const p of poly) {
    const last = ra[ra.length - 1];
    if (!last || Math.abs(p[0] - last[0]) > 1e-9 || Math.abs(p[1] - last[1]) > 1e-9) {
      ra.push(p);
    }
  }
  if (ra.length > 1) {
    const first = ra[0];
    const last = ra[ra.length - 1];
    if (Math.abs(first[0] - last[0]) <= 1e-9 && Math.abs(first[1] - last[1]) <= 1e-9) {
      ra.pop();
    }
  }
  if (ra.length < 3) return [];
  let dien_tich = 0;
  for (let i = 0; i < ra.length; i++) {
    const p = ra[i];
    const q = ra[(i + 1) % ra.length];
    dien_tich += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(dien_tich) / 2 > 1e-9 ? ra : [];
}

function _doan_thang(
  a: number,
  b: number,
  c: number,
  umin: number,
  umax: number,
  vmin: number,
  vmax: number
): [[number, number], [number, number]] | null {
  const x0 = -a * c;
  const y0 = -b * c;
  const dx = -b;
  const dy = a;
  let t0 = -Infinity;
  let t1 = Infinity;
  const planes: Array<[number, number]> = [
    [-dx, x0 - umin],
    [dx, umax - x0],
    [-dy, y0 - vmin],
    [dy, vmax - y0],
  ];
  for (const [p, q] of planes) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  if (!(t0 < t1 - 1e-9)) return null;
  let P: [number, number] = [x0 + t0 * dx, y0 + t0 * dy];
  let Q: [number, number] = [x0 + t1 * dx, y0 + t1 * dy];
  if (Math.abs(Q[0] - P[0]) < 1e-9) {
    if (Q[1] < P[1]) [P, Q] = [Q, P];
  } else if (Q[0] < P[0]) {
    [P, Q] = [Q, P];
  }
  return [P, Q];
}

function _thua_nhan(vach: Vach[], lu: number, ngang: boolean): void {
  if (vach.length === 0) return;
  const kc_pt = lu / CM_MOI_PT;
  const can = ngang
    ? Math.max(...vach.map((v) => v.van.length)) * 2.4 + 3.0
    : 7.0;
  const m = Math.max(1, Math.ceil(can / kc_pt));
  for (const v of vach) {
    v.co_nhan = v.k % m === 0;
  }
}

function modPos(x: number, m: number): number {
  return ((x % m) + m) % m;
}

function _goc_dat_ten(
  duong: number[],
  u: number,
  v: number,
  umin: number,
  umax: number,
  vmin: number,
  vmax: number,
  lu: number
): number {
  const r = (BK_NHAN_PT * CM_MOI_PT) / lu;
  for (const trong of [true, false]) {
    let tot: number | null = null;
    let tot_diem = -Infinity;
    for (let goc = 0; goc < 360; goc += 15) {
      const rad = (goc * Math.PI) / 180;
      const cu = u + r * Math.cos(rad);
      const cv = v + r * Math.sin(rad);
      if (
        trong &&
        !(cu >= umin - 1e-9 && cu <= umax + 1e-9 && cv >= vmin - 1e-9 && cv <= vmax + 1e-9)
      ) {
        continue;
      }
      let xa = 90.0;
      for (const d of duong) {
        const diff = Math.abs(modPos(goc - d + 90.0, 180.0) - 90.0);
        if (diff < xa) xa = diff;
      }
      const lech = Math.abs(modPos(goc - 45.0 + 180.0, 360.0) - 180.0);
      const diem = xa - 0.001 * lech;
      if (diem > tot_diem) {
        tot = goc;
        tot_diem = diem;
      }
    }
    if (tot !== null) return tot;
  }
  return 45.0;
}

function _tim_giao_diem(
  dg: Array<[number, Fraction, Fraction, Fraction]>,
  sx: number,
  sy: number,
  umin: number,
  umax: number,
  vmin: number,
  vmax: number
): GiaoDiem[] {
  const map = new Map<string, { x: Fraction; y: Fraction; ds: Set<number> }>();
  for (let m = 0; m < dg.length; m++) {
    const [i, a1, b1, c1] = dg[m];
    for (let n = m + 1; n < dg.length; n++) {
      const [j, a2, b2, c2] = dg[n];
      const det = a1.mul(b2).sub(a2.mul(b1));
      if (det.isZero()) continue;
      const x = b1.mul(c2).sub(b2.mul(c1)).div(det);
      const y = a2.mul(c1).sub(a1.mul(c2)).div(det);
      const u = x.toNumber() / sx;
      const v = y.toNumber() / sy;
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (u >= umin - 1e-9 && u <= umax + 1e-9 && v >= vmin - 1e-9 && v <= vmax + 1e-9) {
        const key = `${x.toString()},${y.toString()}`;
        let entry = map.get(key);
        if (!entry) {
          entry = { x, y, ds: new Set<number>() };
          map.set(key, entry);
        }
        entry.ds.add(i);
        entry.ds.add(j);
      }
    }
  }
  const entries = Array.from(map.values()).sort((p, q) => {
    const cx = p.x.cmp(q.x);
    return cx !== 0 ? cx : p.y.cmp(q.y);
  });
  return entries.map((e) => ({
    x: e.x,
    y: e.y,
    u: e.x.toNumber() / sx,
    v: e.y.toNumber() / sy,
    ham: Array.from(e.ds).sort((a, b) => a - b),
  }));
}

// ------------------- marked points -------------------

export function ten_diem_ranh(da_dung: Iterable<string>): string {
  const used = new Set(da_dung);
  for (let q = 0; q < 1000; q++) {
    for (const ch of CHU_CAI_DIEM) {
      const ten = ch + (q ? String(q) : '');
      if (!used.has(ten)) return ten;
    }
  }
  return 'A';
}

export function ten_tex_diem(ten: string): string {
  return ten.length <= 1 ? ten : `${ten[0]}_{${ten.slice(1)}}`;
}

export function vi_tri_diem(
  x: Fraction,
  y: Fraction,
  cac_he: Dang[]
): [Fraction, Fraction] | null {
  if (cac_he.length === 0) return null;
  for (let m = 0; m < cac_he.length; m++) {
    const [a1, b1, c1] = cac_he[m];
    for (let n = m + 1; n < cac_he.length; n++) {
      const [a2, b2, c2] = cac_he[n];
      const det = a1.mul(b2).sub(a2.mul(b1));
      if (!det.isZero()) {
        return [
          b1.mul(c2).sub(b2.mul(c1)).div(det),
          a2.mul(c1).sub(a1.mul(c2)).div(det),
        ];
      }
    }
  }
  const [a, b, c] = cac_he[0];
  const d = a.mul(x).add(b.mul(y)).add(c).div(a.mul(a).add(b.mul(b)));
  return [x.sub(a.mul(d)), y.sub(b.mul(d))];
}

export function diem_gan_tren_duong(
  he: Dang,
  u: number,
  v: number,
  buoc_x: ExactDecimal,
  buoc_y: ExactDecimal,
  chia = 1,
  ban_kinh = 0.5
): ['x' | 'y', Fraction, Fraction, Fraction] | null {
  const [a, b, c] = he;
  const bx = buoc_x.toFraction();
  const by = buoc_y.toFraction();
  const sx = bx.toNumber();
  const sy = by.toNumber();
  const au = a.toNumber() * sx;
  const bu = b.toNumber() * sy;
  const cu = c.toNumber();
  const n2 = au * au + bu * bu;
  if (!(n2 > 0 && Number.isFinite(n2) && Number.isFinite(cu))) {
    return null;
  }
  const d = (au * u + bu * v + cu) / n2;
  const up = u - au * d;
  const vp = v - bu * d;
  const chiaSafe = Math.max(1, Math.trunc(chia));
  const chiaF = new Fraction(chiaSafe);
  const qx = bx.div(chiaF);
  const qy = by.div(chiaF);
  const truc: 'x' | 'y' = Math.abs(bu) >= Math.abs(au) ? 'x' : 'y';
  const ung_vien: Array<[Fraction, Fraction]> = [];
  if (truc === 'x') {
    const j0 = Math.round((up * sx) / qx.toNumber());
    for (let j = j0 - 6; j <= j0 + 6; j++) {
      const x = new Fraction(j).mul(qx);
      const y = a.mul(x).add(c).neg().div(b);
      ung_vien.push([x, y]);
    }
  } else {
    const i0 = Math.round((vp * sy) / qy.toNumber());
    for (let i = i0 - 6; i <= i0 + 6; i++) {
      const y = new Fraction(i).mul(qy);
      const x = b.mul(y).add(c).neg().div(a);
      ung_vien.push([x, y]);
    }
  }
  let tot: [Fraction, Fraction] | null = null;
  let tot_kc = ban_kinh;
  for (const [x, y] of ung_vien) {
    if (x.div(qx).denominator !== 1n || y.div(qy).denominator !== 1n) {
      continue;
    }
    const kc = Math.hypot(x.toNumber() / sx - up, y.toNumber() / sy - vp);
    if (kc <= tot_kc) {
      tot = [x, y];
      tot_kc = kc;
    }
  }
  if (tot === null) {
    tot = ung_vien[6];
  }
  const [fx, fy] = tot;
  return [truc, truc === 'x' ? fx : fy, fx, fy];
}

export type DiemInput = [string, string, Fraction, Fraction, number[]];

function _tao_diem_phu(
  ds: DiemInput[] | undefined,
  he_ham: Map<number, Dang>,
  sx: number,
  sy: number,
  umin: number,
  umax: number,
  vmin: number,
  vmax: number,
  lu: number
): DiemPhu[] {
  const ra: DiemPhu[] = [];
  for (const [ma, ten, x0, y0, idx] of ds ?? []) {
    const gan = idx.filter((i) => he_ham.has(i));
    const kq = vi_tri_diem(
      x0,
      y0,
      gan.map((i) => he_ham.get(i)!)
    );
    if (kq === null) continue;
    const [x, y] = kq;
    const u = x.toNumber() / sx;
    const v = y.toNumber() / sy;
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    if (!(u >= umin - 1e-9 && u <= umax + 1e-9 && v >= vmin - 1e-9 && v <= vmax + 1e-9)) {
      continue;
    }
    const huong = gan.map((i) => {
      const he = he_ham.get(i)!;
      return (Math.atan2(he[0].toNumber() * sx, -he[1].toNumber() * sy) * 180) / Math.PI;
    });
    if (Math.abs(u) < 1e-9) huong.push(90.0);
    if (Math.abs(v) < 1e-9) huong.push(0.0);
    ra.push({
      ma,
      ten,
      ten_tex: ten_tex_diem(ten),
      x,
      y,
      u,
      v,
      ham: gan,
      goc_nhan: _goc_dat_ten(huong, u, v, umin, umax, vmin, vmax, lu),
    });
  }
  return ra;
}

export interface TaoCanhOptions {
  buoc_x?: ExactDecimal | null;
  buoc_y?: ExactDecimal | null;
  hien_so?: boolean;
  hien_gach?: boolean;
  diem?: DiemInput[];
  hien_ten_diem?: boolean;
}

export function tao_canh(
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  ds_ham: Ham[],
  opts: TaoCanhOptions = {}
): Canh {
  if (!(xmin < 0 && 0 < xmax)) {
    throw new LoiBPT('Cần X min < 0 < X max');
  }
  if (!(ymin < 0 && 0 < ymax)) {
    throw new LoiBPT('Cần Y min < 0 < Y max');
  }
  const bx = opts.buoc_x ?? buoc_dep(xmax - xmin);
  const by = opts.buoc_y ?? buoc_dep(ymax - ymin);
  const sx = bx.toNumber();
  const sy = by.toNumber();
  if (!(0 < sx && sx < 1e300 && 0 < sy && sy < 1e300)) {
    throw new LoiBPT('Bước chia quá nhỏ hoặc quá lớn');
  }
  const umin = xmin / sx;
  const umax = xmax / sx;
  const vmin = ymin / sy;
  const vmax = ymax / sy;
  const nx = umax - umin;
  const ny = vmax - vmin;
  if (nx > MAX_VACH || ny > MAX_VACH) {
    throw new LoiBPT(
      `Bước chia quá nhỏ so với khung (quá ${MAX_VACH} khoảng). Hãy tăng bước chia hoặc bật 'Tự chia vạch'`
    );
  }
  const lu = Math.round(Math.min(2.0, Math.max(0.15, KICH_THUOC_HINH / Math.max(nx, ny))) * 100) / 100;
  const kx: [number, number] = [Math.ceil(umin - 1e-9), Math.floor(umax + 1e-9)];
  const ky: [number, number] = [Math.ceil(vmin - 1e-9), Math.floor(vmax + 1e-9)];

  const canh: Canh = {
    buoc_x: bx,
    buoc_y: by,
    umin,
    umax,
    vmin,
    vmax,
    lu,
    kx,
    ky,
    vach_x: [],
    vach_y: [],
    ham: [],
    loi: {},
    giao_diem: [],
    diem_phu: [],
    hien_ten_diem: opts.hien_ten_diem ?? true,
    hien_so: opts.hien_so ?? true,
    hien_gach: opts.hien_gach ?? true,
  };

  for (let k = kx[0]; k <= kx[1]; k++) {
    if (k !== 0) {
      const [t, v] = dinh_dang_nhan(bx.mulInt(k));
      canh.vach_x.push({ k, tex: t, van: v, co_nhan: true });
    }
  }
  for (let k = ky[0]; k <= ky[1]; k++) {
    if (k !== 0) {
      const [t, v] = dinh_dang_nhan(by.mulInt(k));
      canh.vach_y.push({ k, tex: t, van: v, co_nhan: true });
    }
  }
  _thua_nhan(canh.vach_x, lu, true);
  _thua_nhan(canh.vach_y, lu, false);

  const khung: Array<[number, number]> = [
    [umin, vmax],
    [umin, vmin],
    [umax, vmin],
    [umax, vmax],
  ];
  let dem = 0;
  const dg: Array<[number, Fraction, Fraction, Fraction]> = [];
  const he_ham = new Map<number, Dang>();

  for (let i = 0; i < ds_ham.length; i++) {
    const h = ds_ham[i];
    if (!h.text.trim()) continue;
    let a: Fraction, b: Fraction, c: Fraction;
    let ve_trai: Dang, ve_phai: Dang;
    let sinh_lai = false;
    let au = 0,
      bu = 0,
      cu = 0,
      n = 0;
    try {
      if (h.he_so != null) {
        [a, b, c] = h.he_so;
        if (a.isZero() && b.isZero()) {
          throw new LoiBPT('Hệ số của x và y đều bằng 0');
        }
        ve_trai = [a, b, Fraction.ZERO];
        ve_phai = [Fraction.ZERO, Fraction.ZERO, c.neg()];
        sinh_lai = true;
      } else {
        const [vt, vp, dau] = tach_bpt(h.text);
        ve_trai = vt;
        ve_phai = vp;
        [a, b, c] = chuan_hoa_bpt(ve_trai, ve_phai, dau);
        sinh_lai = h.text.includes('.') || h.text.includes('/');
      }
      au = a.toNumber() * sx;
      bu = b.toNumber() * sy;
      cu = c.toNumber();
      n = Math.hypot(au, bu);
      if (!(n > 0 && Number.isFinite(n) && Number.isFinite(cu))) {
        throw new LoiBPT('Hệ số quá nhỏ hoặc quá lớn so với bước chia');
      }
    } catch (e) {
      if (e instanceof LoiBPT) {
        canh.loi[i] = e.message;
        continue;
      }
      throw e;
    }

    const an = au / n;
    const bn = bu / n;
    const cn = cu / n;

    const da_giac = _don_gian(_cat_nua_mat_phang(khung, an, bn, cn));
    const doan = _doan_thang(an, bn, cn, umin, umax, vmin, vmax);

    let goc: number;
    if (h.goc == null) {
      const phi = modPos((Math.atan2(an, -bn) * 180) / Math.PI, 180.0);
      goc = Math.round(modPos(phi + 60.0, 180.0) * 10) / 10;
    } else {
      goc = modPos(h.goc, 180.0);
    }

    let nhan: string;
    let nhan_van: string;
    if (sinh_lai) {
      [nhan, nhan_van] = nhan_tu_dang(ve_trai, ve_phai);
    } else {
      nhan = h.text.replace(/\s+/g, '').replace(/>/g, '=').replace(/</g, '=').replace(/\*/g, '');
      nhan_van = nhan;
    }
    if (c.isZero() && (a.isZero() || b.isZero())) {
      nhan = '';
      nhan_van = '';
    }
    const hien_nhan = h.hien_nhan ?? true;
    if (!hien_nhan) {
      nhan = '';
      nhan_van = '';
    }

    const vt =
      h.vi_tri == null
        ? VI_TRI_NHAN[dem % VI_TRI_NHAN.length]
        : Math.min(1.0, Math.max(0.0, h.vi_tri));

    let phia_tren = false;
    if (doan) {
      const dx = doan[1][0] - doan[0][0];
      const dy = doan[1][1] - doan[0][1];
      phia_tren = -dy * an + dx * bn < 0;
    }

    const do_dam = Math.min(100.0, Math.max(1.0, h.do_dam ?? 25.0));
    canh.ham.push({
      chi_so: i,
      mau: h.mau ?? 'blue',
      goc,
      kc: h.kc ?? 3.0,
      da_giac,
      doan,
      nhan,
      vi_tri_nhan: vt,
      nhan_phia_tren: phia_tren,
      bpt: h.text.replace(/\s+/g, ''),
      an_nhan: !hien_nhan,
      to_mau: Boolean(h.to_mau),
      do_dam,
      nhan_van,
      he: [a, b, c],
    });
    dg.push([i, a, b, c]);
    he_ham.set(i, [a, b, c]);
    dem += 1;
  }

  canh.giao_diem = _tim_giao_diem(dg, sx, sy, umin, umax, vmin, vmax);
  canh.diem_phu = _tao_diem_phu(opts.diem, he_ham, sx, sy, umin, umax, vmin, vmax, lu);
  return canh;
}

function _lam_tron_truc(lo: number, hi: number): [number, number] {
  const lo0 = Math.min(lo, 0.0);
  const hi0 = Math.max(hi, 0.0);
  const pad = (hi0 - lo0) * 0.15;
  const loP = lo0 - pad;
  const hiP = hi0 + pad;
  const buoc = buoc_dep(hiP - loP);
  const sb = buoc.toNumber();
  let lo_n = buoc.mulInt(Math.floor(loP / sb)).toNumber();
  let hi_n = buoc.mulInt(Math.ceil(hiP / sb)).toNumber();
  if (lo_n >= 0) lo_n = -sb;
  if (hi_n <= 0) hi_n = sb;
  return [lo_n, hi_n];
}

export function tu_dong_khung(ds_ham: Ham[]): [number, number, number, number] {
  const dg: Array<[number, number, number]> = [];
  for (const h of ds_ham) {
    if (!h.text.trim()) continue;
    try {
      const [a, b, c] = phan_tich_bpt(h.text);
      const af = a.toNumber();
      const bf = b.toNumber();
      const cf = c.toNumber();
      if (Number.isFinite(af) && Number.isFinite(bf) && Number.isFinite(cf)) {
        dg.push([af, bf, cf]);
      }
    } catch {
      continue;
    }
  }
  const xs = [0.0];
  const ys = [0.0];
  for (const [a, b, c] of dg) {
    if (a !== 0) xs.push(-c / a);
    if (b !== 0) ys.push(-c / b);
  }
  const mx = Math.max(...xs.map(Math.abs)) || 1.0;
  const my = Math.max(...ys.map(Math.abs)) || 1.0;
  for (let i = 0; i < dg.length; i++) {
    for (let j = i + 1; j < dg.length; j++) {
      const [a1, b1, c1] = dg[i];
      const [a2, b2, c2] = dg[j];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) <= 1e-12 * (Math.abs(a1 * b2) + Math.abs(a2 * b1))) {
        continue;
      }
      const x = (b1 * c2 - b2 * c1) / det;
      const y = (a2 * c1 - a1 * c2) / det;
      if (Math.abs(x) <= 10 * mx && Math.abs(y) <= 10 * my) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  let lo_x = Math.min(...xs);
  let hi_x = Math.max(...xs);
  let lo_y = Math.min(...ys);
  let hi_y = Math.max(...ys);
  const dx = hi_x - lo_x;
  const dy = hi_y - lo_y;
  if (dx === 0 && dy === 0) return [-5.0, 5.0, -5.0, 5.0];
  if (dx === 0) {
    lo_x = -dy / 2;
    hi_x = dy / 2;
  }
  if (dy === 0) {
    lo_y = -dx / 2;
    hi_y = dx / 2;
  }
  const [rx0, rx1] = _lam_tron_truc(lo_x, hi_x);
  const [ry0, ry1] = _lam_tron_truc(lo_y, hi_y);
  return [rx0, rx1, ry0, ry1];
}

// ---------------------------------- TikZ code generation ----------------------------------

function _dong_ve_vach(truc: 'x' | 'y', nhan: string | null, hien_gach: boolean): string | null {
  const [gach, dau_mut, doi, node] =
    truc === 'x'
      ? ['(\\x,2pt)--(\\x,-2pt)', '(\\x,-2pt)', '+(0,-7pt)', 'node']
      : ['(2pt,\\y)--(-2pt,\\y)', '(-2pt,\\y)', '+(-5pt,0)', 'node[anchor=east]'];
  if (hien_gach && nhan !== null) {
    return `\\draw ${gach} ${doi} ${node}{${nhan}};`;
  }
  if (hien_gach) {
    return `\\draw ${gach};`;
  }
  if (nhan !== null) {
    return `\\path ${dau_mut} ${doi} ${node}{${nhan}};`;
  }
  return null;
}

function _tikz_vach(c: Canh, truc: 'x' | 'y'): string[] {
  const vach = truc === 'x' ? c.vach_x : c.vach_y;
  const [k0, k1] = truc === 'x' ? c.kx : c.ky;
  const buoc = truc === 'x' ? c.buoc_x : c.buoc_y;
  if (vach.length === 0 || !(c.hien_so || c.hien_gach)) {
    return [];
  }
  const bien = '\\' + truc;
  if (!c.hien_so || (buoc.isOne() && vach.every((v) => v.co_nhan))) {
    const ve = _dong_ve_vach(truc, c.hien_so ? `$${bien}$` : null, c.hien_gach);
    return [
      `\t\\foreach ${bien} in {${k0},...,${k1}}{`,
      `\t\t\\unless\\ifnum${bien}=0`,
      `\t\t\t${ve}`,
      '\t\t\\fi',
      '\t}',
    ];
  }
  const cap = c.hien_gach
    ? vach.map((v) => (v.co_nhan ? `${v.k}/{$${v.tex}$}` : `${v.k}/{}`)).join(',')
    : vach
        .filter((v) => v.co_nhan)
        .map((v) => `${v.k}/{$${v.tex}$}`)
        .join(',');
  if (!cap) return [];
  const ve = _dong_ve_vach(truc, '\\nhan', c.hien_gach);
  return [`\t\\foreach ${bien}/\\nhan in {${cap}}{`, `\t\t${ve}`, '\t}'];
}

function _ghi_chu(text: string): string {
  return text.replace(/%/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
}

function _phan_so(f: Fraction): string {
  return f.denominator === 1n ? f.numerator.toString() : `${f.numerator.toString()}/${f.denominator.toString()}`;
}

export function tao_tikz(c: Canh, ghi_chu = true): string {
  const L: string[] = [
    `\\begin{tikzpicture}[>=stealth,x=${so(c.lu, 2)}cm,y=${so(c.lu, 2)}cm,font=\\tiny]`,
  ];
  const gc = (dong: string) => {
    if (ghi_chu) L.push(dong);
  };

  if (c.ham.length > 0) {
    gc('\t% --- Gạch sọc hoặc tô màu phần không thỏa của từng hàm (vẽ trước để không đè lên trục) ---');
  }
  for (const h of c.ham) {
    const ten = `Hàm ${h.chi_so + 1}: ${_ghi_chu(h.bpt)}`;
    if (h.da_giac.length > 0) {
      const pts = h.da_giac.map(([u, v]) => `(${so(u)},${so(v)})`).join('--');
      if (h.to_mau) {
        gc(`\t% ${ten} - tô màu (${h.mau}, độ đậm ${so(h.do_dam, 1)}%)`);
        L.push(`\t\\fill[${h.mau},fill opacity=${so(h.do_dam / 100, 2)}] ${pts}--cycle;`);
      } else {
        gc(`\t% ${ten} - gạch sọc (${h.mau}, góc ${so(h.goc, 1)}°, cách ${so(h.kc, 2)}pt)`);
        L.push(
          `\t\\fill[pattern={Lines[angle=${so(h.goc, 1)},distance=${so(h.kc, 2)}pt]},pattern color=${h.mau}!25] ${pts}--cycle;`
        );
      }
    } else {
      gc(`\t% ${ten} - không có phần nào trong khung cần tô hoặc gạch sọc`);
    }
  }

  gc('\t% --- Trục tọa độ và vạch chia ---');
  L.push(
    `\t\\draw[->] (${so(c.umin - 0.5)},0)--(${so(c.umax + 0.5)},0) node[shift={(-85:7pt)},font=\\normalsize]{$x$};`,
    `\t\\draw[->] (0,${so(c.vmin - 0.5)})--(0,${so(c.vmax + 0.5)}) node[shift={(175:7pt)},font=\\normalsize]{$y$};`,
    '\t\\path (0,0) node[shift={(225:9pt)}]{$O$};'
  );
  L.push(..._tikz_vach(c, 'x'));
  L.push(..._tikz_vach(c, 'y'));

  if (c.ham.length > 0) {
    gc('\t% --- Đường biên và nhãn của từng hàm ---');
  }
  for (const h of c.ham) {
    const ten = `Hàm ${h.chi_so + 1}: ${_ghi_chu(h.bpt)}`;
    if (!h.doan) {
      gc(`\t% ${ten} - đường biên nằm ngoài khung nhìn nên không vẽ`);
      continue;
    }
    const bien = _ghi_chu(h.bpt).replace(/>/g, '=').replace(/</g, '=');
    let ghi: string;
    if (h.nhan) {
      ghi = `nhãn ở vị trí ${Math.round(h.vi_tri_nhan * 100)}%`;
    } else if (h.an_nhan) {
      ghi = 'đã ẩn nhãn';
    } else {
      ghi = 'trùng trục tọa độ nên không ghi nhãn';
    }
    gc(`\t% ${ten} - đường biên ${bien}, ${ghi}`);
    const [[u1, v1], [u2, v2]] = h.doan;
    let nut = '';
    if (h.nhan) {
      nut = ` node[sloped,pos=${so(h.vi_tri_nhan, 2)},${h.nhan_phia_tren ? 'above' : 'below'}]{$${h.nhan}$}`;
    }
    L.push(`\t\\draw[${h.mau}] (${so(u1)},${so(v1)})--(${so(u2)},${so(v2)})${nut};`);
  }

  if (c.diem_phu.length > 0) {
    gc('\t% --- Điểm đánh dấu ---');
    for (const d of c.diem_phu) {
      const cac_ham = d.ham.map((i) => `Hàm ${i + 1}`).join(' ∩ ');
      const toa_do = `(${_phan_so(d.x)}; ${_phan_so(d.y)})`;
      const quan_he = d.ham.length >= 2 ? `= ${cac_ham}` : `thuộc ${cac_ham}`;
      let nut = '';
      if (c.hien_ten_diem) {
        gc(`\t% Điểm ${d.ten} ${quan_he}: ${toa_do}`);
        nut = ` node[shift={(${Math.round(d.goc_nhan)}:${so(BK_NHAN_PT, 1)}pt)},font=\\scriptsize]{$${d.ten_tex}$}`;
      } else {
        gc(`\t% Điểm ${quan_he}: ${toa_do}`);
      }
      L.push(`\t\\fill (${so(d.u)},${so(d.v)}) circle(1.5pt)${nut};`);
    }
  }

  L.push('\\end{tikzpicture}');
  return L.join('\n') + '\n';
}

// ------------------ 3-point entry & dragging math ------------------

export function diem_tu_luoi(
  u: number,
  v: number,
  buoc_x: ExactDecimal,
  buoc_y: ExactDecimal,
  chia = 1
): [Fraction, Fraction] {
  const ku = new Fraction(Math.round(u * chia), chia);
  const kv = new Fraction(Math.round(v * chia), chia);
  return [ku.mul(buoc_x.toFraction()), kv.mul(buoc_y.toFraction())];
}

function _ve_trai(ia: bigint, ib: bigint): string {
  let ra = '';
  for (const [h, ten] of [
    [ia, 'x'],
    [ib, 'y'],
  ] as Array<[bigint, string]>) {
    if (h === 0n) continue;
    const absH = h < 0n ? -h : h;
    const he_so = absH === 1n ? '' : absH.toString();
    if (h < 0n) {
      ra += `-${he_so}${ten}`;
    } else {
      ra += `${ra ? '+' : ''}${he_so}${ten}`;
    }
  }
  return ra;
}

export function bpt_tu_3_diem(
  p1: [Fraction, Fraction],
  p2: [Fraction, Fraction],
  q: [Fraction, Fraction]
): string {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [xq, yq] = q;
  if (x1.eq(x2) && y1.eq(y2)) {
    throw new LoiBPT('Hai điểm trên đường biên trùng nhau');
  }
  let a = y2.sub(y1);
  let b = x1.sub(x2);
  let c = a.mul(x1).add(b.mul(y1)).neg();
  const gia_tri = a.mul(xq).add(b.mul(yq)).add(c);
  if (gia_tri.isZero()) {
    throw new LoiBPT('Điểm thuộc miền nghiệm đang nằm trên đường biên, hãy chọn điểm khác');
  }
  if (gia_tri.sign() < 0) {
    a = a.neg();
    b = b.neg();
    c = c.neg();
  }
  let mau = 1n;
  for (const t of [a, b, c]) {
    mau = (mau * t.denominator) / gcdBigInt(mau, t.denominator);
  }
  let ia = a.mul(new Fraction(mau)).numerator;
  let ib = b.mul(new Fraction(mau)).numerator;
  let ic = c.mul(new Fraction(mau)).numerator;
  const g = gcdBigInt(gcdBigInt(ia, ib), ic);
  ia /= g;
  ib /= g;
  ic /= g;
  let dau: '>' | '<' = '>';
  if (ia < 0n || (ia === 0n && ib < 0n)) {
    ia = -ia;
    ib = -ib;
    ic = -ic;
    dau = '<';
  }
  return `${_ve_trai(ia, ib)}${dau}${(-ic).toString()}`;
}

export function chuan_so_nguyen(a: Fraction, b: Fraction, c: Fraction): Dang {
  let mau = 1n;
  for (const t of [a, b, c]) {
    mau = (mau * t.denominator) / gcdBigInt(mau, t.denominator);
  }
  const mauF = new Fraction(mau);
  const ia = a.mul(mauF).numerator;
  const ib = b.mul(mauF).numerator;
  const ic = c.mul(mauF).numerator;
  const g = gcdBigInt(gcdBigInt(ia, ib), ic) || 1n;
  return [new Fraction(ia / g), new Fraction(ib / g), new Fraction(ic / g)];
}

export function fraction_text(v: Fraction): string {
  return v.denominator === 1n
    ? v.numerator.toString()
    : `(${v.numerator.toString()}/${v.denominator.toString()})`;
}

export function bpt_tu_he_so(a: Fraction, b: Fraction, c: Fraction): string {
  let dau: '>' | '<' = '>';
  const lead = !a.isZero() ? a : b;
  if (lead.sign() < 0) {
    a = a.neg();
    b = b.neg();
    c = c.neg();
    dau = '<';
  }
  let ve_trai = '';
  for (const [k, bien] of [
    [a, 'x'],
    [b, 'y'],
  ] as Array<[Fraction, string]>) {
    if (k.isZero()) continue;
    const ak = k.abs();
    const hs = ak.eq(Fraction.ONE) ? '' : fraction_text(ak);
    ve_trai += (k.sign() < 0 ? '-' : ve_trai ? '+' : '') + hs + bien;
  }
  return `${ve_trai}${dau}${fraction_text(c.neg())}`;
}

export function ucln_phan_so(p: Fraction, q: Fraction): Fraction {
  const ap = p.abs();
  const aq = q.abs();
  if (ap.isZero()) return aq;
  if (aq.isZero()) return ap;
  const m = (ap.denominator * aq.denominator) / gcdBigInt(ap.denominator, aq.denominator);
  const mF = new Fraction(m);
  const g = gcdBigInt(ap.mul(mF).numerator, aq.mul(mF).numerator);
  return new Fraction(g, m);
}

export function lam_tron_luoi(v: Fraction, buoc: Fraction, chia: number): Fraction {
  const q = buoc.div(new Fraction(chia));
  const steps = v.div(q).roundInt();
  return new Fraction(steps).mul(q);
}

export interface KeoDiemDongInfo {
  q: [Fraction, Fraction] | null;
  ori: [Fraction, Fraction];
}

export function duong_theo_diem(
  dong: Record<number, KeoDiemDongInfo>,
  P: [Fraction, Fraction]
): Record<number, Dang> | null {
  const ra: Record<number, Dang> = {};
  for (const [key, inf] of Object.entries(dong)) {
    const i = Number(key);
    let a: Fraction;
    let b: Fraction;
    if (inf.q === null) {
      [a, b] = inf.ori;
    } else {
      if (inf.q[0].eq(P[0]) && inf.q[1].eq(P[1])) {
        return null;
      }
      a = inf.q[1].sub(P[1]);
      b = P[0].sub(inf.q[0]);
      if (a.mul(inf.ori[0]).add(b.mul(inf.ori[1])).sign() < 0) {
        a = a.neg();
        b = b.neg();
      }
    }
    const c = a.mul(P[0]).add(b.mul(P[1])).neg();
    ra[i] = [a, b, c];
  }
  return ra;
}
