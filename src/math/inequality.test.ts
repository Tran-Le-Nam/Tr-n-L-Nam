import test from 'node:test';
import assert from 'node:assert/strict';
import { ExactDecimal } from './decimal';
import { Fraction } from './fraction';
import {
  LoiBPT,
  bpt_tu_3_diem,
  bpt_tu_he_so,
  buoc_dep,
  chuan_so_nguyen,
  diem_gan_tren_duong,
  diem_tu_luoi,
  dinh_dang_nhan,
  duong_theo_diem,
  lam_tron_luoi,
  nhan_tu_dang,
  phan_tich_bpt,
  so,
  tach_bpt,
  tao_canh,
  tao_tikz,
  ten_diem_ranh,
  ten_tex_diem,
  tu_dong_khung,
  ucln_phan_so,
} from './inequality';

test('phan_tich_bpt parses implicit multiplication, fractions, and flips <', () => {
  const [a, b, c] = phan_tich_bpt('2x+3y<6');
  // 2x + 3y < 6 => -2x - 3y + 6 > 0
  assert.equal(a.toString(), '-2');
  assert.equal(b.toString(), '-3');
  assert.equal(c.toString(), '6');

  const [a2, b2, c2] = phan_tich_bpt('y/2 > x - 3');
  // (1/2)y - x + 3 > 0 => -1*x + 1/2*y + 3 > 0
  assert.equal(a2.toString(), '-1');
  assert.equal(b2.toString(), '1/2');
  assert.equal(c2.toString(), '3');

  const [a3, b3, c3] = phan_tich_bpt('2(x+1) - y > 0');
  assert.equal(a3.toString(), '2');
  assert.equal(b3.toString(), '-1');
  assert.equal(c3.toString(), '2');
});

test('phan_tich_bpt rejects invalid expressions with LoiBPT', () => {
  assert.throws(() => phan_tich_bpt('2x+3y=6'), LoiBPT);
  assert.throws(() => phan_tich_bpt('x+y>1>0'), LoiBPT);
  assert.throws(() => phan_tich_bpt('x*y<2'), LoiBPT);
  assert.throws(() => phan_tich_bpt('2x-2x+3<5'), LoiBPT);
  assert.throws(() => phan_tich_bpt('(x+1<2'), LoiBPT);
});

test('nhan_tu_dang formats fractional coefficients with \\frac and p/q', () => {
  const [L, R] = tach_bpt('0.5x + 1.5y < 3');
  const [tex, van] = nhan_tu_dang(L, R);
  assert.equal(tex, '\\frac{1}{2}x+\\frac{3}{2}y=3');
  assert.equal(van, '(1/2)x+(3/2)y=3');
});

test('dinh_dang_nhan and buoc_dep handle extreme scales cleanly', () => {
  assert.deepEqual(dinh_dang_nhan(ExactDecimal.parse('0.001')), ['0.001', '0.001']);
  assert.deepEqual(dinh_dang_nhan(ExactDecimal.parse('0.0001')), ['10^{-4}', '10⁻⁴']);
  assert.deepEqual(dinh_dang_nhan(ExactDecimal.parse('200000')), ['2\\cdot 10^{5}', '2·10⁵']);
  const step = buoc_dep(10);
  assert.equal(step.toNumber(), 1);
  assert.equal(so(-0.0001, 2), '0');
});

test('bpt_tu_3_diem derives simplified integer inequality', () => {
  const p1: [Fraction, Fraction] = [new Fraction(3), new Fraction(0)];
  const p2: [Fraction, Fraction] = [new Fraction(0), new Fraction(2)];
  const qOrigin: [Fraction, Fraction] = [new Fraction(0), new Fraction(0)];
  assert.equal(bpt_tu_3_diem(p1, p2, qOrigin), '2x+3y<6');

  const qAbove: [Fraction, Fraction] = [new Fraction(4), new Fraction(4)];
  assert.equal(bpt_tu_3_diem(p1, p2, qAbove), '2x+3y>6');
});

test('tao_canh builds scene, finds exact intersection, places marked points, and generates TikZ', () => {
  const canh = tao_canh(
    -5,
    5,
    -5,
    5,
    [
      { text: '2x+3y<6', mau: 'blue', to_mau: false, goc: null, kc: 3, vi_tri: 0.75, hien_nhan: true },
      { text: 'x>0', mau: 'cyan', to_mau: true, do_dam: 25, vi_tri: 0.25, hien_nhan: true },
    ],
    {
      diem: [['pt-1', 'A', new Fraction(0), new Fraction(2), [0, 1]]],
      hien_ten_diem: true,
    }
  );

  assert.equal(canh.ham.length, 2);
  assert.equal(canh.giao_diem.length, 1);
  assert.equal(canh.giao_diem[0].x.toString(), '0');
  assert.equal(canh.giao_diem[0].y.toString(), '2');
  assert.equal(canh.diem_phu.length, 1);
  assert.equal(canh.diem_phu[0].ten, 'A');

  const tikz = tao_tikz(canh, true);
  assert.match(tikz, /\\begin\{tikzpicture\}/);
  assert.match(tikz, /pattern=\{Lines\[angle=/);
  assert.match(tikz, /fill opacity=0\.25/);
  assert.match(tikz, /\\fill \(0,2\) circle\(1\.5pt\) node\[shift=/);
  assert.match(tikz, /\\end\{tikzpicture\}/);
});

test('tu_dong_khung encloses axis and boundary intersections', () => {
  const [xmin, xmax, ymin, ymax] = tu_dong_khung([
    { text: 'x+y<10' },
    { text: '2x-y<8' },
  ]);
  assert.ok(xmin < 0 && xmax >= 10);
  assert.ok(ymin < 0 && ymax >= 10);
});

test('ten_diem_ranh skips O and increments suffixes after alphabet exhausted', () => {
  assert.equal(ten_diem_ranh([]), 'A');
  assert.equal(ten_diem_ranh(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']), 'P');
  assert.equal(ten_tex_diem('B1'), 'B_{1}');
});

test('drag helpers compute exact rotated/translated lines and grid rounding', () => {
  const moved = duong_theo_diem(
    {
      0: { q: [new Fraction(3), new Fraction(0)], ori: [new Fraction(-2), new Fraction(-3)] },
      1: { q: null, ori: [new Fraction(1), new Fraction(0)] },
    },
    [new Fraction(1), new Fraction(2)]
  );
  assert.ok(moved !== null);
  const [a0, b0, c0] = chuan_so_nguyen(...moved[0]);
  assert.equal(bpt_tu_he_so(a0, b0, c0), 'x+y<3');
  assert.equal(bpt_tu_he_so(...chuan_so_nguyen(...moved[1])), 'x>1');

  const snapped = lam_tron_luoi(new Fraction(13, 10), new Fraction(1), 2);
  assert.equal(snapped.toString(), '3/2');
  assert.equal(ucln_phan_so(new Fraction(2), new Fraction(3)).toString(), '1');
  const [fx, fy] = diem_tu_luoi(1.4, 2.6, ExactDecimal.parse('1'), ExactDecimal.parse('1'), 1);
  assert.equal(fx.toString(), '1');
  assert.equal(fy.toString(), '3');
  const proj = diem_gan_tren_duong(
    [new Fraction(-2), new Fraction(-3), new Fraction(6)],
    0.1,
    1.95,
    ExactDecimal.parse('1'),
    ExactDecimal.parse('1'),
    1
  );
  assert.ok(proj !== null);
  assert.equal(proj[2].toString(), '0');
  assert.equal(proj[3].toString(), '2');
});
