# -*- coding: utf-8 -*-
"""
Hộp thoại "Hệ bất phương trình bậc nhất hai ẩn" -> sinh mã TikZ.

Cấu trúc file
  1. Phần tính toán (không dùng Qt): phân tích bất phương trình, chọn bước chia
     trục (tỉ lệ cho số rất lớn / rất nhỏ), cắt miền theo khung nhìn, sinh mã TikZ.
  2. Phần giao diện (PyQt6): khung xem trước vẽ bằng QPainter từ CÙNG dữ liệu với
     mã TikZ, danh sách hàm có thêm / xóa / di chuyển, thông số riêng từng hàm
     (màu, kiểu thể hiện: gạch sọc hoặc tô màu, góc nghiêng và khoảng cách gạch sọc,
     độ đậm khi tô màu, vị trí nhãn trên đường, ẩn / hiện nhãn). Khung mã TikZ có
     tô màu cú pháp, tab = 0,6 cm; mã sinh ra có dòng ghi chú cho từng hàm (bật / tắt
     được). Có thể nhập một hàm bằng cách click 2 điểm trên đường biên và 1 điểm trong
     miền nghiệm ngay trên hình xem trước; khi click gần giao điểm của hai đường biên
     (vòng tròn cam) thì lấy đúng giao điểm đó (chính xác, không làm tròn theo lưới).
     Giao điểm của các đường biên KHÔNG tự vẽ. Ở chế độ "Thêm / xóa điểm", rê chuột tới chỗ hai đường cắt nhau
     (hoặc tới một đường) thì điểm hiện lên; bấm để đánh dấu thành chấm tròn có tên A, B, C... (theo thứ tự thêm),
     cả trên hình xem trước lẫn trong mã TikZ; bấm vào điểm đã đánh dấu (hoặc chuột phải) để xóa.
     Mỗi đường biên chỉ gắn tối đa 2 điểm. Ở chế độ "Kéo điểm", kéo một điểm thì các đường đi qua điểm đổi theo:
     đường còn một điểm khác thì xoay quanh điểm đó, đường chỉ có điểm này thì tịnh tiến.
     Cửa sổ có nút thu nhỏ / phóng to; có nút sao chép mã TikZ vào clipboard.
     Bố cục nút: 8 nút lệnh xếp 2 dòng x 4 cột (dòng 1: Thực hiện, Sao chép TikZ, Hoàn tác, Làm lại; dòng 2: Lưu dự án,
     Mở dự án, Mặc định, Ẩn cửa sổ), có biểu tượng, chú thích và phím tắt. Phía trên hình xem trước cũng 2 dòng: dòng 1 là
     5 nút chọn kiểu tương tác chuột, dòng 2 là cách bắt điểm và nút xóa hết điểm.
     Tab "Hướng dẫn" (phím F1) giải thích cách nhập hàm, khung nhìn, nhập bằng 3 điểm, các kiểu tương tác chuột và phím tắt.
     Con trỏ chuột đổi theo việc một cú bấm / kéo sẽ làm (xem phần \"con trỏ chuột theo ngữ cảnh\" của XemTruoc):
     mũi tên hai đầu vuông góc đường = kéo đường; mũi tên bốn hướng = kéo giao điểm; chữ thập kèm dấu + xanh = thêm điểm;
     chữ thập kèm dấu x đỏ = xóa điểm; bàn tay = kéo điểm; chữ thập kèm số 1 / 2 / 3 = đang nhập hàm bằng 3 điểm.
     Kéo đường biên / giao điểm: trong lúc kéo chỉ vẽ lại hình xem trước (không ghi vào ô nhập, không sinh mã
     TikZ, không hiện nhãn); thả chuột mới bắt vào lưới theo mục "Bắt điểm", ghi hệ số và tính lại đầy đủ.
     Mã TikZ: số lẻ lấy tối đa SO_THAP_PHAN = 2 chữ số thập phân; nhãn có số lẻ in dạng phân số \\frac{p}{q}.

Mã TikZ sinh ra cần:  \\usetikzlibrary{patterns.meta}  (chỉ khi có hàm dùng gạch sọc;
hàm tô màu dùng \\fill[màu,fill opacity=...] nên không cần thư viện bổ sung).
Quy ước: gạch sọc / tô màu phần mặt phẳng KHÔNG thỏa bất phương trình, phần để trống là nghiệm.
"""
import re
import sys
import math
import json
import uuid
from copy import deepcopy
from pathlib import Path
from dataclasses import dataclass, field, replace
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from typing import Dict, List, Optional, Tuple

from PyQt6.QtCore import Qt, QPointF, QRectF, QRegularExpression, QTimer, pyqtSignal, QSignalBlocker
from PyQt6.QtGui import (
    QBrush, QColor, QCursor, QFont, QFontDatabase, QFontMetricsF, QKeySequence,
    QPainter, QPainterPath, QPalette, QPen, QPixmap, QPolygonF, QShortcut,
    QRegularExpressionValidator, QSyntaxHighlighter, QTextCharFormat, QTextOption,
)
from PyQt6.QtWidgets import (
    QApplication, QButtonGroup, QCheckBox, QComboBox, QDialog, QDoubleSpinBox, QFrame,
    QGridLayout, QGroupBox, QHBoxLayout, QLabel, QLineEdit, QMessageBox,
    QPlainTextEdit, QPushButton, QScrollArea, QSizePolicy, QSpinBox, QStyle,
    QTabWidget, QTextBrowser, QVBoxLayout, QWidget,
)


# =============================================================================
# 1. PHẦN TÍNH TOÁN (không phụ thuộc Qt)
# =============================================================================

class LoiBPT(ValueError):
    """Lỗi do người dùng nhập; nội dung là câu tiếng Việt hiển thị trực tiếp."""


# (tên hiển thị, tên màu xcolor trong TikZ, RGB đúng với xcolor để xem trước giống bản in)
BANG_MAU = [
    ("Black",   "black",   (0, 0, 0)),
    ("Cyan",    "cyan",    (0, 255, 255)),
    ("Green",   "green",   (0, 255, 0)),
    ("Blue",    "blue",    (0, 0, 255)),
    ("Gray",    "gray",    (128, 128, 128)),
    ("Orange",  "orange",  (255, 128, 0)),
    ("Purple",  "purple",  (191, 0, 64)),
    ("Teal",    "teal",    (0, 128, 128)),
    ("Magenta", "magenta", (255, 0, 255)),
]
MAU_RGB = {tikz: rgb for _, tikz, rgb in BANG_MAU}

MAX_VACH = 60            # số khoảng chia tối đa trên mỗi trục
KICH_THUOC_HINH = 6.0    # cm, cạnh dài nhất của hình (như bản gốc)
CM_MOI_PT = 2.54 / 72.27 # 1pt (TeX) tính bằng cm
VI_TRI_NHAN = [0.75, 0.25, 0.6, 0.4]   # vị trí nhãn dọc đường thẳng, xoay vòng
BAN_KINH_BAT = 12.0      # pixel: con trỏ cách giao điểm không quá bán kính này thì bắt vào giao điểm
CHU_CAI_DIEM = "ABCDEFGHIJKLMNPQRSTUVWXYZ"   # tên điểm đánh dấu; bỏ chữ O vì dành cho gốc toạ độ
BK_NHAN_PT = 7.0         # pt: khoảng cách từ chấm điểm đến tâm tên của nó
SO_DIEM_TOI_DA = 2       # mỗi đường biên gắn tối đa bấy nhiêu điểm đánh dấu (2 điểm xác định một đường)

# ---------------------------- phân tích biểu thức ----------------------------
_Dang = Tuple[Fraction, Fraction, Fraction]   # (a, b, c) ~ a*x + b*y + c
_KHONG = Fraction(0)
_MOT = Fraction(1)


def _tach_token(s: str):
    toks = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch in '0123456789.':
            j = i
            while j < len(s) and s[j] in '0123456789.':
                j += 1
            toks.append(('num', s[i:j]))
            i = j
        elif ch in 'xyXY':
            toks.append(('var', ch.lower()))
            i += 1
        elif ch in '+-*/()':
            toks.append((ch, ch))
            i += 1
        else:
            raise LoiBPT(f"Ký tự không hợp lệ: '{ch}'")
    return toks


def _cong(p: _Dang, q: _Dang) -> _Dang:
    return (p[0] + q[0], p[1] + q[1], p[2] + q[2])


def _nhan_hang(p: _Dang, k: Fraction) -> _Dang:
    return (p[0] * k, p[1] * k, p[2] * k)


def _la_hang(p: _Dang) -> bool:
    return p[0] == 0 and p[1] == 0


def _nhan(p: _Dang, q: _Dang) -> _Dang:
    if _la_hang(p):
        return _nhan_hang(q, p[2])
    if _la_hang(q):
        return _nhan_hang(p, q[2])
    raise LoiBPT("Chỉ nhận bất phương trình bậc nhất (không có xy, x², ...)")


def _chia(p: _Dang, q: _Dang) -> _Dang:
    if not _la_hang(q):
        raise LoiBPT("Không chia cho biểu thức chứa x, y")
    if q[2] == 0:
        raise LoiBPT("Chia cho 0")
    return _nhan_hang(p, _MOT / q[2])


class _PhanTich:
    """Đệ quy xuống: expr -> term -> unary -> atom, có nhân ngầm (2x, 2(x+y))."""

    def __init__(self, s: str, ten: str):
        self.ten = ten
        self.toks = _tach_token(s)
        self.i = 0

    def _xem(self):
        return self.toks[self.i][0] if self.i < len(self.toks) else None

    def _lay(self):
        t = self.toks[self.i]
        self.i += 1
        return t

    def chay(self) -> _Dang:
        if not self.toks:
            raise LoiBPT(f"Thiếu {self.ten}")
        v = self._expr()
        if self.i != len(self.toks):
            raise LoiBPT(f"{self.ten.capitalize()} không hợp lệ")
        return v

    def _expr(self) -> _Dang:
        v = self._term()
        while self._xem() in ('+', '-'):
            op = self._lay()[0]
            r = self._term()
            v = _cong(v, r) if op == '+' else _cong(v, _nhan_hang(r, Fraction(-1)))
        return v

    def _term(self) -> _Dang:
        v = self._unary()
        while True:
            t = self._xem()
            if t == '*':
                self._lay()
                v = _nhan(v, self._unary())
            elif t == '/':
                self._lay()
                v = _chia(v, self._unary())
            elif t in ('num', 'var', '('):
                v = _nhan(v, self._unary())      # nhân ngầm
            else:
                return v

    def _unary(self) -> _Dang:
        t = self._xem()
        if t == '+':
            self._lay()
            return self._unary()
        if t == '-':
            self._lay()
            return _nhan_hang(self._unary(), Fraction(-1))
        return self._atom()

    def _atom(self) -> _Dang:
        t = self._xem()
        if t is None:
            raise LoiBPT(f"{self.ten.capitalize()} thiếu toán hạng")
        if t == 'num':
            try:
                val = Fraction(self._lay()[1])
            except ValueError:
                raise LoiBPT("Số không hợp lệ")
            return (_KHONG, _KHONG, val)
        if t == 'var':
            return (_MOT, _KHONG, _KHONG) if self._lay()[1] == 'x' else (_KHONG, _MOT, _KHONG)
        if t == '(':
            self._lay()
            v = self._expr()
            if self._xem() != ')':
                raise LoiBPT("Thiếu dấu ngoặc đóng")
            self._lay()
            return v
        raise LoiBPT(f"{self.ten.capitalize()} không hợp lệ")


def tach_bpt(text: str) -> Tuple[_Dang, _Dang, str]:
    """'2x+3y<6' -> (vế trái, vế phải, dấu), mỗi vế ở dạng (a, b, c) ~ a*x + b*y + c."""
    s = text.replace(' ', '')
    n_lon, n_nho = s.count('>'), s.count('<')
    if n_lon + n_nho != 1:
        raise LoiBPT("Cần đúng một dấu > hoặc <")
    dau = '>' if n_lon else '<'
    trai, phai = s.split(dau)
    L = _PhanTich(trai, "vế trái").chay()
    R = _PhanTich(phai, "vế phải").chay()
    return L, R, dau


def chuan_hoa_bpt(L: _Dang, R: _Dang, dau: str) -> _Dang:
    """Hai vế + dấu -> (a, b, c) sao cho nghiệm là a*x + b*y + c > 0."""
    hieu = _cong(L, _nhan_hang(R, Fraction(-1)))        # L - R
    if dau == '<':
        hieu = _nhan_hang(hieu, Fraction(-1))          # R - L
    if hieu[0] == 0 and hieu[1] == 0:
        raise LoiBPT("Hệ số của x và y đều bằng 0")
    return hieu


def phan_tich_bpt(text: str) -> _Dang:
    """'2x+3y<6' -> (a, b, c) sao cho nghiệm là a*x + b*y + c > 0."""
    L, R, dau = tach_bpt(text)
    return chuan_hoa_bpt(L, R, dau)


# ------------------- nhãn đường biên: số lẻ in dạng phân số -------------------

def _so_tex(f: Fraction) -> str:
    """|f| dạng LaTeX: 3 -> '3', 1/2 -> '\\frac{1}{2}'."""
    f = abs(f)
    if f.denominator == 1:
        return str(f.numerator)
    return f"{LENH_PHAN_SO}{{{f.numerator}}}{{{f.denominator}}}"


def _so_van(f: Fraction, sau_la_bien: bool) -> str:
    """|f| dạng chữ thường cho hình xem trước: 1/2 -> '1/2', hoặc '(1/2)' nếu đứng trước x, y."""
    f = abs(f)
    if f.denominator == 1:
        return str(f.numerator)
    s = f"{f.numerator}/{f.denominator}"
    return f"({s})" if sau_la_bien else s


def _dang_tex_van(p: _Dang) -> Tuple[str, str]:
    """(a, b, c) -> (LaTeX, chữ thường) của biểu thức a*x + b*y + c, hệ số lẻ viết thành phân số."""
    tex = van = ''
    for k, ten in ((p[0], 'x'), (p[1], 'y'), (p[2], '')):
        if k == 0:
            continue
        dau = '-' if k < 0 else ('+' if tex else '')
        if ten and abs(k) == 1:
            ht = hv = ''
        else:
            ht, hv = _so_tex(k), _so_van(k, bool(ten))
        tex += f"{dau}{ht}{ten}"
        van += f"{dau}{hv}{ten}"
    return (tex, van) if tex else ('0', '0')


def nhan_tu_dang(L: _Dang, R: _Dang) -> Tuple[str, str]:
    """Hai vế -> (nhãn LaTeX, nhãn xem trước) dạng 'vế trái = vế phải'; số lẻ in thành phân số."""
    lt, lv = _dang_tex_van(L)
    rt, rv = _dang_tex_van(R)
    return f"{lt}={rt}", f"{lv}={rv}"


# ------------------------------ số và định dạng ------------------------------

def doc_so(text: str, ten: str) -> float:
    t = text.strip().replace(',', '.')
    if not t:
        raise LoiBPT(f"{ten}: chưa nhập")
    try:
        v = float(t)
    except ValueError:
        raise LoiBPT(f"{ten}: '{text.strip()}' không phải là số")
    if not math.isfinite(v) or abs(v) > 1e15:
        raise LoiBPT(f"{ten}: giá trị quá lớn (tối đa 1e15)")
    return v


def doc_buoc(text: str, ten: str) -> Decimal:
    t = text.strip().replace(',', '.')
    if not t:
        raise LoiBPT(f"{ten}: chưa nhập")
    try:
        d = Decimal(t)
    except InvalidOperation:
        raise LoiBPT(f"{ten}: '{text.strip()}' không phải là số")
    if not d.is_finite() or d <= 0:
        raise LoiBPT(f"{ten} phải là số dương")
    return d


SO_THAP_PHAN = 2         # số chữ số thập phân tối đa của toạ độ trong mã TikZ (số lẻ lấy 2 chữ số)
LENH_PHAN_SO = "\\frac"  # lệnh viết phân số trong nhãn TikZ (đổi thành "\\dfrac" nếu đã nạp amsmath và muốn phân số to hơn)


def so(v: float, nd: int = SO_THAP_PHAN) -> str:
    """Số thực -> chuỗi gọn cho TikZ (tối đa nd chữ số thập phân, bỏ số 0 thừa, không bao giờ ra '-0')."""
    s = f"{v:.{nd}f}".rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


_SUP = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")


def dinh_dang_nhan(d: Decimal) -> Tuple[str, str]:
    """Số trên trục -> (LaTeX, chữ thường để xem trước).
    Từ 0.001 đến dưới 100000 viết thường; ngoài khoảng đó viết dạng m·10^n."""
    if d == 0:
        return "0", "0"
    dau = '-' if d < 0 else ''
    d = abs(d).normalize()
    e = d.adjusted()
    if -3 <= e < 5:
        s = dau + format(d, 'f')
        return s, s
    mant = format(d.scaleb(-e).normalize(), 'f')
    mu = str(e).translate(_SUP)
    if mant == '1':
        return f"{dau}10^{{{e}}}", f"{dau}10{mu}"
    return f"{dau}{mant}\\cdot 10^{{{e}}}", f"{dau}{mant}·10{mu}"


def buoc_dep(khoang: float, muc_tieu: int = 12) -> Decimal:
    """Bước chia dạng 1, 2, 5 × 10^k sao cho trục có chừng 5–12 khoảng."""
    raw = khoang / muc_tieu
    e = math.floor(math.log10(raw))
    mag = Decimal(1).scaleb(e)
    for m in (1, 2, 5, 10):
        d = mag * m
        if float(d) >= raw * (1 - 1e-9):
            return d
    return mag * 10


# ----------------------------- dữ liệu của hình -----------------------------

@dataclass
class Ham:
    """Thông tin nhập cho một bất phương trình."""
    text: str
    mau: str = 'blue'              # tên màu TikZ
    goc: Optional[float] = None    # None = tự động (vuông góc ~ đường biên + 60°)
    kc: float = 3.0                # khoảng cách giữa hai gạch sọc (pt)
    vi_tri: Optional[float] = None # vị trí nhãn dọc đường biên, 0..1 (None = tự động xoay vòng)
    hien_nhan: bool = True         # False: không ghi nhãn trên đường
    to_mau: bool = False           # True: tô màu (trong suốt) thay cho gạch sọc
    do_dam: float = 25.0           # độ đậm khi tô màu, % (100 = màu đặc)
    he_so: Optional[Tuple[Fraction, Fraction, Fraction]] = None
    # he_so != None: dùng thẳng (a, b, c) (nghiệm a*x + b*y + c > 0) thay cho việc phân tích `text`.
    # Dùng khi kéo hình: vẽ lại ngay từ hệ số mà không phải ghi ngược vào ô nhập.


@dataclass
class Vach:
    k: int               # vị trí theo đơn vị bước chia
    tex: str             # nhãn LaTeX
    van: str             # nhãn chữ thường (xem trước)
    co_nhan: bool = True # False: chỉ vẽ vạch, bỏ nhãn cho đỡ chồng lên nhau


@dataclass
class HamHinh:
    chi_so: int
    mau: str
    goc: float
    kc: float
    da_giac: List[Tuple[float, float]]          # miền gạch sọc (toạ độ lưới u, v)
    doan: Optional[Tuple[Tuple[float, float], Tuple[float, float]]]   # đường biên trong khung
    nhan: str
    vi_tri_nhan: float
    nhan_phia_tren: bool
    bpt: str = ''                               # bất phương trình gốc (dùng cho ghi chú TikZ)
    an_nhan: bool = False                       # người dùng chọn ẩn nhãn
    to_mau: bool = False                        # True: tô màu thay cho gạch sọc
    do_dam: float = 25.0                        # độ đậm khi tô màu (%)
    nhan_van: str = ''                          # nhãn chữ thường cho hình xem trước (phân số viết p/q)
    he: Optional[Tuple[Fraction, Fraction, Fraction]] = None   # (a, b, c) của đường biên a*x + b*y + c = 0


@dataclass
class GiaoDiem:
    """Giao điểm của hai (hoặc nhiều) đường biên nằm trong khung nhìn."""
    x: Fraction                     # toạ độ thật, chính xác
    y: Fraction
    u: float                        # toạ độ lưới (x / bước_x, y / bước_y)
    v: float
    ham: Tuple[int, ...]            # chỉ số các hàm có đường biên đi qua điểm này
    # Giao điểm KHÔNG tự vẽ: chỉ dùng để bắt điểm khi người dùng rê chuột tới chỗ hai đường cắt nhau.


@dataclass
class DiemPhu:
    """Điểm đánh dấu do người dùng đặt, gắn với một hoặc hai đường biên (giao điểm của hai đường, hoặc điểm trên một đường)."""
    ma: str                         # mã nhận diện (dùng khi xóa, khi kéo)
    ten: str                        # tên điểm: A, B, C, ... (cấp theo thứ tự thêm, lưu cố định)
    ten_tex: str                    # tên viết bằng LaTeX (A_{1}, B_{1}, ... khi hết chữ cái)
    x: Fraction                     # toạ độ thật, chính xác (suy ra từ các đường gắn với điểm)
    y: Fraction
    u: float                        # toạ độ lưới
    v: float
    ham: Tuple[int, ...] = ()       # chỉ số các hàm mà điểm gắn vào (chỉ tính hàm còn hợp lệ)
    goc_nhan: float = 45.0          # hướng đặt tên quanh chấm, độ (hệ toạ độ lưới), tránh các đường


@dataclass
class Canh:
    """Toàn bộ dữ liệu để vẽ. Toạ độ u = x / bước_x, v = y / bước_y."""
    buoc_x: Decimal
    buoc_y: Decimal
    umin: float
    umax: float
    vmin: float
    vmax: float
    lu: float                       # cm trên một đơn vị lưới
    kx: Tuple[int, int]
    ky: Tuple[int, int]
    vach_x: List[Vach] = field(default_factory=list)
    vach_y: List[Vach] = field(default_factory=list)
    ham: List[HamHinh] = field(default_factory=list)
    loi: Dict[int, str] = field(default_factory=dict)   # chỉ số hàm -> thông báo lỗi
    giao_diem: List[GiaoDiem] = field(default_factory=list)   # giao điểm các đường biên trong khung (không vẽ)
    diem_phu: List[DiemPhu] = field(default_factory=list)     # điểm đánh dấu của người dùng (vẽ thành chấm tròn)
    hien_ten_diem: bool = True      # True: ghi tên (A, B, C, ...) cạnh mỗi điểm đánh dấu
    hien_so: bool = True            # True: ghi số trên hai trục
    hien_gach: bool = True          # True: vẽ gạch (vạch chia) trên hai trục


# --------------------------------- hình học ---------------------------------

def _cat_nua_mat_phang(poly, a, b, c):
    """Giữ phần đa giác thỏa a*u + b*v + c <= 0 (Sutherland–Hodgman)."""
    ra = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp = a * p[0] + b * p[1] + c
        fq = a * q[0] + b * q[1] + c
        p_trong, q_trong = fp <= 0, fq <= 0
        if p_trong:
            ra.append(p)
        if p_trong != q_trong:
            t = fp / (fp - fq)
            ra.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return ra


def _don_gian(poly):
    ra = []
    for p in poly:
        if not ra or abs(p[0] - ra[-1][0]) > 1e-9 or abs(p[1] - ra[-1][1]) > 1e-9:
            ra.append(p)
    if len(ra) > 1 and abs(ra[0][0] - ra[-1][0]) <= 1e-9 and abs(ra[0][1] - ra[-1][1]) <= 1e-9:
        ra.pop()
    if len(ra) < 3:
        return []
    dien_tich = 0.0
    for i in range(len(ra)):
        p, q = ra[i], ra[(i + 1) % len(ra)]
        dien_tich += p[0] * q[1] - q[0] * p[1]
    return ra if abs(dien_tich) / 2 > 1e-9 else []


def _doan_thang(a, b, c, umin, umax, vmin, vmax):
    """Phần đường thẳng a*u + b*v + c = 0 nằm trong khung (Liang–Barsky).
    (a, b) đã chuẩn hóa độ dài 1. Trả về (P, Q) với P ở bên trái (hoặc bên dưới nếu thẳng đứng)."""
    x0, y0 = -a * c, -b * c
    dx, dy = -b, a
    t0, t1 = -math.inf, math.inf
    for p, q in ((-dx, x0 - umin), (dx, umax - x0), (-dy, y0 - vmin), (dy, vmax - y0)):
        if abs(p) < 1e-12:
            if q < 0:
                return None
        else:
            r = q / p
            if p < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
    if not t0 < t1 - 1e-9:
        return None
    P = (x0 + t0 * dx, y0 + t0 * dy)
    Q = (x0 + t1 * dx, y0 + t1 * dy)
    if abs(Q[0] - P[0]) < 1e-9:
        if Q[1] < P[1]:
            P, Q = Q, P
    elif Q[0] < P[0]:
        P, Q = Q, P
    return P, Q


def _thua_nhan(vach: List[Vach], lu: float, ngang: bool):
    """Nếu nhãn dài hơn khoảng cách giữa hai vạch thì chỉ ghi nhãn ở các vạch k chia hết cho m."""
    if not vach:
        return
    kc_pt = lu / CM_MOI_PT                    # khoảng cách hai vạch, đơn vị pt
    can = (max(len(v.van) for v in vach) * 2.4 + 3.0) if ngang else 7.0   # chữ \tiny ~ 5pt
    m = max(1, math.ceil(can / kc_pt))
    for v in vach:
        v.co_nhan = (v.k % m == 0)


def _goc_dat_ten(duong: List[float], u: float, v: float,
                 umin: float, umax: float, vmin: float, vmax: float, lu: float) -> float:
    """Hướng (độ, hệ toạ độ lưới) để đặt tên điểm quanh chấm tại (u, v): xa các đường đi qua điểm
    (`duong` là góc của các đường đó, độ) nhất có thể, ưu tiên phía trên bên phải (45°),
    và giữ tên nằm trong khung nhìn nếu còn chỗ."""
    r = BK_NHAN_PT * CM_MOI_PT / lu              # từ chấm đến tâm tên, đổi sang đơn vị lưới
    for trong in (True, False):                  # lần 1: bắt buộc nằm trong khung; lần 2: bỏ ràng buộc
        tot, tot_diem = None, -math.inf
        for goc in range(0, 360, 15):
            cu = u + r * math.cos(math.radians(goc))
            cv = v + r * math.sin(math.radians(goc))
            if trong and not (umin - 1e-9 <= cu <= umax + 1e-9 and vmin - 1e-9 <= cv <= vmax + 1e-9):
                continue
            xa = min((abs((goc - d + 90.0) % 180.0 - 90.0) for d in duong), default=90.0)
            lech = abs((goc - 45.0 + 180.0) % 360.0 - 180.0)
            diem = xa - 0.001 * lech             # hòa nhau thì chọn hướng gần 45° hơn
            if diem > tot_diem:
                tot, tot_diem = float(goc), diem
        if tot is not None:
            return tot
    return 45.0


def _tim_giao_diem(dg, sx: float, sy: float,
                   umin: float, umax: float, vmin: float, vmax: float) -> List[GiaoDiem]:
    """Giao điểm (chính xác, dạng Fraction) của từng cặp đường biên, chỉ giữ các điểm nằm trong khung.
    dg: danh sách (chỉ số hàm, a, b, c) với đường biên a*x + b*y + c = 0 (a, b, c kiểu Fraction).
    Nhiều đường cùng đi qua một điểm thì gộp thành một giao điểm. Chỉ để bắt điểm, không tự vẽ."""
    diem: Dict[Tuple[Fraction, Fraction], set] = {}
    for m in range(len(dg)):
        i, a1, b1, c1 = dg[m]
        for n in range(m + 1, len(dg)):
            j, a2, b2, c2 = dg[n]
            det = a1 * b2 - a2 * b1
            if det == 0:                       # song song hoặc trùng nhau: không có giao điểm duy nhất
                continue
            x = (b1 * c2 - b2 * c1) / det
            y = (a2 * c1 - a1 * c2) / det
            try:
                u, v = float(x) / sx, float(y) / sy
            except OverflowError:
                continue
            if umin - 1e-9 <= u <= umax + 1e-9 and vmin - 1e-9 <= v <= vmax + 1e-9:
                diem.setdefault((x, y), set()).update((i, j))
    ra = []
    for (x, y), ds in sorted(diem.items()):
        ra.append(GiaoDiem(x, y, float(x) / sx, float(y) / sy, tuple(sorted(ds))))
    return ra


# ------------------- điểm đánh dấu do người dùng đặt -------------------
# Mỗi điểm lưu: vị trí gợi ý (x, y) và danh sách đường biên nó gắn vào (1 hoặc 2 đường).
# Vị trí hiển thị được SUY RA từ các đường đó nên điểm luôn nằm trên đường, dù đường bị kéo hay sửa phương trình:
#   - gắn với từ 2 đường không song song trở lên: là giao điểm của 2 đường đầu tiên;
#   - gắn với 1 đường: là hình chiếu của vị trí gợi ý lên đường (đường tịnh tiến thì điểm trượt theo pháp tuyến).
# Mỗi đường chỉ có tối đa SO_DIEM_TOI_DA điểm gắn vào: đó là 2 điểm xác định đường (kéo điểm thì đường đổi theo).

def ten_diem_ranh(da_dung) -> str:
    """Tên chưa dùng: A, B, C, ... (bỏ O), hết chữ cái thì A1, B1, ..."""
    da_dung = set(da_dung)
    for q in range(1000):
        for ch in CHU_CAI_DIEM:
            ten = ch + (str(q) if q else '')
            if ten not in da_dung:
                return ten
    return 'A'


def ten_tex_diem(ten: str) -> str:
    """'A' -> 'A'; 'B1' -> 'B_{1}'."""
    return ten if len(ten) <= 1 else f"{ten[0]}_{{{ten[1:]}}}"


def vi_tri_diem(x: Fraction, y: Fraction, cac_he) -> Optional[Tuple[Fraction, Fraction]]:
    """Vị trí (chính xác) của điểm có vị trí gợi ý (x, y) khi gắn với các đường a*x + b*y + c = 0 trong `cac_he`.
    None nếu không còn đường nào."""
    cac_he = list(cac_he)
    if not cac_he:
        return None
    for m in range(len(cac_he)):
        a1, b1, c1 = cac_he[m]
        for n in range(m + 1, len(cac_he)):
            a2, b2, c2 = cac_he[n]
            det = a1 * b2 - a2 * b1
            if det != 0:
                return (b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det
    a, b, c = cac_he[0]                           # một đường (hoặc các đường song song): chiếu vuông góc lên đường đầu
    d = (a * x + b * y + c) / (a * a + b * b)
    return x - a * d, y - b * d


def diem_gan_tren_duong(he, u: float, v: float, buoc_x: Decimal, buoc_y: Decimal,
                        chia: int = 1, ban_kinh: float = 0.5):
    """Điểm trên đường thẳng `he` gần vị trí (u, v) (toạ độ lưới) nhất, chính xác dạng Fraction.
    Ưu tiên điểm lưới (cả hai toạ độ là bội của bước chia / chia) nếu nằm cách hình chiếu của (u, v)
    không quá `ban_kinh` đơn vị lưới; nếu không thì làm tròn một toạ độ theo lưới, toạ độ kia suy ra từ đường.
    Trả về (trục, t, x, y); None nếu đường thẳng suy biến."""
    a, b, c = (Fraction(h) for h in he)
    bx, by = Fraction(buoc_x), Fraction(buoc_y)
    sx, sy = float(bx), float(by)
    au, bu, cu = float(a) * sx, float(b) * sy, float(c)
    n2 = au * au + bu * bu
    if not (n2 > 0 and math.isfinite(n2) and math.isfinite(cu)):
        return None
    d = (au * u + bu * v + cu) / n2
    up, vp = u - au * d, v - bu * d              # hình chiếu của (u, v) lên đường thẳng (hệ lưới)
    chia = max(1, int(chia))
    qx, qy = bx / chia, by / chia
    truc = 'x' if abs(bu) >= abs(au) else 'y'    # đường thiên về ngang -> trượt theo x, thiên về dọc -> theo y
    ung_vien = []
    if truc == 'x':
        j0 = round(up * sx / float(qx))
        for j in range(j0 - 6, j0 + 7):
            x = j * qx
            ung_vien.append((x, -(a * x + c) / b))
    else:
        i0 = round(vp * sy / float(qy))
        for i in range(i0 - 6, i0 + 7):
            y = i * qy
            ung_vien.append((-(b * y + c) / a, y))
    tot, tot_kc = None, ban_kinh
    for x, y in ung_vien:
        if (x / qx).denominator != 1 or (y / qy).denominator != 1:
            continue                              # không phải điểm lưới
        kc = math.hypot(float(x) / sx - up, float(y) / sy - vp)
        if kc <= tot_kc:
            tot, tot_kc = (x, y), kc
    if tot is None:                               # không có điểm lưới gần: làm tròn theo trục trượt
        tot = ung_vien[6]                         # ứng viên j0 (hoặc i0) ở giữa danh sách
    x, y = tot
    return truc, (x if truc == 'x' else y), x, y


def _tao_diem_phu(ds, he_ham: Dict[int, Tuple[Fraction, Fraction, Fraction]],
                  sx: float, sy: float,
                  umin: float, umax: float, vmin: float, vmax: float, lu: float) -> List[DiemPhu]:
    """ds: danh sách (mã, tên, x gợi ý, y gợi ý, chỉ số các hàm gắn vào). Điểm không còn hàm hợp lệ nào để gắn,
    hoặc nằm ngoài khung nhìn thì không vẽ (vẫn giữ trong dữ liệu của hộp thoại)."""
    ra: List[DiemPhu] = []
    for ma, ten, x0, y0, idx in ds or []:
        gan = tuple(i for i in idx if i in he_ham)
        kq = vi_tri_diem(Fraction(x0), Fraction(y0), [he_ham[i] for i in gan])
        if kq is None:
            continue
        x, y = kq
        try:
            u, v = float(x) / sx, float(y) / sy
        except OverflowError:
            continue
        if not (umin - 1e-9 <= u <= umax + 1e-9 and vmin - 1e-9 <= v <= vmax + 1e-9):
            continue
        # hướng của mỗi đường đi qua điểm; điểm nằm trên trục thì trục cũng là một đường
        huong = [math.degrees(math.atan2(float(he_ham[i][0]) * sx, -float(he_ham[i][1]) * sy)) for i in gan]
        if abs(u) < 1e-9:
            huong.append(90.0)
        if abs(v) < 1e-9:
            huong.append(0.0)
        ra.append(DiemPhu(ma, ten, ten_tex_diem(ten), x, y, u, v, gan,
                          _goc_dat_ten(huong, u, v, umin, umax, vmin, vmax, lu)))
    return ra


def tao_canh(xmin: float, xmax: float, ymin: float, ymax: float,
             ds_ham: List[Ham],
             buoc_x: Optional[Decimal] = None,
             buoc_y: Optional[Decimal] = None,
             hien_so: bool = True,
             hien_gach: bool = True,
             diem: Optional[List[Tuple[str, str, Fraction, Fraction, Tuple[int, ...]]]] = None,
             hien_ten_diem: bool = True) -> Canh:
    """Tính toàn bộ hình. Ném LoiBPT nếu khung nhìn / bước chia sai.
    Lỗi của từng hàm không ném ra mà ghi vào Canh.loi để các hàm còn lại vẫn vẽ.
    diem: các điểm đánh dấu, mỗi phần tử (mã, tên, x gợi ý, y gợi ý, chỉ số các hàm gắn vào)."""
    if not (xmin < 0 < xmax):
        raise LoiBPT("Cần X min < 0 < X max")
    if not (ymin < 0 < ymax):
        raise LoiBPT("Cần Y min < 0 < Y max")
    bx = buoc_x if buoc_x is not None else buoc_dep(xmax - xmin)
    by = buoc_y if buoc_y is not None else buoc_dep(ymax - ymin)
    try:
        sx, sy = float(bx), float(by)
    except OverflowError:
        raise LoiBPT("Bước chia quá lớn")
    if not (0 < sx < 1e300 and 0 < sy < 1e300):
        raise LoiBPT("Bước chia quá nhỏ hoặc quá lớn")

    umin, umax = xmin / sx, xmax / sx
    vmin, vmax = ymin / sy, ymax / sy
    nx, ny = umax - umin, vmax - vmin
    if nx > MAX_VACH or ny > MAX_VACH:
        raise LoiBPT(f"Bước chia quá nhỏ so với khung (quá {MAX_VACH} khoảng). "
                     "Hãy tăng bước chia hoặc bật 'Tự chia vạch'")
    lu = round(min(2.0, max(0.15, KICH_THUOC_HINH / max(nx, ny))), 2)

    kx = (math.ceil(umin - 1e-9), math.floor(umax + 1e-9))
    ky = (math.ceil(vmin - 1e-9), math.floor(vmax + 1e-9))
    canh = Canh(bx, by, umin, umax, vmin, vmax, lu, kx, ky,
                hien_so=hien_so, hien_gach=hien_gach, hien_ten_diem=hien_ten_diem)
    for k in range(kx[0], kx[1] + 1):
        if k:
            t, v = dinh_dang_nhan(Decimal(k) * bx)
            canh.vach_x.append(Vach(k, t, v))
    for k in range(ky[0], ky[1] + 1):
        if k:
            t, v = dinh_dang_nhan(Decimal(k) * by)
            canh.vach_y.append(Vach(k, t, v))
    _thua_nhan(canh.vach_x, lu, ngang=True)
    _thua_nhan(canh.vach_y, lu, ngang=False)

    khung = [(umin, vmax), (umin, vmin), (umax, vmin), (umax, vmax)]
    dem = 0
    dg = []                                      # (chỉ số hàm, a, b, c) của các hàm hợp lệ
    for i, h in enumerate(ds_ham):
        if not h.text.strip():
            continue
        try:
            if h.he_so is not None:              # đang kéo hình: dùng thẳng hệ số, không phân tích chuỗi
                a, b, c = (Fraction(v) for v in h.he_so)
                if a == 0 and b == 0:
                    raise LoiBPT("Hệ số của x và y đều bằng 0")
                ve_trai, ve_phai, sinh_lai = (a, b, _KHONG), (_KHONG, _KHONG, -c), True
            else:
                ve_trai, ve_phai, dau = tach_bpt(h.text)
                a, b, c = chuan_hoa_bpt(ve_trai, ve_phai, dau)
                # có số thập phân hoặc phân số trong bất phương trình: viết lại nhãn bằng phân số
                sinh_lai = any(ch in h.text for ch in './')
            try:
                au, bu, cu = float(a) * sx, float(b) * sy, float(c)
            except OverflowError:
                raise LoiBPT("Hệ số quá lớn")
            n = math.hypot(au, bu)
            if not (n > 0 and math.isfinite(n) and math.isfinite(cu)):
                raise LoiBPT("Hệ số quá nhỏ hoặc quá lớn so với bước chia")
        except LoiBPT as e:
            canh.loi[i] = str(e)
            continue
        an, bn, cn = au / n, bu / n, cu / n      # f(u,v) = khoảng cách có dấu tới đường biên

        # nghiệm: f > 0  ->  gạch sọc phần f < 0
        da_giac = _don_gian(_cat_nua_mat_phang(khung, an, bn, cn))
        doan = _doan_thang(an, bn, cn, umin, umax, vmin, vmax)

        if h.goc is None:
            phi = math.degrees(math.atan2(an, -bn)) % 180.0
            goc = round((phi + 60.0) % 180.0, 1)
        else:
            goc = float(h.goc) % 180.0

        if sinh_lai:
            nhan, nhan_van = nhan_tu_dang(ve_trai, ve_phai)       # số lẻ -> \frac{p}{q}
        else:
            nhan = h.text.replace(' ', '').replace('>', '=').replace('<', '=').replace('*', '')
            nhan_van = nhan
        if c == 0 and (a == 0 or b == 0):
            nhan = nhan_van = ''                 # trùng trục tọa độ: không ghi nhãn
        if not h.hien_nhan:
            nhan = nhan_van = ''                 # người dùng chọn ẩn nhãn
        if h.vi_tri is None:
            vt = VI_TRI_NHAN[dem % len(VI_TRI_NHAN)]
        else:
            vt = min(1.0, max(0.0, float(h.vi_tri)))
        phia_tren = False
        if doan:
            dx, dy = doan[1][0] - doan[0][0], doan[1][1] - doan[0][1]
            # pháp tuyến trái = (-dy, dx); nhãn đặt phía bị gạch sọc (như bản gốc)
            phia_tren = (-dy * an + dx * bn) < 0
        do_dam = min(100.0, max(1.0, float(h.do_dam)))
        canh.ham.append(HamHinh(i, h.mau, goc, h.kc, da_giac, doan, nhan, vt, phia_tren,
                                bpt=h.text.replace(' ', ''), an_nhan=not h.hien_nhan,
                                to_mau=bool(h.to_mau), do_dam=do_dam, nhan_van=nhan_van,
                                he=(a, b, c)))
        dg.append((i, a, b, c))
        dem += 1
    canh.giao_diem = _tim_giao_diem(dg, sx, sy, umin, umax, vmin, vmax)
    canh.diem_phu = _tao_diem_phu(diem, {i: (a, b, c) for i, a, b, c in dg},
                                  sx, sy, umin, umax, vmin, vmax, lu)
    return canh


def tu_dong_khung(ds_ham: List[Ham]) -> Tuple[float, float, float, float]:
    """Chọn khung nhìn chứa các giao điểm với trục và giao điểm giữa các đường biên."""
    dg = []
    for h in ds_ham:
        try:
            a, b, c = phan_tich_bpt(h.text)
            dg.append((float(a), float(b), float(c)))
        except (LoiBPT, OverflowError):
            continue
    xs, ys = [0.0], [0.0]
    for a, b, c in dg:
        if a:
            xs.append(-c / a)
        if b:
            ys.append(-c / b)
    mx = max(abs(v) for v in xs) or 1.0
    my = max(abs(v) for v in ys) or 1.0
    for i in range(len(dg)):
        for j in range(i + 1, len(dg)):
            a1, b1, c1 = dg[i]
            a2, b2, c2 = dg[j]
            det = a1 * b2 - a2 * b1
            if abs(det) <= 1e-12 * (abs(a1 * b2) + abs(a2 * b1)):
                continue
            x = (b1 * c2 - b2 * c1) / det
            y = (a2 * c1 - a1 * c2) / det
            if abs(x) <= 10 * mx and abs(y) <= 10 * my:     # bỏ giao điểm quá xa
                xs.append(x)
                ys.append(y)
    lo_x, hi_x, lo_y, hi_y = min(xs), max(xs), min(ys), max(ys)
    dx, dy = hi_x - lo_x, hi_y - lo_y
    if dx == 0 and dy == 0:
        return -5.0, 5.0, -5.0, 5.0
    if dx == 0:
        lo_x, hi_x = -dy / 2, dy / 2
    if dy == 0:
        lo_y, hi_y = -dx / 2, dx / 2
    return _lam_tron_truc(lo_x, hi_x) + _lam_tron_truc(lo_y, hi_y)


def _lam_tron_truc(lo: float, hi: float) -> Tuple[float, float]:
    lo, hi = min(lo, 0.0), max(hi, 0.0)
    pad = (hi - lo) * 0.15
    lo, hi = lo - pad, hi + pad
    buoc = buoc_dep(hi - lo)
    sb = float(buoc)
    lo_n = float(Decimal(math.floor(lo / sb)) * buoc)
    hi_n = float(Decimal(math.ceil(hi / sb)) * buoc)
    if lo_n >= 0:
        lo_n = -sb
    if hi_n <= 0:
        hi_n = sb
    return lo_n, hi_n


# ---------------------------------- mã TikZ ----------------------------------

def _dong_ve_vach(truc: str, nhan: Optional[str], hien_gach: bool) -> Optional[str]:
    """Một dòng TikZ vẽ gạch và / hoặc số của một vạch chia (biến vòng lặp \\x hoặc \\y).
    nhan: nội dung node (đã gồm $...$ hoặc macro), None = không ghi số. Trả về None nếu chẳng có gì để vẽ."""
    if truc == 'x':
        gach, dau_mut, doi, node = "(\\x,2pt)--(\\x,-2pt)", "(\\x,-2pt)", "+(0,-7pt)", "node"
    else:
        gach, dau_mut, doi, node = "(2pt,\\y)--(-2pt,\\y)", "(-2pt,\\y)", "+(-5pt,0)", "node[anchor=east]"
    if hien_gach and nhan is not None:       # gạch kèm số: số đặt tương đối so với đầu mút của gạch
        return f"\\draw {gach} {doi} {node}{{{nhan}}};"
    if hien_gach:
        return f"\\draw {gach};"
    if nhan is not None:                     # chỉ ghi số: cùng vị trí như khi có gạch, nhưng không vẽ nét
        return f"\\path {dau_mut} {doi} {node}{{{nhan}}};"
    return None


def _tikz_vach(c: Canh, truc: str) -> List[str]:
    vach = c.vach_x if truc == 'x' else c.vach_y
    k0, k1 = c.kx if truc == 'x' else c.ky
    buoc = c.buoc_x if truc == 'x' else c.buoc_y
    if not vach or not (c.hien_so or c.hien_gach):
        return []
    bien = '\\' + truc
    if not c.hien_so or (buoc == 1 and all(v.co_nhan for v in vach)):
        # không ghi số, hoặc nhãn trùng với toạ độ: vòng lặp gọn như bản gốc
        ve = _dong_ve_vach(truc, f"${bien}$" if c.hien_so else None, c.hien_gach)
        return [f"\t\\foreach {bien} in {{{k0},...,{k1}}}{{",
                f"\t\t\\unless\\ifnum{bien}=0",
                "\t\t\t" + ve,
                "\t\t\\fi",
                "\t}"]
    # dạng cặp  vị_trí/nhãn ; nhãn rỗng {} = chỉ vẽ gạch (không ghi số ở vạch đó)
    if c.hien_gach:
        cap = ','.join(f"{v.k}/{{${v.tex}$}}" if v.co_nhan else f"{v.k}/{{}}" for v in vach)
    else:
        cap = ','.join(f"{v.k}/{{${v.tex}$}}" for v in vach if v.co_nhan)
        if not cap:
            return []
    return [f"\t\\foreach {bien}/\\nhan in {{{cap}}}{{",
            "\t\t" + _dong_ve_vach(truc, "\\nhan", c.hien_gach),
            "\t}"]


def _ghi_chu(text: str) -> str:
    """Làm sạch chuỗi đưa vào dòng chú thích TikZ (bỏ '%' và ký tự xuống dòng)."""
    return ' '.join(text.replace('%', ' ').split())


def _phan_so(f: Fraction) -> str:
    """Fraction -> chuỗi gọn cho dòng chú thích: 2 -> '2', Fraction(5, 3) -> '5/3'."""
    return str(f.numerator) if f.denominator == 1 else f"{f.numerator}/{f.denominator}"


def tao_tikz(c: Canh, ghi_chu: bool = True) -> str:
    """Sinh mã TikZ. ghi_chu=True: thêm dòng chú thích (%) cho từng hàm và từng phần."""
    L = [f"\\begin{{tikzpicture}}[>=stealth,x={so(c.lu, 2)}cm,y={so(c.lu, 2)}cm,font=\\tiny]"]

    def gc(dong: str):
        if ghi_chu:
            L.append(dong)

    # 1) gạch sọc / tô màu vẽ trước để không đè lên trục, vạch chia và nhãn
    if c.ham:
        gc("\t% --- Gạch sọc hoặc tô màu phần không thỏa của từng hàm "
           "(vẽ trước để không đè lên trục) ---")
    for h in c.ham:
        ten = f"Hàm {h.chi_so + 1}: {_ghi_chu(h.bpt)}"
        if h.da_giac:
            pts = '--'.join(f"({so(u)},{so(v)})" for u, v in h.da_giac)
            if h.to_mau:
                gc(f"\t% {ten} - tô màu ({h.mau}, độ đậm {so(h.do_dam, 1)}%)")
                L.append(f"\t\\fill[{h.mau},fill opacity={so(h.do_dam / 100, 2)}] {pts}--cycle;")
            else:
                gc(f"\t% {ten} - gạch sọc ({h.mau}, góc {so(h.goc, 1)}°, cách {so(h.kc, 2)}pt)")
                L.append(f"\t\\fill[pattern={{Lines[angle={so(h.goc, 1)},distance={so(h.kc, 2)}pt]}},"
                         f"pattern color={h.mau}!25] {pts}--cycle;")
        else:
            gc(f"\t% {ten} - không có phần nào trong khung cần tô hoặc gạch sọc")
    # 2) trục, vạch chia
    gc("\t% --- Trục tọa độ và vạch chia ---")
    L += [f"\t\\draw[->] ({so(c.umin - 0.5)},0)--({so(c.umax + 0.5)},0) "
          "node[shift={(-85:7pt)},font=\\normalsize]{$x$};",
          f"\t\\draw[->] (0,{so(c.vmin - 0.5)})--(0,{so(c.vmax + 0.5)}) "
          "node[shift={(175:7pt)},font=\\normalsize]{$y$};",
          "\t\\path (0,0) node[shift={(225:9pt)}]{$O$};"]
    L += _tikz_vach(c, 'x')
    L += _tikz_vach(c, 'y')
    # 3) đường biên và nhãn
    if c.ham:
        gc("\t% --- Đường biên và nhãn của từng hàm ---")
    for h in c.ham:
        ten = f"Hàm {h.chi_so + 1}: {_ghi_chu(h.bpt)}"
        if not h.doan:
            gc(f"\t% {ten} - đường biên nằm ngoài khung nhìn nên không vẽ")
            continue
        bien = _ghi_chu(h.bpt).replace('>', '=').replace('<', '=')
        if h.nhan:
            ghi = f"nhãn ở vị trí {round(h.vi_tri_nhan * 100)}%"
        elif h.an_nhan:
            ghi = "đã ẩn nhãn"
        else:
            ghi = "trùng trục tọa độ nên không ghi nhãn"
        gc(f"\t% {ten} - đường biên {bien}, {ghi}")
        (u1, v1), (u2, v2) = h.doan
        nut = ''
        if h.nhan:
            nut = (f" node[sloped,pos={so(h.vi_tri_nhan, 2)},"
                   f"{'above' if h.nhan_phia_tren else 'below'}]{{${h.nhan}$}}")
        L.append(f"\t\\draw[{h.mau}] ({so(u1)},{so(v1)})--({so(u2)},{so(v2)}){nut};")
    # 4) điểm đánh dấu do người dùng đặt: chấm tròn (kèm tên) vẽ sau cùng để nằm trên đường.
    #    Giao điểm các đường biên không tự vẽ; chỉ có điểm người dùng đã bấm thêm.
    if c.diem_phu:
        gc("\t% --- Điểm đánh dấu ---")
        for d in c.diem_phu:
            cac_ham = " ∩ ".join(f"Hàm {i + 1}" for i in d.ham)
            toa_do = f"({_phan_so(d.x)}; {_phan_so(d.y)})"
            quan_he = f"= {cac_ham}" if len(d.ham) >= 2 else f"thuộc {cac_ham}"
            nut = ''
            if c.hien_ten_diem:
                gc(f"\t% Điểm {d.ten} {quan_he}: {toa_do}")
                nut = " node[shift={(%d:%spt)},font=\\scriptsize]{$%s$}" % (
                    round(d.goc_nhan), so(BK_NHAN_PT, 1), d.ten_tex)
            else:
                gc(f"\t% Điểm {quan_he}: {toa_do}")
            L.append(f"\t\\fill ({so(d.u)},{so(d.v)}) circle(1.5pt){nut};")
    L.append("\\end{tikzpicture}")
    return '\n'.join(L) + '\n'


# ------------------ nhập hàm từ 3 điểm click trên hình xem trước ------------------

def diem_tu_luoi(u: float, v: float, buoc_x: Decimal, buoc_y: Decimal,
                 chia: int = 1) -> Tuple[Fraction, Fraction]:
    """Toạ độ lưới (u, v) -> điểm thật (x, y) dạng Fraction (chính xác), bắt vào lưới
    mịn gấp `chia` lần vạch chia (1 = đúng vạch chia, 2 = nửa vạch, 100 = gần như tự do)."""
    ku, kv = Fraction(round(u * chia), chia), Fraction(round(v * chia), chia)
    return ku * Fraction(buoc_x), kv * Fraction(buoc_y)


def _ve_trai(ia: int, ib: int) -> str:
    """(2, -3) -> '2x-3y'; (1, 0) -> 'x'; (0, -1) -> '-y'."""
    ra = ''
    for h, ten in ((ia, 'x'), (ib, 'y')):
        if h == 0:
            continue
        he_so = '' if abs(h) == 1 else str(abs(h))
        if h < 0:
            ra += '-' + he_so + ten
        else:
            ra += ('+' if ra else '') + he_so + ten
    return ra


def bpt_tu_3_diem(p1, p2, q) -> str:
    """Bất phương trình có đường biên đi qua p1, p2 và nhận q làm nghiệm.
    Mỗi điểm là cặp (x, y) kiểu Fraction. Kết quả như '2x+3y>6' (hệ số nguyên tối giản,
    hệ số đầu dương)."""
    (x1, y1), (x2, y2), (xq, yq) = p1, p2, q
    if x1 == x2 and y1 == y2:
        raise LoiBPT("Hai điểm trên đường biên trùng nhau")
    a, b = y2 - y1, x1 - x2                      # pháp vectơ của đường thẳng đi qua p1, p2
    c = -(a * x1 + b * y1)
    gia_tri = a * xq + b * yq + c
    if gia_tri == 0:
        raise LoiBPT("Điểm thuộc miền nghiệm đang nằm trên đường biên, hãy chọn điểm khác")
    if gia_tri < 0:
        a, b, c = -a, -b, -c                     # để nghiệm là a*x + b*y + c > 0
    mau = 1                                      # quy đồng rồi chia ước chung -> số nguyên tối giản
    for t in (a, b, c):
        mau = mau * t.denominator // math.gcd(mau, t.denominator)
    ia, ib, ic = int(a * mau), int(b * mau), int(c * mau)
    g = math.gcd(math.gcd(abs(ia), abs(ib)), abs(ic))
    ia, ib, ic = ia // g, ib // g, ic // g
    dau = '>'
    if ia < 0 or (ia == 0 and ib < 0):           # hệ số đầu âm: đổi dấu hai vế và đổi chiều
        ia, ib, ic, dau = -ia, -ib, -ic, '<'
    return f"{_ve_trai(ia, ib)}{dau}{-ic}"


# =============================================================================
# 2. PHẦN GIAO DIỆN (PyQt6)
# =============================================================================

class QColorComboBox(QComboBox):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.populateColors()

    def populateColors(self):
        for ten, _, rgb in BANG_MAU:
            self.addItem(ten, QColor(*rgb))


def _pha_trang(rgb, ty_le):
    """Giống 'mau!25' của xcolor: ty_le phần màu + (1 - ty_le) phần trắng."""
    return QColor(*[int(round(255 - ty_le * (255 - v))) for v in rgb])


def _so_ngan(v: float) -> str:
    """Số thực -> chuỗi ngắn để ghi toạ độ trên hình (không ra '-0')."""
    s = f"{v:.6g}"
    return '0' if s in ('-0', '0') else s


# -----------------------------------------------------------------------------
# Con trỏ chuột tự vẽ cho hình xem trước (Qt không có sẵn con trỏ "thêm" / "xóa" / "bước 1, 2, 3").
#   chon: chữ thập + số bước 1 / 2 / 3 khi nhập hàm bằng 3 điểm; vòng cam = đang bắt giao điểm hai đường biên
#   them: chữ thập + dấu + xanh = bấm để đánh dấu điểm; vòng cam = đúng giao điểm của hai đường
#   xoa : chữ thập + dấu x đỏ   = bấm để xóa điểm đã đánh dấu
# Điểm nóng (chỗ thật sự được trỏ tới) luôn ở tâm chữ thập. Mỗi kiểu chỉ vẽ một lần rồi dùng lại.
# -----------------------------------------------------------------------------
_KICH_THUOC_CON_TRO = 32
_CON_TRO_DEM: Dict[tuple, QCursor] = {}


def _ve_con_tro(kieu: str, vong_cam: bool, chu: str) -> QCursor:
    n = _KICH_THUOC_CON_TRO
    tam = n / 2.0
    pm = QPixmap(n, n)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)

    def but(mau, rong):
        b = QPen(mau)
        b.setWidthF(rong)
        b.setCapStyle(Qt.PenCapStyle.RoundCap)
        return b

    # chữ thập hở tâm (để nhìn thấy điểm đang trỏ): nét trắng dày bên dưới, nét đen mảnh bên trên cho rõ trên mọi nền
    nhanh = ((QPointF(tam - 11, tam), QPointF(tam - 4, tam)),
             (QPointF(tam + 4, tam), QPointF(tam + 11, tam)),
             (QPointF(tam, tam - 11), QPointF(tam, tam - 4)),
             (QPointF(tam, tam + 4), QPointF(tam, tam + 11)))
    for mau, rong in ((QColor(255, 255, 255), 3.4), (QColor(0, 0, 0), 1.4)):
        p.setPen(but(mau, rong))
        for a, b in nhanh:
            p.drawLine(a, b)
    if vong_cam:
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.setPen(but(QColor(255, 255, 255), 3.6))
        p.drawEllipse(QPointF(tam, tam), 7.5, 7.5)
        p.setPen(but(QColor(230, 120, 0), 2.0))
        p.drawEllipse(QPointF(tam, tam), 7.5, 7.5)

    # huy hiệu ở góc dưới bên phải cho biết cú bấm sẽ làm gì
    mau_hh = {'chon': QColor(216, 27, 96), 'them': QColor(46, 125, 50), 'xoa': QColor(211, 47, 47)}.get(kieu)
    if mau_hh is not None:
        bx = by = n - 7.0
        p.setPen(but(QColor(255, 255, 255), 1.6))
        p.setBrush(QBrush(mau_hh))
        p.drawEllipse(QPointF(bx, by), 6.0, 6.0)
        p.setPen(but(QColor(255, 255, 255), 1.9))
        if kieu == 'them':                                    # dấu +
            p.drawLine(QPointF(bx - 3, by), QPointF(bx + 3, by))
            p.drawLine(QPointF(bx, by - 3), QPointF(bx, by + 3))
        elif kieu == 'xoa':                                   # dấu x
            p.drawLine(QPointF(bx - 2.6, by - 2.6), QPointF(bx + 2.6, by + 2.6))
            p.drawLine(QPointF(bx - 2.6, by + 2.6), QPointF(bx + 2.6, by - 2.6))
        else:                                                 # số bước
            f = QFont()
            f.setBold(True)
            f.setPixelSize(10)
            p.setFont(f)
            p.drawText(QRectF(bx - 6, by - 6, 12, 12), chu, QTextOption(Qt.AlignmentFlag.AlignCenter))
    p.end()
    return QCursor(pm, int(tam), int(tam))


def con_tro_tuy_chinh(kieu: str, vong_cam: bool = False, chu: str = '') -> QCursor:
    khoa = (kieu, bool(vong_cam), chu)
    cur = _CON_TRO_DEM.get(khoa)
    if cur is None:
        cur = _CON_TRO_DEM[khoa] = _ve_con_tro(kieu, bool(vong_cam), chu)
    return cur


class XemTruoc(QWidget):
    """Vẽ hình bằng QPainter từ đối tượng Canh (cùng dữ liệu với mã TikZ)."""

    # click trái khi đang chọn điểm: toạ độ lưới (u, v) đã bắt; tham số thứ ba là GiaoDiem nếu
    # điểm được bắt vào giao điểm của hai đường biên, ngược lại là None
    chonDiem = pyqtSignal(float, float, object)
    lamLai = pyqtSignal()                  # click phải: bỏ điểm vừa chọn
    huyChon = pyqtSignal()                 # nhấn Esc: hủy việc chọn điểm
    batDauKeo = pyqtSignal(object)         # bắt đầu kéo một hoặc nhiều đường biên
    keoYeuCau = pyqtSignal(object, float, float)
    ketThucKeo = pyqtSignal()
    themDiemPhu = pyqtSignal(object, object, object)   # chế độ thêm điểm: (các chỉ số hàm gắn vào, x, y kiểu Fraction)
    xoaDiemPhu = pyqtSignal(str)                 # chế độ xóa điểm: mã điểm
    batDauKeoDiem = pyqtSignal(str)              # chế độ kéo điểm: bắt đầu kéo điểm có mã này
    keoDiemYeuCau = pyqtSignal(str, float, float)   # (mã điểm, x, y) vị trí chuột mới nhất, toạ độ thật
    ketThucKeoDiem = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.canh: Optional[Canh] = None
        self.thong_bao = ''
        self.dang_chon = False                       # đang ở chế độ chọn điểm
        self.diem_chon: List[Tuple[float, float]] = []   # các điểm đã chọn, toạ độ thật (x, y)
        # điểm đang rê chuột: (u, v, GiaoDiem hoặc None), đã bắt lưới / bắt giao điểm
        self.ro: Optional[Tuple[float, float, Optional[GiaoDiem]]] = None
        self.chia = 1                                # độ mịn khi bắt điểm (xem diem_tu_luoi)
        self.bat_giao = True                         # có bắt vào giao điểm hai đường biên không
        self.giao_diem: List[GiaoDiem] = []          # các giao điểm có thể bắt (do hộp thoại cấp)
        self.che_do_keo = 0                           # 0: tắt, 1: kéo đường, 2: kéo giao điểm, 3: thêm / xóa điểm, 4: kéo điểm
        # chế độ 3: ('xoa', DiemPhu) | ('giao', GiaoDiem) | ('them', HamHinh, x, y); chế độ 4: ('keo', DiemPhu)
        self.muc_tieu_phu = None
        self._keo_diem: Optional[str] = None          # mã điểm đang được kéo (chế độ 4)
        self._keo_diem_cho = None                     # (x, y) mới nhất của chuột, chờ phát đi
        self._keo_dang_dien_ra = None                 # (các chỉ số hàm, x0, y0)
        self.dang_keo = False                         # đang kéo: ẩn nhãn đường biên (không hiện số nhảy liên tục)
        self._keo_cho = None                          # (ids, dx, dy) mới nhất, chờ phát đi
        # Gộp các sự kiện chuột dồn dập: mỗi ~8 ms chỉ tính và vẽ lại một lần theo vị trí chuột mới nhất.
        self._hen_keo = QTimer(self)
        self._hen_keo.setSingleShot(True)
        self._hen_keo.setInterval(8)
        self._hen_keo.timeout.connect(self._phat_keo)
        self._khoa_con_tro = None                     # con trỏ đang đặt (xem _dat_con_tro), None = con trỏ mặc định
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.setMinimumSize(380, 380)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

    # --- chọn điểm trên hình ---
    def bat_chon(self, bat: bool):
        self.dang_chon = bat
        self.diem_chon = []
        self.ro = None
        if bat:
            self.setFocus()
        self._cap_nhat_con_tro()                      # chữ thập số 1 khi bắt đầu chọn; về như cũ khi thôi chọn
        self.update()

    def dat_diem_chon(self, ds):
        self.diem_chon = list(ds)
        self._cap_nhat_con_tro()                      # số trên con trỏ đổi theo bước (1 -> 2 -> 3)
        self.update()

    def dat_giao_diem(self, ds):
        """Danh sách giao điểm có thể bắt (đã loại các đường biên của hàm đang được nhập)."""
        self.giao_diem = list(ds)
        self.ro = None
        self.update()

    def dat_bat_giao(self, bat: bool):
        self.bat_giao = bool(bat)
        self.ro = None
        self.update()

    def _he_toa_do(self):
        """(k, ox, oy): pixel = (ox + k*u, oy - k*v). None nếu chưa có hình."""
        c = self.canh
        if c is None:
            return None
        W, H = self.width(), self.height()
        ub0, ub1 = c.umin - 1.0, c.umax + 1.0
        vb0, vb1 = c.vmin - 1.0, c.vmax + 1.0
        k = min(max(1.0, W - 20) / (ub1 - ub0), max(1.0, H - 20) / (vb1 - vb0), 90.0)
        ox = (W - k * (ub1 - ub0)) / 2 - k * ub0
        oy = (H - k * (vb1 - vb0)) / 2 + k * vb1
        return k, ox, oy

    def _bat_diem(self, vt) -> Optional[Tuple[float, float, Optional[GiaoDiem]]]:
        """Vị trí chuột (pixel) -> (u, v, giao). Ưu tiên bắt vào giao điểm hai đường biên nếu con trỏ
        ở gần (giao là GiaoDiem đó); nếu không thì bắt vào lưới (giao = None)."""
        ht = self._he_toa_do()
        if ht is None:
            return None
        k, ox, oy = ht
        if self.bat_giao:
            gan, d2_min = None, BAN_KINH_BAT ** 2
            for g in self.giao_diem:
                dx, dy = ox + k * g.u - vt.x(), oy - k * g.v - vt.y()
                d2 = dx * dx + dy * dy
                if d2 <= d2_min:
                    gan, d2_min = g, d2
            if gan is not None:
                return gan.u, gan.v, gan
        u, v = (vt.x() - ox) / k, (oy - vt.y()) / k
        return round(u * self.chia) / self.chia, round(v * self.chia) / self.chia, None

    def dat_che_do_keo(self, che_do: int):
        self.che_do_keo = int(che_do)
        self._keo_dang_dien_ra = None
        self._keo_diem = None
        self._keo_diem_cho = None
        self.muc_tieu_phu = None
        self._lam_moi_muc_tieu()                      # con trỏ theo chế độ mới (mũi tên thường nếu chuột chưa trỏ vào đâu)
        self.update()

    def _toa_do_thuc(self, pos):
        ht = self._he_toa_do()
        if ht is None or self.canh is None:
            return None
        k, ox, oy = ht
        u, v = (pos.x() - ox) / k, (oy - pos.y()) / k
        return u * float(self.canh.buoc_x), v * float(self.canh.buoc_y)

    @staticmethod
    def _khoang_cach_diem_doan(q, a, b):
        dx, dy = b.x() - a.x(), b.y() - a.y()
        den = dx * dx + dy * dy
        t = 0.0 if den == 0 else max(0.0, min(1.0, ((q.x()-a.x())*dx + (q.y()-a.y())*dy) / den))
        x, y = a.x() + t * dx, a.y() + t * dy
        return math.hypot(q.x()-x, q.y()-y)

    def _tim_doi_tuong_keo(self, pos):
        c = self.canh
        ht = self._he_toa_do()
        if c is None or ht is None:
            return None
        k, ox, oy = ht
        if self.che_do_keo == 2:
            gan, dmin = None, 12.0
            for g in c.giao_diem:
                q = QPointF(ox + k*g.u, oy - k*g.v)
                d = math.hypot(pos.x()-q.x(), pos.y()-q.y())
                if d < dmin:
                    gan, dmin = g, d
            return tuple(gan.ham) if gan is not None else None
        if self.che_do_keo == 1:
            gan, dmin = None, 10.0
            for h in c.ham:
                if not h.doan:
                    continue
                a = QPointF(ox+k*h.doan[0][0], oy-k*h.doan[0][1])
                b = QPointF(ox+k*h.doan[1][0], oy-k*h.doan[1][1])
                d = self._khoang_cach_diem_doan(pos, a, b)
                if d < dmin:
                    gan, dmin = h.chi_so, d
            return (gan,) if gan is not None else None
        return None

    def _tim_muc_tieu_phu(self, pos):
        """Chế độ 3 (thêm / xóa điểm) và 4 (kéo điểm): chuột đang trỏ vào đâu?
        Chế độ 4: ('keo', DiemPhu) nếu sát một điểm đã đánh dấu.
        Chế độ 3, theo thứ tự ưu tiên:
          ('xoa', DiemPhu): sát một điểm đã đánh dấu -> bấm để xóa;
          ('giao', GiaoDiem): sát chỗ hai (hoặc nhiều) đường biên cắt nhau -> bấm để đánh dấu giao điểm;
          ('them', HamHinh, x, y): sát một đường biên -> bấm để đánh dấu điểm trên đường (điểm lưới gần nhất nếu có);
        None: không trỏ vào đâu."""
        c = self.canh
        ht = self._he_toa_do()
        if c is None or ht is None:
            return None
        k, ox, oy = ht
        gan, dmin = None, 12.0 if self.che_do_keo == 4 else 11.0
        for d in c.diem_phu:
            kc = math.hypot(pos.x() - (ox + k * d.u), pos.y() - (oy - k * d.v))
            if kc < dmin:
                gan, dmin = d, kc
        if self.che_do_keo == 4:
            return ('keo', gan) if gan is not None else None
        if gan is not None:
            return ('xoa', gan)
        gan, dmin = None, BAN_KINH_BAT                 # giao điểm của hai đường biên (không tự vẽ, chỉ hiện khi rê chuột tới)
        for g in c.giao_diem:
            kc = math.hypot(pos.x() - (ox + k * g.u), pos.y() - (oy - k * g.v))
            if kc <= dmin:
                gan, dmin = g, kc
        if gan is not None:
            return ('giao', gan)
        tot, dmin = None, 8.0
        for h in c.ham:
            if not h.doan or h.he is None:
                continue
            a = QPointF(ox + k * h.doan[0][0], oy - k * h.doan[0][1])
            b = QPointF(ox + k * h.doan[1][0], oy - k * h.doan[1][1])
            kc = self._khoang_cach_diem_doan(pos, a, b)
            if kc < dmin:
                tot, dmin = h, kc
        if tot is None:
            return None
        u, v = (pos.x() - ox) / k, (oy - pos.y()) / k
        kq = diem_gan_tren_duong(tot.he, u, v, c.buoc_x, c.buoc_y, self.chia, ban_kinh=14.0 / k)
        if kq is None:
            return None
        return ('them', tot, kq[2], kq[3])

    # ------------------------ con trỏ chuột theo ngữ cảnh ------------------------
    # Nguyên tắc: con trỏ chỉ đổi khi một cú bấm / kéo tại đó thật sự làm được việc, và hình con trỏ nói rõ việc ấy.
    #   chỗ không có gì    : mũi tên bình thường
    #   nhập hàm 3 điểm    : chữ thập kèm số bước 1 / 2 / 3 (vòng cam = đang bắt giao điểm hai đường biên)
    #   kéo đường biên     : mũi tên hai đầu vuông góc với đường (đường chỉ tịnh tiến theo phương đó); giữ nguyên lúc kéo
    #   kéo giao điểm      : mũi tên bốn hướng; giữ nguyên lúc kéo
    #   thêm điểm          : chữ thập kèm dấu + xanh (vòng cam = đúng giao điểm); đường đã đủ điểm: biển cấm
    #   xóa điểm           : chữ thập kèm dấu x đỏ
    #   kéo điểm           : bàn tay mở khi rê tới điểm, bàn tay nắm khi đang kéo
    def _dat_con_tro(self, khoa):
        """khoa: None (mặc định) | ('std', Qt.CursorShape) | ('tuy', kiểu, vòng cam, chữ). Chỉ gọi Qt khi khóa đổi."""
        if khoa == self._khoa_con_tro:
            return
        self._khoa_con_tro = khoa
        if khoa is None:
            self.unsetCursor()
        elif khoa[0] == 'std':
            self.setCursor(khoa[1])
        else:
            self.setCursor(con_tro_tuy_chinh(khoa[1], khoa[2], khoa[3]))

    def _con_tro_keo_duong(self, chi_so):
        """Mũi tên hai đầu theo phương pháp tuyến của đường biên thứ chi_so (xoay theo hướng đường trên màn hình)."""
        c = self.canh
        h = next((x for x in c.ham if x.chi_so == chi_so and x.doan), None) if c is not None else None
        if h is None:
            return Qt.CursorShape.SizeAllCursor
        (u0, v0), (u1, v1) = h.doan[0], h.doan[1]
        n = (math.degrees(math.atan2(v1 - v0, u1 - u0)) + 90.0) % 180.0      # hướng pháp tuyến, 0 - 180 độ
        if n < 22.5 or n >= 157.5:
            return Qt.CursorShape.SizeHorCursor
        if n < 67.5:
            return Qt.CursorShape.SizeBDiagCursor
        if n < 112.5:
            return Qt.CursorShape.SizeVerCursor
        return Qt.CursorShape.SizeFDiagCursor

    def _khoa_them_xoa(self, mt):
        """Chế độ 3: khóa con trỏ ứng với mục tiêu mt (kết quả của _tim_muc_tieu_phu)."""
        if mt is None:
            return None
        if mt[0] == 'xoa':
            return ('tuy', 'xoa', False, '')
        ham = tuple(mt[1].ham) if mt[0] == 'giao' else (mt[1].chi_so,)
        if any(self._dem_diem_tren(i) >= SO_DIEM_TOI_DA for i in ham):
            return ('std', Qt.CursorShape.ForbiddenCursor)        # đường đã đủ điểm: bấm cũng không thêm được
        return ('tuy', 'them', mt[0] == 'giao', '')

    def _cap_nhat_con_tro(self, vt=None):
        """Chọn con trỏ theo việc một cú bấm tại vị trí chuột vt (pixel) sẽ làm. vt là None thì lấy vị trí chuột hiện
        tại nếu chuột đang ở trên hình, nếu không thì coi như chuột chưa trỏ vào đâu."""
        if self._keo_dang_dien_ra is not None or self._keo_diem is not None:
            return                                    # đang kéo: giữ con trỏ đã đặt lúc bấm chuột
        if vt is None and self.underMouse():
            vt = self.mapFromGlobal(QCursor.pos())
        khoa = None
        if self.dang_chon:
            buoc = min(len(self.diem_chon), 2) + 1
            khoa = ('tuy', 'chon', bool(self.ro is not None and self.ro[2] is not None), str(buoc))
        elif self.canh is not None:
            if self.che_do_keo in (1, 2) and vt is not None:
                ids = self._tim_doi_tuong_keo(vt)
                if ids:
                    khoa = ('std', self._con_tro_keo_duong(ids[0]) if self.che_do_keo == 1
                            else Qt.CursorShape.SizeAllCursor)
            elif self.che_do_keo == 3:
                khoa = self._khoa_them_xoa(self.muc_tieu_phu)
            elif self.che_do_keo == 4 and self.muc_tieu_phu is not None:
                khoa = ('std', Qt.CursorShape.OpenHandCursor)
        self._dat_con_tro(khoa)

    def _lam_moi_muc_tieu(self):
        """Hình hoặc chế độ vừa đổi mà chuột đứng yên: tính lại mục tiêu dưới chuột và con trỏ ngay, không đợi lần rê chuột
        kế tiếp (ví dụ vừa bấm thêm điểm thì con trỏ chuyển sang dấu x vì điểm mới nằm ngay dưới chuột)."""
        if self._keo_dang_dien_ra is not None or self._keo_diem is not None:
            return
        vt = self.mapFromGlobal(QCursor.pos()) if self.underMouse() else None
        if (vt is not None and self.canh is not None and not self.dang_chon
                and self.che_do_keo in (3, 4)):
            self.muc_tieu_phu = self._tim_muc_tieu_phu(vt)
        self._cap_nhat_con_tro(vt)

    def mouseMoveEvent(self, e):
        if self._keo_dang_dien_ra is not None and self.canh is not None:
            ids, x0, y0 = self._keo_dang_dien_ra
            xy = self._toa_do_thuc(e.position())
            if xy is not None:
                self._keo_cho = (ids, xy[0]-x0, xy[1]-y0)      # chỉ nhớ vị trí mới nhất,
                if not self._hen_keo.isActive():                # phát đi theo nhịp của bộ hẹn giờ
                    self._hen_keo.start()
            return
        if self._keo_diem is not None and self.canh is not None:
            xy = self._toa_do_thuc(e.position())
            if xy is not None:
                self._keo_diem_cho = xy
                if not self._hen_keo.isActive():
                    self._hen_keo.start()
            return
        if self.dang_chon and self.canh is not None:
            self.ro = self._bat_diem(e.position())
            self._cap_nhat_con_tro(e.position())      # vòng cam khi đang bắt giao điểm
            self.update()
        elif self.che_do_keo in (1, 2) and self.canh is not None:
            self._cap_nhat_con_tro(e.position())
        elif self.che_do_keo in (3, 4) and self.canh is not None:
            mt = self._tim_muc_tieu_phu(e.position())
            if mt != self.muc_tieu_phu:               # chỉ vẽ lại khi mục tiêu đổi, đỡ tốn khi rê chuột
                self.muc_tieu_phu = mt
                self.update()
            self._cap_nhat_con_tro(e.position())
        else:
            super().mouseMoveEvent(e)

    def mousePressEvent(self, e):
        if self.dang_chon and self.canh is not None:
            if e.button() == Qt.MouseButton.LeftButton:
                kq = self._bat_diem(e.position())
                if kq is not None:
                    self.chonDiem.emit(kq[0], kq[1], kq[2])
            elif e.button() == Qt.MouseButton.RightButton:
                self.lamLai.emit()
            return
        if self.che_do_keo == 3 and self.canh is not None:
            # trái = thêm điểm (trỏ vào giao điểm hoặc đường) hoặc xóa (trỏ vào điểm đã có); phải = xóa điểm
            mt = self._tim_muc_tieu_phu(e.position())
            if mt is not None:
                if mt[0] == 'xoa':
                    self.xoaDiemPhu.emit(mt[1].ma)
                elif e.button() == Qt.MouseButton.LeftButton:
                    if mt[0] == 'giao':
                        self.themDiemPhu.emit(tuple(mt[1].ham), mt[1].x, mt[1].y)
                    else:
                        self.themDiemPhu.emit((mt[1].chi_so,), mt[2], mt[3])
            e.accept()
            return
        if self.che_do_keo == 4 and self.canh is not None:
            # kéo điểm đã đánh dấu: các đường gắn với điểm đổi theo
            if e.button() == Qt.MouseButton.LeftButton:
                mt = self._tim_muc_tieu_phu(e.position())
                if mt is not None and mt[0] == 'keo':
                    self._keo_diem = mt[1].ma
                    self._keo_diem_cho = None
                    self.dang_keo = True
                    self._dat_con_tro(('std', Qt.CursorShape.ClosedHandCursor))     # bàn tay nắm: đang kéo điểm
                    self.batDauKeoDiem.emit(mt[1].ma)
                    self.update()
            e.accept()
            return
        if (e.button() == Qt.MouseButton.LeftButton and self.che_do_keo in (1, 2)
                and self.canh is not None):
            ids = self._tim_doi_tuong_keo(e.position())
            xy = self._toa_do_thuc(e.position())
            if ids and xy is not None:
                self._cap_nhat_con_tro(e.position())  # bảo đảm đúng con trỏ lúc bấm; lúc kéo giữ nguyên con trỏ đó
                self._keo_dang_dien_ra = (ids, xy[0], xy[1])
                self._keo_cho = None
                self.dang_keo = True
                self.batDauKeo.emit(ids)
                self.update()                                  # ẩn nhãn đường biên ngay khi bắt đầu kéo
                e.accept()
                return
        super().mousePressEvent(e)

    def _phat_keo(self):
        """Phát đi vị trí kéo mới nhất (nếu có) cho hộp thoại vẽ lại."""
        if self._keo_cho is not None and self._keo_dang_dien_ra is not None:
            ids, dx, dy = self._keo_cho
            self._keo_cho = None
            self.keoYeuCau.emit(ids, dx, dy)
        if self._keo_diem_cho is not None and self._keo_diem is not None:
            x, y = self._keo_diem_cho
            self._keo_diem_cho = None
            self.keoDiemYeuCau.emit(self._keo_diem, x, y)

    def mouseReleaseEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and self._keo_diem is not None:
            self._hen_keo.stop()
            self._phat_keo()                          # đẩy nốt vị trí chuột cuối cùng
            self._keo_diem = None
            self._keo_diem_cho = None
            self.dang_keo = False
            self.ketThucKeoDiem.emit()
            self._lam_moi_muc_tieu()                  # bàn tay mở nếu chuột còn trên điểm, không thì mũi tên thường
            self.update()
            e.accept()
            return
        if e.button() == Qt.MouseButton.LeftButton and self._keo_dang_dien_ra is not None:
            self._hen_keo.stop()
            self._phat_keo()                          # đẩy nốt vị trí chuột cuối cùng
            self._keo_dang_dien_ra = None
            self._keo_cho = None
            self.dang_keo = False
            self.ketThucKeo.emit()
            self._lam_moi_muc_tieu()                  # tính lại theo vị trí mới của đường / giao điểm
            self.update()
            e.accept()
            return
        if self.dang_chon or self.che_do_keo in (3, 4):
            e.accept()                                # chọn điểm đã xử lý ở mousePressEvent, không bắn lần hai
            return
        super().mouseReleaseEvent(e)

    def leaveEvent(self, e):
        self.ro = None
        self.muc_tieu_phu = None
        self._cap_nhat_con_tro()
        self.update()
        super().leaveEvent(e)

    def keyPressEvent(self, e):
        if self.dang_chon and e.key() == Qt.Key.Key_Escape:
            self.huyChon.emit()
            e.accept()
        else:
            super().keyPressEvent(e)

    def dat_canh(self, canh: Optional[Canh], thong_bao: str = ''):
        self.canh = canh
        self.thong_bao = thong_bao
        self.muc_tieu_phu = None                  # mục tiêu cũ trỏ vào dữ liệu của hình trước đó
        self._lam_moi_muc_tieu()                  # tính lại ngay theo chỗ chuột đang đứng (không đợi lần rê kế tiếp)
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.fillRect(self.rect(), QColor(255, 255, 255))
        c = self.canh
        if c is None:
            if self.thong_bao:
                tuy = QTextOption(Qt.AlignmentFlag.AlignCenter)
                tuy.setWrapMode(QTextOption.WrapMode.WordWrap)
                p.setPen(QColor(176, 0, 32))
                p.drawText(QRectF(16, 16, max(1, self.width() - 32), max(1, self.height() - 32)),
                           self.thong_bao, tuy)
            p.end()
            return

        k, ox, oy = self._he_toa_do()

        def P(u, v):
            return QPointF(ox + k * u, oy - k * v)

        ppt = k / c.lu * CM_MOI_PT            # số pixel ứng với 1pt của TikZ
        den = QColor(0, 0, 0)

        f_nho = QFont(self.font())
        f_nho.setPixelSize(max(8, min(22, int(round(5 * ppt)))))
        f_lon = QFont(f_nho)
        f_lon.setPixelSize(max(11, min(30, int(round(10 * ppt)))))
        f_lon.setItalic(True)

        def but(mau, rong):
            b = QPen(mau)
            b.setWidthF(rong)
            return b

        # ---- tô màu / gạch sọc phần không thỏa (vẽ trước, đúng thứ tự như mã TikZ) ----
        for h in c.ham:
            if not h.da_giac:
                continue
            rgb = MAU_RGB.get(h.mau, (0, 0, 0))
            pts = [P(u, v) for u, v in h.da_giac]
            if h.to_mau:
                self._to_mau(p, pts, QColor(*rgb), h.do_dam / 100.0)
            else:
                self._gach_soc(p, pts, h.goc, h.kc * ppt, _pha_trang(rgb, 0.25),
                               max(1.0, 0.4 * ppt))

        # ---- trục, mũi tên ----
        p.setPen(but(den, max(1.0, 0.4 * ppt)))
        o = P(0, 0)
        mut_x, mut_y = P(c.umax + 0.5, 0), P(0, c.vmax + 0.5)
        p.drawLine(P(c.umin - 0.5, 0), mut_x)
        p.drawLine(P(0, c.vmin - 0.5), mut_y)
        p.setBrush(QBrush(den))
        for goc_, dau_ in ((P(c.umin - 0.5, 0), mut_x), (P(0, c.vmin - 0.5), mut_y)):
            dx, dy = dau_.x() - goc_.x(), dau_.y() - goc_.y()
            n = math.hypot(dx, dy) or 1.0
            ux, uy = dx / n, dy / n
            L_, w_ = 4.5 * ppt, 1.7 * ppt
            gx, gy = dau_.x() - ux * L_, dau_.y() - uy * L_
            p.drawPolygon(QPolygonF([dau_, QPointF(gx - uy * w_, gy + ux * w_),
                                     QPointF(gx + uy * w_, gy - ux * w_)]))
        p.setBrush(Qt.BrushStyle.NoBrush)

        # ---- vạch chia và nhãn ----
        p.setFont(f_nho)
        for t in c.vach_x:
            q = P(t.k, 0)
            if c.hien_gach:
                p.drawLine(QPointF(q.x(), q.y() - 2 * ppt), QPointF(q.x(), q.y() + 2 * ppt))
            if c.hien_so and t.co_nhan:           # co_nhan = False: nhãn bị bỏ cho đỡ chồng, như trong mã TikZ
                p.drawText(QRectF(q.x() - 60, q.y() + 9 * ppt - 8, 120, 16),
                           Qt.AlignmentFlag.AlignCenter, t.van)
        for t in c.vach_y:
            q = P(0, t.k)
            if c.hien_gach:
                p.drawLine(QPointF(q.x() - 2 * ppt, q.y()), QPointF(q.x() + 2 * ppt, q.y()))
            if c.hien_so and t.co_nhan:
                p.drawText(QRectF(q.x() - 7 * ppt - 120, q.y() - 8, 120, 16),
                           Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter, t.van)
        p.drawText(QRectF(o.x() - 6.4 * ppt - 20, o.y() + 6.4 * ppt - 8, 40, 16),
                   Qt.AlignmentFlag.AlignCenter, "O")
        p.setFont(f_lon)
        p.drawText(QRectF(mut_x.x() + 0.6 * ppt - 20, mut_x.y() + 7 * ppt - 10, 40, 20),
                   Qt.AlignmentFlag.AlignCenter, "x")
        p.drawText(QRectF(mut_y.x() - 7 * ppt - 20, mut_y.y() - 0.6 * ppt - 10, 40, 20),
                   Qt.AlignmentFlag.AlignCenter, "y")

        # ---- các hàm: đường biên, nhãn ----
        p.setFont(f_nho)
        fm = QFontMetricsF(f_nho)
        for h in c.ham:
            rgb = MAU_RGB.get(h.mau, (0, 0, 0))
            if h.doan:
                pa, pb = P(*h.doan[0]), P(*h.doan[1])
                p.setPen(but(QColor(*rgb), max(1.2, 0.4 * ppt)))
                p.drawLine(pa, pb)
                if h.nhan and not self.dang_keo:      # đang kéo: không ghi nhãn (số đổi liên tục)
                    chu = h.nhan_van or h.nhan        # xem trước viết phân số dạng p/q
                    mx = pa.x() + h.vi_tri_nhan * (pb.x() - pa.x())
                    my = pa.y() + h.vi_tri_nhan * (pb.y() - pa.y())
                    goc = math.degrees(math.atan2(-(pb.y() - pa.y()), pb.x() - pa.x()))
                    p.save()
                    p.translate(mx, my)
                    p.rotate(-goc)
                    rong = fm.horizontalAdvance(chu)
                    y_chu = -3.0 if h.nhan_phia_tren else fm.ascent() + 2.0
                    p.setPen(but(QColor(*rgb), 1.0))
                    p.drawText(QPointF(-rong / 2, y_chu), chu)
                    p.restore()

        # ---- điểm đánh dấu của người dùng: chấm tròn, vẽ sau cùng như trong mã TikZ ----
        # (giao điểm các đường biên không tự vẽ; chỉ hiện khi người dùng rê chuột tới ở chế độ thêm / xóa điểm)
        if c.diem_phu:
            self._ve_cham(p, P, ppt, den, c.diem_phu, c.hien_ten_diem)

        if self.dang_chon:
            self._ve_lop_phu(p, P)
        elif self.che_do_keo == 2:
            self._ve_lop_giao(p, P)
        elif self.che_do_keo == 3:
            self._ve_lop_phu_diem(p, P)
        elif self.che_do_keo == 4:
            self._ve_lop_keo_diem(p, P)
        p.end()

    def _ve_cham(self, p, P, ppt, den, ds, co_ten: bool):
        """Chấm tròn (bán kính 1,5pt của TikZ, tối thiểu 2,5 pixel) kèm tên cho mỗi điểm trong ds
        (GiaoDiem hoặc DiemPhu: cùng có u, v, ten, goc_nhan)."""
        r_cham = max(2.5, 1.5 * ppt)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QBrush(den))
        for g in ds:
            p.drawEllipse(P(g.u, g.v), r_cham, r_cham)
        p.setBrush(Qt.BrushStyle.NoBrush)
        if co_ten:                                # tên điểm: \scriptsize (7pt), tâm cách chấm BK_NHAN_PT
            f_ten = QFont(self.font())
            f_ten.setPixelSize(max(9, min(26, int(round(7 * ppt)))))
            f_ten.setItalic(True)
            p.setFont(f_ten)
            p.setPen(den)
            r_ten = BK_NHAN_PT * ppt
            for g in ds:
                q = P(g.u, g.v)
                a = math.radians(g.goc_nhan)
                cx, cy = q.x() + r_ten * math.cos(a), q.y() - r_ten * math.sin(a)
                p.drawText(QRectF(cx - 25, cy - 10, 50, 20), Qt.AlignmentFlag.AlignCenter, g.ten)

    def _dem_diem_tren(self, i: int) -> int:
        """Số điểm đánh dấu đang gắn với đường biên của hàm i."""
        return sum(1 for d in self.canh.diem_phu if i in d.ham)

    def _ve_lop_giao(self, p, P):
        """Chế độ kéo giao điểm: giao điểm không tự vẽ nên vẽ vòng mờ để người dùng biết chỗ nào kéo được."""
        b = QPen(QColor(230, 120, 0, 170))
        b.setWidthF(1.4)
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.setPen(b)
        for g in self.canh.giao_diem:
            p.drawEllipse(P(g.u, g.v), 6.5, 6.5)

    def _ve_lop_keo_diem(self, p, P):
        """Chế độ kéo điểm: vòng xanh quanh các điểm đã đánh dấu (kéo được); điểm đang trỏ tới vẽ đậm hơn."""
        xanh = QColor(25, 118, 210)
        p.setBrush(Qt.BrushStyle.NoBrush)
        b = QPen(QColor(25, 118, 210, 140))
        b.setWidthF(1.2)
        p.setPen(b)
        for d in self.canh.diem_phu:
            p.drawEllipse(P(d.u, d.v), 7.0, 7.0)
        mt = self.muc_tieu_phu
        ma = self._keo_diem
        if ma is None and mt is not None and mt[0] == 'keo':
            ma = mt[1].ma
        d = next((x for x in self.canh.diem_phu if x.ma == ma), None) if ma is not None else None
        if d is not None:
            b = QPen(xanh)
            b.setWidthF(2.4)
            p.setPen(b)
            p.setBrush(QBrush(QColor(25, 118, 210, 50)))
            p.drawEllipse(P(d.u, d.v), 9.0, 9.0)

    def _ve_lop_phu_diem(self, p, P):
        """Lớp phủ ở chế độ thêm / xóa điểm: vòng mờ quanh các điểm đã đánh dấu (bấm vào để xóa); khi chuột tới gần
        chỗ hai đường biên cắt nhau thì giao điểm hiện lên (bấm để đánh dấu), tới gần một đường thì hiện điểm sẽ thêm
        trên đường đó. Đường đã đủ SO_DIEM_TOI_DA điểm thì báo bằng vòng xám."""
        c = self.canh
        hong = QColor(216, 27, 96)
        cam = QColor(230, 120, 0)
        xam = QColor(110, 110, 110)
        p.setBrush(Qt.BrushStyle.NoBrush)
        b = QPen(QColor(216, 27, 96, 120))
        b.setWidthF(1.2)
        p.setPen(b)
        for d in c.diem_phu:                       # điểm có thể xóa: vòng mờ
            p.drawEllipse(P(d.u, d.v), 7.0, 7.0)
        mt = self.muc_tieu_phu
        if mt is None:
            return
        sx, sy = float(c.buoc_x), float(c.buoc_y)
        f = QFont(self.font())
        f.setPixelSize(13)
        f.setBold(True)
        fm = QFontMetricsF(f)

        def ghi(q, chu, mau):                      # chữ cạnh điểm q, tự lật nếu tràn mép
            p.setFont(f)
            rong = fm.horizontalAdvance(chu)
            tx = q.x() + 11
            if tx + rong > self.width() - 4:
                tx = max(4.0, q.x() - 11 - rong)
            ty = q.y() - 11 if q.y() > 20 else q.y() + 24
            p.setPen(mau)
            p.drawText(QPointF(tx, ty), chu)

        def but(mau, rong):
            bb = QPen(mau)
            bb.setWidthF(rong)
            return bb

        if mt[0] == 'xoa':                         # đang trỏ vào một điểm: vòng đậm + gạch chéo = bấm để xóa
            q = P(mt[1].u, mt[1].v)
            p.setPen(but(hong, 2.4))
            p.setBrush(QBrush(QColor(216, 27, 96, 50)))
            p.drawEllipse(q, 9.0, 9.0)
            p.drawLine(QPointF(q.x() - 5, q.y() - 5), QPointF(q.x() + 5, q.y() + 5))
            p.drawLine(QPointF(q.x() - 5, q.y() + 5), QPointF(q.x() + 5, q.y() - 5))
            ghi(q, f"Xóa điểm {mt[1].ten}", hong)
            return
        if mt[0] == 'giao':                        # giao điểm của hai đường biên: hiện chấm + vòng cam
            g = mt[1]
            q = P(g.u, g.v)
            ham, x, y = tuple(g.ham), g.x, g.y
            ten_ham = " ∩ ".join(f"Hàm {i + 1}" for i in ham)
        else:                                      # điểm sẽ thêm trên một đường biên
            h = mt[1]
            q = P(float(mt[2]) / sx, float(mt[3]) / sy)
            ham, x, y = (h.chi_so,), mt[2], mt[3]
            ten_ham = f"Hàm {h.chi_so + 1}"
        day = [i for i in ham if self._dem_diem_tren(i) >= SO_DIEM_TOI_DA]
        if day:                                    # đường đã đủ điểm: bấm cũng không thêm được
            p.setPen(but(xam, 2.0))
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawEllipse(q, 9.0, 9.0)
            ghi(q, f"Hàm {day[0] + 1} đã đủ {SO_DIEM_TOI_DA} điểm", xam)
            return
        toa_do = f"({_so_ngan(float(x))}; {_so_ngan(float(y))})"
        if mt[0] == 'giao':
            p.setPen(but(cam, 2.2))
            p.setBrush(QBrush(QColor(cam.red(), cam.green(), cam.blue(), 70)))
            p.drawEllipse(q, 9.0, 9.0)
        else:
            p.setPen(but(hong, 1.8))
            p.setBrush(QBrush(QColor(255, 255, 255, 200)))
            p.drawEllipse(q, 7.0, 7.0)
        p.setPen(Qt.PenStyle.NoPen)                # chấm đen của điểm sẽ được đánh dấu
        p.setBrush(QBrush(QColor(0, 0, 0)))
        p.drawEllipse(q, 3.0, 3.0)
        ghi(q, f"{ten_ham}: {toa_do}" if mt[0] == 'giao' else toa_do, cam if mt[0] == 'giao' else hong)

    def _ve_lop_phu(self, p, P):
        """Lớp phủ khi đang chọn điểm: viền báo hiệu, đường qua A, B, các điểm đã chọn, điểm rê chuột."""
        c = self.canh
        hong = QColor(216, 27, 96)
        sx, sy = float(c.buoc_x), float(c.buoc_y)

        cam = QColor(230, 120, 0)                          # màu của giao điểm hai đường biên

        def kieu(rong, net=Qt.PenStyle.SolidLine, mau=hong):
            b = QPen(mau)
            b.setWidthF(rong)
            b.setStyle(net)
            return b

        p.setBrush(Qt.BrushStyle.NoBrush)
        p.setPen(kieu(3.0))
        p.drawRect(1, 1, self.width() - 2, self.height() - 2)

        if self.bat_giao:                                  # các giao điểm có thể bắt: vòng tròn cam
            p.setPen(kieu(1.6, mau=cam))
            for g in self.giao_diem:
                p.drawEllipse(P(g.u, g.v), 6.5, 6.5)       # vòng bao quanh chấm đen của giao điểm

        pts = [(x / sx, y / sy) for x, y in self.diem_chon]
        if len(pts) >= 2:                                  # đường biên đi qua A và B
            a, b = P(*pts[0]), P(*pts[1])
            dx, dy = b.x() - a.x(), b.y() - a.y()
            n = math.hypot(dx, dy) or 1.0
            dai = 2.0 * (self.width() + self.height())
            p.setPen(kieu(1.5, Qt.PenStyle.DashLine))
            p.drawLine(QPointF(a.x() - dx / n * dai, a.y() - dy / n * dai),
                       QPointF(a.x() + dx / n * dai, a.y() + dy / n * dai))

        f = QFont(self.font())
        f.setPixelSize(13)
        f.setBold(True)
        p.setFont(f)
        fm = QFontMetricsF(f)

        def ghi(q, chu, mau=hong):                         # chữ cạnh điểm q, tự lật nếu tràn mép
            rong = fm.horizontalAdvance(chu)
            tx = q.x() + 9
            if tx + rong > self.width() - 4:
                tx = max(4.0, q.x() - 9 - rong)
            ty = q.y() - 9 if q.y() > 20 else q.y() + 22
            p.setPen(mau)
            p.drawText(QPointF(tx, ty), chu)

        for i, ((u, v), (x, y)) in enumerate(zip(pts, self.diem_chon)):
            q = P(u, v)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QBrush(hong))
            p.drawEllipse(q, 5.0, 5.0)
            ghi(q, f"{('A', 'B', 'M')[i % 3]}({_so_ngan(x)}; {_so_ngan(y)})")

        if self.ro is not None:                            # điểm sẽ được chọn nếu click
            u, v, giao = self.ro
            q = P(u, v)
            if giao is not None:                           # bắt vào giao điểm hai đường biên
                p.setBrush(QBrush(QColor(cam.red(), cam.green(), cam.blue(), 70)))
                p.setPen(kieu(2.2, mau=cam))
                p.drawEllipse(q, 9.0, 9.0)
                ten = " ∩ ".join(f"Hàm {i + 1}" for i in giao.ham)
                ghi(q, f"{ten}: ({_so_ngan(float(giao.x))}; {_so_ngan(float(giao.y))})", cam)
            else:
                p.setBrush(Qt.BrushStyle.NoBrush)
                p.setPen(kieu(1.5))
                p.drawEllipse(q, 7.0, 7.0)
                ghi(q, f"({_so_ngan(u * sx)}; {_so_ngan(v * sy)})")

    @staticmethod
    def _to_mau(p, pts, mau, do_dam):
        """Tô đặc đa giác bằng màu `mau` với độ đậm `do_dam` (0..1), giống \\fill[màu,fill opacity=...]."""
        m = QColor(mau)
        m.setAlphaF(min(1.0, max(0.0, do_dam)))
        p.save()
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QBrush(m))
        p.drawPolygon(QPolygonF(pts))
        p.restore()

    @staticmethod
    def _gach_soc(p, pts, goc, kc, mau, rong):
        """Tô gạch sọc trong đa giác: các đoạn song song, góc `goc` độ, cách nhau `kc` pixel."""
        kc = max(kc, 2.0)
        duong = QPainterPath()
        duong.addPolygon(QPolygonF(pts))
        duong.closeSubpath()
        khung = duong.boundingRect()
        th = math.radians(goc)
        d = (math.cos(th), -math.sin(th))       # hướng gạch (toạ độ màn hình, y xuống)
        n = (math.sin(th), math.cos(th))        # pháp tuyến của gạch
        chieu = [n[0] * q.x() + n[1] * q.y() for q in pts]
        k0, k1 = math.floor(min(chieu) / kc), math.ceil(max(chieu) / kc)
        if k1 - k0 > 4000:
            return
        dai = khung.width() + khung.height()
        tx, ty = khung.center().x(), khung.center().y()
        b = QPen(mau)
        b.setWidthF(rong)
        p.save()
        p.setClipPath(duong)
        p.setPen(b)
        for i in range(k0, k1 + 1):
            s = i * kc
            t = (tx - n[0] * s) * d[0] + (ty - n[1] * s) * d[1]
            x0, y0 = n[0] * s + d[0] * t, n[1] * s + d[1] * t
            p.drawLine(QPointF(x0 - d[0] * dai, y0 - d[1] * dai),
                       QPointF(x0 + d[0] * dai, y0 + d[1] * dai))
        p.restore()


class TikzHighlighter(QSyntaxHighlighter):
    """Tô màu cú pháp mã TikZ: lệnh, biến \\foreach, khóa tùy chọn, số, công thức $...$, chú thích %."""

    # (lệnh, biến, khóa, số, từ khóa, công thức, chú thích, dấu câu)
    _SANG = ('#1a56b0', '#8e24aa', '#00796b', '#b45f06', '#0b7285', '#b3261e', '#2e7d32', '#7a7a7a')
    _TOI = ('#82aaff', '#c792ea', '#80cbc4', '#f78c6c', '#89ddff', '#ff9e80', '#7fbf7f', '#9a9a9a')

    def __init__(self, document):
        super().__init__(document)
        toi = QApplication.palette().color(QPalette.ColorRole.Base).lightness() < 128
        m_lenh, m_bien, m_khoa, m_so, m_tukhoa, m_ct, m_cm, m_dau = self._TOI if toi else self._SANG

        def kieu(mau, dam=False, nghieng=False):
            f = QTextCharFormat()
            f.setForeground(QColor(mau))
            if dam:
                f.setFontWeight(QFont.Weight.Bold)
            if nghieng:
                f.setFontItalic(True)
            return f

        # Thứ tự quan trọng: quy tắc sau ghi đè quy tắc trước trên cùng đoạn chữ.
        self._luat = [
            (re.compile(r'--|;|[\[\]{}()]'), kieu(m_dau)),
            (re.compile(r'(?<![A-Za-z\\])-?\d+(?:\.\d+)?(?:cm|pt)?(?![A-Za-z])'), kieu(m_so)),
            (re.compile(r'(?<![\\A-Za-z])[A-Za-z][A-Za-z ]*(?==)'), kieu(m_khoa)),
            (re.compile(r'\b(?:node|cycle|circle|sloped|above|below|in)\b'), kieu(m_tukhoa, dam=True)),
            (re.compile(r'\\[A-Za-z@]+'), kieu(m_lenh, dam=True)),
            (re.compile(r'\\(?:x|y|nhan)(?![A-Za-z])'), kieu(m_bien, dam=True)),
            (re.compile(r'\$[^$]*\$'), kieu(m_ct)),
            (re.compile(r'(?<!\\)%.*$'), kieu(m_cm, nghieng=True)),
        ]

    def highlightBlock(self, text):
        for mau, fmt in self._luat:
            for m in mau.finditer(text):
                self.setFormat(m.start(), m.end() - m.start(), fmt)


class KhungMaTikz(QPlainTextEdit):
    """Khung hiển thị mã TikZ: chữ đơn cách, tô màu cú pháp, tab = 0,6 cm."""
    TAB_CM = 0.6

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setReadOnly(True)
        self.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)
        self.setFont(QFontDatabase.systemFont(QFontDatabase.SystemFont.FixedFont))
        self.to_mau = TikzHighlighter(self.document())
        self._dat_tab()

    def _dat_tab(self):
        self.setTabStopDistance(self.TAB_CM / 2.54 * self.logicalDpiX())

    def showEvent(self, event):
        super().showEvent(event)
        self._dat_tab()                       # tính lại nếu cửa sổ sang màn hình khác DPI


class HangHam(QFrame):
    """Một dòng nhập bất phương trình cùng các thông số của riêng nó."""
    thayDoi = pyqtSignal()
    yeuCauLen = pyqtSignal(object)
    yeuCauXuong = pyqtSignal(object)
    yeuCauXoa = pyqtSignal(object)
    yeuCauChon = pyqtSignal(object)

    def __init__(self, stt: int, text: str = '', chi_so_mau: int = 1,
                 goc: int = -1, kc: float = 3.0, vt: int = 75,
                 hien_nhan: bool = True, to_mau: bool = False, do_dam: int = 25,
                 parent=None):
        super().__init__(parent)
        self.uid = str(uuid.uuid4())
        self._loi = ''
        self.setFrameShape(QFrame.Shape.StyledPanel)

        self.lbl = QLabel()
        self.lbl.setMinimumWidth(52)
        self.edit = QLineEdit(text)
        self.edit.setPlaceholderText("vd: 2x+3y<6")
        self.edit.setValidator(QRegularExpressionValidator(
            QRegularExpression("[-+*/0-9xyXY><. ()]*")))
        self.mau_view = QLabel()
        self.mau_view.setFixedSize(20, 20)
        self.cbMau = QColorComboBox()
        self.cbMau.setCurrentIndex(chi_so_mau)
        self.spGoc = QSpinBox()
        self.spGoc.setRange(-1, 179)
        self.spGoc.setSpecialValueText("Tự động")
        self.spGoc.setSuffix("°")
        self.spGoc.setValue(goc)
        self.spGoc.setToolTip("Góc nghiêng của gạch sọc so với trục Ox (0–179°).\n"
                              "'Tự động' = đường biên quay thêm 60°.")
        self.spKc = QDoubleSpinBox()
        self.spKc.setRange(0.5, 30.0)
        self.spKc.setSingleStep(0.5)
        self.spKc.setDecimals(1)
        self.spKc.setSuffix(" pt")
        self.spKc.setValue(kc)
        self.spKc.setToolTip("Khoảng cách giữa hai gạch sọc (mặc định của TikZ là 3pt).")
        self.cbKieu = QComboBox()
        self.cbKieu.addItem("Gạch sọc")
        self.cbKieu.addItem("Tô màu")
        self.cbKieu.setCurrentIndex(1 if to_mau else 0)
        self.cbKieu.setToolTip("Cách thể hiện phần mặt phẳng không thỏa bất phương trình:\n"
                               "gạch sọc (pattern) hoặc tô màu.")
        self.lblDam = QLabel("Độ đậm:")
        self.spDam = QSpinBox()
        self.spDam.setRange(5, 100)
        self.spDam.setSingleStep(5)
        self.spDam.setSuffix(" %")
        self.spDam.setValue(do_dam)
        self.spDam.setToolTip("Độ đậm của màu tô (100% = màu đặc).\n"
                              "Các vùng tô chồng lên nhau sẽ pha màu với nhau.")

        self.chkNhan = QCheckBox("Hiện nhãn trên đường")
        self.chkNhan.setChecked(hien_nhan)
        self.chkNhan.setToolTip("Bỏ chọn để ẩn nhãn (phương trình đường biên) của hàm này.")
        self.spVt = QSpinBox()
        self.spVt.setRange(0, 100)
        self.spVt.setSingleStep(5)
        self.spVt.setSuffix(" %")
        self.spVt.setValue(vt)
        self.spVt.setEnabled(hien_nhan)
        self.spVt.setToolTip("Vị trí nhãn dọc theo đường biên (phần nằm trong khung).\n"
                             "0% = đầu bên trái (đầu phía dưới nếu đường thẳng đứng), "
                             "100% = đầu bên phải (phía trên).")

        self.btnChon = QPushButton("Chọn 3 điểm")
        self.btnChon.setCheckable(True)
        self.btnChon.setToolTip("Nhập hàm bằng cách click trên hình xem trước:\n"
                                "2 điểm trên đường biên, rồi 1 điểm trong miền nghiệm "
                                "(miền không gạch sọc / không tô màu).\n"
                                "Click gần giao điểm hai đường biên (vòng tròn cam) để lấy đúng giao điểm đó.")
        self.btnLen = QPushButton("▲")
        self.btnXuong = QPushButton("▼")
        self.btnXoa = QPushButton("✕")
        for b, tip in ((self.btnLen, "Chuyển lên trên"), (self.btnXuong, "Chuyển xuống dưới"),
                       (self.btnXoa, "Xóa hàm này")):
            b.setFixedSize(28, 28)
            b.setToolTip(tip)

        lay = QGridLayout(self)
        lay.setContentsMargins(6, 4, 6, 4)
        lay.setHorizontalSpacing(4)
        lay.setVerticalSpacing(3)
        lay.addWidget(self.lbl, 0, 0)
        lay.addWidget(self.edit, 0, 1)
        lay.addWidget(self.btnChon, 0, 2)
        lay.addWidget(self.btnLen, 0, 3)
        lay.addWidget(self.btnXuong, 0, 4)
        lay.addWidget(self.btnXoa, 0, 5)
        h2 = QHBoxLayout()
        h2.addWidget(self.mau_view)
        h2.addWidget(self.cbMau)
        h2.addSpacing(8)
        h2.addWidget(QLabel("Kiểu:"))
        h2.addWidget(self.cbKieu)
        h2.addSpacing(8)
        h2.addWidget(self.lblDam)                  # chỉ hiện khi chọn "Tô màu"
        h2.addWidget(self.spDam)
        h2.addStretch()
        lay.addLayout(h2, 1, 1, 1, 5)
        self.khungSoc = QWidget()                  # chỉ hiện khi chọn "Gạch sọc"
        hs = QHBoxLayout(self.khungSoc)
        hs.setContentsMargins(0, 0, 0, 0)
        hs.addWidget(QLabel("Góc sọc:"))
        hs.addWidget(self.spGoc)
        hs.addSpacing(8)
        hs.addWidget(QLabel("Cách nhau:"))
        hs.addWidget(self.spKc)
        hs.addStretch()
        lay.addWidget(self.khungSoc, 2, 1, 1, 5)
        h3 = QHBoxLayout()
        h3.addWidget(self.chkNhan)
        h3.addSpacing(8)
        h3.addWidget(QLabel("Vị trí nhãn:"))
        h3.addWidget(self.spVt)
        h3.addStretch()
        lay.addLayout(h3, 3, 1, 1, 5)
        lay.setColumnStretch(1, 1)

        self.edit.textChanged.connect(lambda _t: self.thayDoi.emit())
        self.cbMau.currentIndexChanged.connect(lambda _i: self._cap_nhat_kieu())
        self.cbMau.currentIndexChanged.connect(lambda _i: self.thayDoi.emit())
        self.spGoc.valueChanged.connect(lambda _v: self.thayDoi.emit())
        self.spKc.valueChanged.connect(lambda _v: self.thayDoi.emit())
        self.cbKieu.currentIndexChanged.connect(lambda _i: self._doi_kieu())
        self.cbKieu.currentIndexChanged.connect(lambda _i: self.thayDoi.emit())
        self.spDam.valueChanged.connect(lambda _v: self.thayDoi.emit())
        self.chkNhan.toggled.connect(self.spVt.setEnabled)
        self.chkNhan.toggled.connect(lambda _b: self.thayDoi.emit())
        self.spVt.valueChanged.connect(lambda _v: self.thayDoi.emit())
        self.btnChon.clicked.connect(lambda _c=False: self.yeuCauChon.emit(self))
        self.btnLen.clicked.connect(lambda _c=False: self.yeuCauLen.emit(self))
        self.btnXuong.clicked.connect(lambda _c=False: self.yeuCauXuong.emit(self))
        self.btnXoa.clicked.connect(lambda _c=False: self.yeuCauXoa.emit(self))

        self.dat_so_thu_tu(stt)
        self._cap_nhat_kieu()
        self._doi_kieu()

    def _doi_kieu(self):
        """Gạch sọc: hiện góc / khoảng cách. Tô màu: hiện độ đậm."""
        to_mau = self.cbKieu.currentIndex() == 1
        self.khungSoc.setVisible(not to_mau)
        self.lblDam.setVisible(to_mau)
        self.spDam.setVisible(to_mau)

    # --- giao tiếp với hộp thoại ---
    def du_lieu(self) -> Ham:
        goc = self.spGoc.value()
        return Ham(text=self.edit.text(),
                   mau=BANG_MAU[self.cbMau.currentIndex()][1],
                   goc=None if goc < 0 else float(goc),
                   kc=self.spKc.value(),
                   vi_tri=self.spVt.value() / 100.0,
                   hien_nhan=self.chkNhan.isChecked(),
                   to_mau=self.cbKieu.currentIndex() == 1,
                   do_dam=float(self.spDam.value()))

    def dat_dang_chon(self, bat: bool):
        """Đánh dấu hàng này đang được nhập bằng cách chọn điểm trên hình."""
        self.btnChon.setChecked(bat)
        self.btnChon.setText("Đang chọn…" if bat else "Chọn 3 điểm")

    def dat_so_thu_tu(self, stt: int):
        self.lbl.setText(f"Hàm {stt}")

    def dat_nut(self, co_len: bool, co_xuong: bool):
        self.btnLen.setEnabled(co_len)
        self.btnXuong.setEnabled(co_xuong)

    def dat_loi(self, thong_bao: str = ''):
        if thong_bao != self._loi:
            self._loi = thong_bao
            self._cap_nhat_kieu()

    def _cap_nhat_kieu(self):
        r, g, b = BANG_MAU[self.cbMau.currentIndex()][2]
        sang = 0.299 * r + 0.587 * g + 0.114 * b > 140     # màu quá sáng thì chữ dùng màu đen
        chu = '#000000' if sang else QColor(r, g, b).name()
        kieu = f"color: {chu};"
        if self._loi:
            kieu += " border: 1px solid #d32f2f; background: #fff0f0;"
        self.edit.setStyleSheet(kieu)
        self.edit.setToolTip(self._loi)
        self.mau_view.setStyleSheet(f"background-color: {QColor(r, g, b).name()}; "
                                    "border: 1px solid #888;")


@dataclass
class BPTBNState:
    """Trạng thái dữ liệu độc lập với widget giao diện."""
    rows: List[dict] = field(default_factory=list)
    view: dict = field(default_factory=dict)
    selected_row_id: Optional[str] = None
    selected_points: List[Tuple[Fraction, Fraction]] = field(default_factory=list)
    # điểm đánh dấu: {'id', 'ten', 'x', 'y' (chuỗi phân số, vị trí gợi ý), 'rows' (uid của 1 - 2 hàng điểm gắn vào)}
    points: List[dict] = field(default_factory=list)


class BPTBNSDialog(QDialog):
    # Dòng nhắc thư viện TikZ cần dùng (đổi theo việc có hàm nào dùng gạch sọc hay không)
    _CHU_CAN_PATTERN = "Cần \\usetikzlibrary{patterns.meta} trong phần khai báo."
    _CHU_CHI_TO_MAU = ("Chỉ có hàm tô màu: không cần thư viện TikZ bổ sung "
                       "(tô trong suốt cần PDF hỗ trợ độ trong suốt: pdfLaTeX, XeLaTeX, LuaLaTeX đều dùng được).")

    _NHAN_COPY = "Sao chép TikZ"

    # Nội dung tab "Hướng dẫn". HTML rút gọn cho QTextBrowser; không đặt màu cứng để hợp cả giao diện sáng và tối.
    _HUONG_DAN_HTML = r"""
<h2>Hướng dẫn sử dụng</h2>
<p>Hộp thoại này vẽ miền nghiệm của hệ bất phương trình bậc nhất hai ẩn và sinh mã TikZ tương ứng.
Hình ở tab <b>Hình xem trước</b> và mã ở tab <b>Mã TikZ</b> cùng lấy từ một dữ liệu nên luôn khớp nhau;
sửa gì thì cả hai cập nhật theo sau khoảng một phần tư giây. Bấm <b>F1</b> bất cứ lúc nào để quay lại trang này.</p>
<p><b>Mục lục:</b>
<a href="#nhanh">1. Bắt đầu nhanh</a> ·
<a href="#nhap">2. Nhập bất phương trình</a> ·
<a href="#khung">3. Khung nhìn và trục</a> ·
<a href="#thongso">4. Thông số từng hàm</a> ·
<a href="#bading">5. Nhập hàm bằng 3 điểm</a> ·
<a href="#chuot">6. Tương tác bằng chuột</a> ·
<a href="#bat">7. Bắt điểm</a> ·
<a href="#diem">8. Điểm đánh dấu A, B, C…</a> ·
<a href="#nut">9. Nút lệnh và phím tắt</a> ·
<a href="#tikz">10. Dùng mã TikZ</a> ·
<a href="#loi">11. Khi gặp lỗi</a></p>
<hr>

<a name="nhanh"></a><h3>1. Bắt đầu nhanh</h3>
<ol>
<li>Gõ bất phương trình vào ô <b>Hàm 1</b>, ví dụ <code>2x+3y&lt;6</code>. Bấm <b>＋ Thêm hàm</b> để thêm hàm khác.</li>
<li>Xem hình ở tab <b>Hình xem trước</b>: phần được gạch sọc (hoặc tô màu) là phần <i>không</i> thỏa bất phương trình,
phần để trống là <b>miền nghiệm</b>.</li>
<li>Chỉnh khung nhìn, màu, kiểu gạch sọc / tô màu nếu cần.</li>
<li>Bấm <b>Thực hiện</b> để chèn mã TikZ vào khung soạn thảo của cửa sổ chính, hoặc <b>Sao chép TikZ</b> để dán vào nơi khác.</li>
</ol>

<a name="nhap"></a><h3>2. Nhập bất phương trình</h3>
<p>Mỗi ô có <b>đúng một</b> dấu <code>&lt;</code> hoặc <code>&gt;</code>. Được dùng <code>x</code>, <code>y</code> (hoa hay thường đều được),
số (có thể thập phân), phép <code>+ - * /</code>, dấu ngoặc, và viết liền hệ số như <code>2x</code>. Hai vế có thể chứa cả x và y.</p>
<table border="1" cellspacing="0" cellpadding="4">
<tr><th align="left">Ví dụ</th><th align="left">Ý nghĩa</th></tr>
<tr><td><code>2x+3y&lt;6</code></td><td>dạng thường gặp</td></tr>
<tr><td><code>y/2 &gt; x-3</code></td><td>có phân số, x và y ở cả hai vế</td></tr>
<tr><td><code>(x+1)*2 &lt; y</code></td><td>có ngoặc và dấu nhân</td></tr>
<tr><td><code>x&lt;3</code>, <code>y&gt;-2</code></td><td>đường biên thẳng đứng / nằm ngang</td></tr>
</table>
<p>Chương trình chỉ có một kiểu nét cho đường biên, nên với <code>≤</code> hoặc <code>≥</code> vẫn gõ <code>&lt;</code> hoặc <code>&gt;</code>; gõ dấu <code>=</code> sẽ báo ký tự không hợp lệ.
Ô nhập chuyển viền đỏ khi có lỗi; rê chuột vào ô để đọc lý do.</p>

<a name="khung"></a><h3>3. Khung nhìn và trục</h3>
<ul>
<li><b>X min, X max, Y min, Y max</b>: cần X min &lt; 0 &lt; X max và Y min &lt; 0 &lt; Y max. Nhận cả số rất lớn hoặc rất nhỏ,
ví dụ <code>200000</code> hay <code>1e-3</code>.</li>
<li><b>Tự chia vạch trên hai trục</b>: bật thì chương trình tự chọn bước chia đẹp; tắt để tự nhập <b>Bước X</b>, <b>Bước Y</b>.</li>
<li><b>Tự chọn khung nhìn theo các hàm</b>: đặt khung vừa đủ chứa các giao điểm với trục và giao điểm giữa các đường biên.</li>
<li><b>Hiện số trên trục</b> và <b>Hiện gạch trên trục</b> bật tắt độc lập: chỉ số, chỉ gạch, cả hai hoặc không cái nào.</li>
<li><b>Ghi tên các điểm đã đánh dấu</b>: bỏ chọn thì chỉ vẽ chấm, không ghi tên.</li>
<li><b>Ghi chú trong mã TikZ</b>: thêm một dòng chú thích cho từng hàm trong mã sinh ra.</li>
</ul>

<a name="thongso"></a><h3>4. Thông số từng hàm</h3>
<ul>
<li><b>Màu</b> của đường biên, của gạch sọc hoặc của vùng tô.</li>
<li><b>Kiểu</b>: <i>Gạch sọc</i> hoặc <i>Tô màu</i> cho phần không thỏa.
Gạch sọc có <b>Góc sọc</b> (0–179°; “Tự động” là đường biên quay thêm 60°) và <b>Cách nhau</b> (0,5–30 pt, TikZ mặc định 3 pt).
Tô màu có <b>Độ đậm</b> (5–100 %); các vùng tô chồng lên nhau sẽ pha màu.</li>
<li><b>Hiện nhãn trên đường</b> và <b>Vị trí nhãn</b>: 0 % là đầu bên trái (đầu dưới nếu đường thẳng đứng), 100 % là đầu bên phải (đầu trên).</li>
<li>Nút <b>▲ ▼</b> đổi thứ tự hàm (cũng là thứ tự vẽ), nút <b>✕</b> xóa hàm.</li>
</ul>

<a name="bading"></a><h3>5. Nhập hàm bằng 3 điểm</h3>
<p>Không cần gõ công thức: bấm <b>Chọn 3 điểm</b> ở hàng muốn nhập rồi click trên hình xem trước.</p>
<ol>
<li>Click <b>điểm thứ nhất</b> trên đường biên.</li>
<li>Click <b>điểm thứ hai</b> trên đường biên.</li>
<li>Click <b>một điểm thuộc miền nghiệm</b> (miền không gạch sọc). Bất phương trình được suy ra và điền vào ô nhập.</li>
</ol>
<p>Con trỏ là chữ thập kèm số 1, 2, 3 cho biết đang ở bước nào. Khi con trỏ gần một giao điểm của hai đường biên khác
(vòng tròn cam), click sẽ lấy <b>đúng giao điểm đó</b>, không làm tròn theo lưới.
<b>Chuột phải</b> lùi một bước; <b>Esc</b> hoặc nút <b>Hủy chọn</b> hủy việc nhập.</p>

<a name="chuot"></a><h3>6. Tương tác bằng chuột</h3>
<p>Hàng nút phía trên hình chọn kiểu tương tác. Con trỏ chuột <b>chỉ đổi khi có thứ để tác động</b>;
ở chỗ trống nó là mũi tên bình thường, và hình dạng con trỏ cho biết cú bấm sẽ làm gì.</p>
<table border="1" cellspacing="0" cellpadding="4">
<tr><th align="left">Nút</th><th align="left">Cách dùng</th><th align="left">Con trỏ</th></tr>
<tr><td><b>Không kéo</b></td><td>Chỉ xem hình, chuột không làm thay đổi gì.</td><td>Mũi tên thường</td></tr>
<tr><td><b>Kéo đường</b></td><td>Rê tới một đường biên, giữ chuột và kéo để tịnh tiến song song.</td>
<td>Mũi tên hai đầu vuông góc với đường (tự xoay theo độ dốc)</td></tr>
<tr><td><b>Kéo giao điểm</b></td><td>Kéo một giao điểm: mọi đường đi qua điểm đó cùng dời, giữ nguyên hướng.</td>
<td>Mũi tên bốn hướng</td></tr>
<tr><td><b>Thêm / xóa điểm</b></td><td>Rê tới chỗ hai đường cắt nhau (hoặc tới một đường) rồi bấm để đánh dấu điểm.
Bấm vào điểm đã đánh dấu (hoặc bấm chuột phải) để xóa.</td>
<td>Chữ thập có dấu <b>+</b> xanh (vòng cam nếu đúng giao điểm); dấu <b>×</b> đỏ khi trỏ vào điểm đã có; biển cấm khi đường đã đủ 2 điểm</td></tr>
<tr><td><b>Kéo điểm</b></td><td>Kéo một điểm đã đánh dấu; các đường đi qua điểm đổi theo (xoay quanh điểm còn lại của đường đó,
hoặc tịnh tiến nếu đường chỉ có một điểm).</td><td>Bàn tay mở, nắm lại khi đang kéo</td></tr>
</table>
<p>Trong lúc kéo, hình xem trước chạy theo chuột nhưng chưa sinh mã và chưa hiện nhãn đường biên.
Khi <b>thả chuột</b>, chương trình bắt vào lưới theo mục <b>Bắt điểm</b>, ghi hệ số vào ô nhập và tính lại đầy đủ.
Mỗi lần kéo là một bước <b>Hoàn tác</b>.</p>

<a name="bat"></a><h3>7. Bắt điểm</h3>
<ul>
<li><b>Vạch chia</b>: chỉ bắt vào các điểm nguyên của lưới. <b>Nửa vạch chia</b>: bắt cả giữa hai vạch. <b>Tự do</b>: bắt rất mịn.
Cách bắt này áp dụng khi nhập hàm bằng 3 điểm, khi thêm điểm lên đường và khi thả chuột sau lúc kéo.</li>
<li><b>Bắt giao điểm</b>: khi bật, giao điểm của từng cặp đường biên hiện vòng tròn cam lúc chọn điểm và click gần đó sẽ lấy đúng giao điểm.
Hai đường song song, hoặc giao điểm nằm ngoài khung nhìn, thì không có vòng tròn.</li>
</ul>

<a name="diem"></a><h3>8. Điểm đánh dấu A, B, C…</h3>
<p>Giao điểm của các đường biên <b>không tự vẽ</b>. Muốn có chấm tròn trên hình, dùng chế độ <b>Thêm / xóa điểm</b> để đánh dấu.
Mỗi điểm có tên A, B, C… cấp theo thứ tự thêm và giữ nguyên khi sửa hình; điểm xuất hiện cả trong hình xem trước lẫn mã TikZ.
Mỗi đường biên chỉ gắn tối đa 2 điểm (hai điểm đã xác định một đường). Nút <b>Xóa hết điểm</b> xóa toàn bộ điểm đã đánh dấu.</p>

<a name="nut"></a><h3>9. Nút lệnh và phím tắt</h3>
<table border="1" cellspacing="0" cellpadding="4">
<tr><th align="left">Nút</th><th align="left">Tác dụng</th><th align="left">Phím tắt</th></tr>
<tr><td><b>Thực hiện</b></td><td>Chèn mã TikZ vào khung soạn thảo của cửa sổ chính, tại vị trí con trỏ nhập.
Nếu không tìm thấy khung đó, mã được sao chép vào clipboard.</td><td>Ctrl+Enter</td></tr>
<tr><td><b>Sao chép TikZ</b></td><td>Sao chép mã đang hiển thị vào clipboard.</td><td>Ctrl+Shift+C</td></tr>
<tr><td><b>Hoàn tác / Làm lại</b></td><td>Lùi / tiến các thao tác (tối đa 60 bước): sửa ô nhập, kéo hình, thêm hoặc xóa điểm…</td><td>Ctrl+Z / Ctrl+Y</td></tr>
<tr><td><b>Lưu dự án / Mở dự án</b></td><td>Ghi / đọc tệp <code>.json</code> gồm các hàm, thông số, khung nhìn, điểm đánh dấu và kiểu tương tác.</td><td>Ctrl+S / Ctrl+O</td></tr>
<tr><td><b>Mặc định</b></td><td>Xóa hết hàm, điểm đánh dấu và lịch sử hoàn tác; đưa khung nhìn về −5…5 và tạo lại 3 hàng trống.
<b>Không hoàn tác được.</b></td><td>—</td></tr>
<tr><td><b>Ẩn cửa sổ</b></td><td>Đóng hộp thoại.</td><td>—</td></tr>
</table>
<p>Phím khác: <b>F1</b> mở trang hướng dẫn này, <b>Esc</b> hủy việc nhập hàm bằng 3 điểm (hình xem trước tự nhận phím này sau khi bấm <b>Chọn 3 điểm</b>).
Khi đang gõ trong một ô nhập, Ctrl+Z có thể hoàn tác chữ của chính ô đó trước; hãy bấm nút <b>Hoàn tác</b> nếu muốn lùi thao tác trên hình.</p>

<a name="tikz"></a><h3>10. Dùng mã TikZ</h3>
<ul>
<li>Quy ước: gạch sọc hoặc tô màu phần mặt phẳng <b>không</b> thỏa bất phương trình; phần để trống là nghiệm.</li>
<li>Hàm dùng <i>gạch sọc</i> cần <code>\usetikzlibrary{patterns.meta}</code> trong phần khai báo
(dòng nhắc nằm ngay trên khung mã, tự đổi theo các hàm đang có).</li>
<li>Hàm <i>tô màu</i> không cần thư viện bổ sung, nhưng PDF phải hỗ trợ độ trong suốt (pdfLaTeX, XeLaTeX, LuaLaTeX đều dùng được).</li>
<li>Số lẻ trong mã lấy tối đa 2 chữ số thập phân; nhãn có số lẻ được in dạng phân số <code>\frac{p}{q}</code>.</li>
<li>Khung mã chỉ để xem và sao chép. Muốn đổi hình hay mã, hãy sửa ở các ô nhập hoặc trên hình xem trước.</li>
</ul>

<a name="loi"></a><h3>11. Khi gặp lỗi</h3>
<ul>
<li><b>Hình trống, mã trống</b>: thường do khung nhìn sai (không thỏa X min &lt; 0 &lt; X max hoặc Y min &lt; 0 &lt; Y max). Lý do hiện ở dòng trạng thái dưới cùng.</li>
<li><b>Ô nhập viền đỏ</b>: bất phương trình chưa hợp lệ, ví dụ thiếu dấu, có hai dấu, thiếu ngoặc đóng hoặc hệ số của x và y đều bằng 0.
Các hàm còn lại vẫn được vẽ bình thường.</li>
<li><b>“Cần khung nhìn hợp lệ trước khi chọn điểm”</b>: sửa khung nhìn trước rồi mới nhập hàm bằng 3 điểm.</li>
<li><b>“Chưa có bất phương trình hợp lệ nào để vẽ”</b>: nhập ít nhất một hàm đúng trước khi bấm Thực hiện hoặc Sao chép TikZ.</li>
</ul>
"""
    # Kiểu tương tác chuột: (tên đầy đủ, chữ trên nút, chú thích). Thứ tự = chỉ số của cbTuongTac / 'drag_mode' trong tệp dự án.
    _CAC_CHE_DO = (
        ("Không kéo", "Không kéo",
         "Không kéo: chỉ xem hình, chuột không làm thay đổi gì."),
        ("Kéo đường biên", "Kéo đường",
         "Kéo đường biên: giữ chuột trên một đường rồi kéo để tịnh tiến song song.\n"
         "Con trỏ là mũi tên hai đầu vuông góc với đường."),
        ("Kéo giao điểm", "Kéo giao điểm",
         "Kéo giao điểm: giữ chuột trên giao điểm rồi kéo; các đường đi qua điểm cùng di chuyển, giữ nguyên hướng.\n"
         "Con trỏ là mũi tên bốn hướng."),
        ("Thêm / xóa điểm", "Thêm / xóa điểm",
         "Thêm / xóa điểm: rê chuột tới chỗ hai đường cắt nhau (hoặc tới một đường) rồi bấm để đánh dấu điểm "
         "(con trỏ có dấu + xanh).\nBấm vào điểm đã đánh dấu (con trỏ có dấu × đỏ) hoặc bấm chuột phải để xóa. "
         "Mỗi đường chỉ có tối đa 2 điểm."),
        ("Kéo điểm (đường đổi theo)", "Kéo điểm",
         "Kéo điểm: kéo một điểm đã đánh dấu; các đường đi qua điểm đổi theo (xoay quanh điểm còn lại của đường đó, "
         "hoặc tịnh tiến nếu đường chỉ có một điểm).\nCon trỏ là bàn tay."),
    )

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Hệ bất phương trình bậc nhất')
        # QDialog mặc định chỉ có nút đóng: thêm nút thu nhỏ và phóng to
        self.setWindowFlags(self.windowFlags()
                            | Qt.WindowType.WindowMinMaxButtonsHint
                            | Qt.WindowType.WindowCloseButtonHint)
        self.parent_window = parent          # cửa sổ chính (có text_edit_tikz)
        self.hang: List[HangHam] = []
        self.canh: Optional[Canh] = None
        self._hang_chon: Optional[HangHam] = None       # hàng đang nhập bằng 3 điểm
        self._diem: List[Tuple[Fraction, Fraction]] = []   # các điểm đã chọn (x, y chính xác)
        self.state = BPTBNState()
        self._dang_cap_nhat = False
        self._dang_khoi_phuc = False
        self._last_snapshot = None
        self._keo_co_so = None
        self._keo_ds = None                  # danh sách Ham đọc một lần khi bắt đầu kéo
        self._keo_da_luu = False             # đã ghi mốc hoàn tác cho lần kéo này chưa
        self._pkeo = None                    # trạng thái kéo một điểm đánh dấu (chế độ "Kéo điểm")
        self._keo_dx = self._keo_dy = 0.0    # độ dời chuột (toạ độ thật) ở nhịp kéo cuối
        self._undo_stack = []
        self._redo_stack = []
        self._gioi_han_lich_su = 60
        self.resize(1120, 720)

        self._hen_gio = QTimer(self)
        self._hen_gio.setSingleShot(True)
        self._hen_gio.setInterval(250)
        self._hen_gio.timeout.connect(self.LamMoi)

        # ---------- cột trái: khung nhìn, danh sách hàm, nút lệnh ----------
        so_regex = QRegularExpressionValidator(QRegularExpression("[-+0-9.,eE]*"))
        nhom_khung = QGroupBox("Khung nhìn và tỉ lệ trục")
        g = QGridLayout(nhom_khung)
        self.edXmin, self.edXmax = QLineEdit("-5"), QLineEdit("5")
        self.edYmin, self.edYmax = QLineEdit("-5"), QLineEdit("5")
        self.edBx, self.edBy = QLineEdit(), QLineEdit()
        for ed in (self.edXmin, self.edXmax, self.edYmin, self.edYmax, self.edBx, self.edBy):
            ed.setValidator(so_regex)
            ed.setMinimumWidth(70)
        self.edXmin.setToolTip("Chấp nhận số rất lớn / rất nhỏ, ví dụ 200000 hoặc 1e-3")
        g.addWidget(QLabel("X min:"), 0, 0)
        g.addWidget(self.edXmin, 0, 1)
        g.addWidget(QLabel("X max:"), 0, 2)
        g.addWidget(self.edXmax, 0, 3)
        g.addWidget(QLabel("Y min:"), 1, 0)
        g.addWidget(self.edYmin, 1, 1)
        g.addWidget(QLabel("Y max:"), 1, 2)
        g.addWidget(self.edYmax, 1, 3)
        self.chkTuDong = QCheckBox("Tự chia vạch trên hai trục")
        self.chkTuDong.setChecked(True)
        g.addWidget(self.chkTuDong, 2, 0, 1, 4)
        g.addWidget(QLabel("Bước X:"), 3, 0)
        g.addWidget(self.edBx, 3, 1)
        g.addWidget(QLabel("Bước Y:"), 3, 2)
        g.addWidget(self.edBy, 3, 3)
        self.edBx.setEnabled(False)
        self.edBy.setEnabled(False)
        self.btnKhung = QPushButton("Tự chọn khung nhìn theo các hàm")
        g.addWidget(self.btnKhung, 4, 0, 1, 4)
        self.chkSoTruc = QCheckBox("Hiện số trên trục")
        self.chkSoTruc.setChecked(True)
        self.chkSoTruc.setToolTip("Ghi số (nhãn) tại các vạch chia của hai trục.")
        self.chkGachTruc = QCheckBox("Hiện gạch trên trục")
        self.chkGachTruc.setChecked(True)
        self.chkGachTruc.setToolTip("Vẽ gạch (vạch chia) nhỏ cắt ngang hai trục.\n"
                                    "Có thể chỉ hiện số, chỉ hiện gạch, hiện cả hai hoặc ẩn cả hai.")
        g.addWidget(self.chkSoTruc, 5, 0, 1, 2)
        g.addWidget(self.chkGachTruc, 5, 2, 1, 2)

        nhom_ham = QGroupBox("Các bất phương trình")
        vn = QVBoxLayout(nhom_ham)
        self.dsLayout = QVBoxLayout()
        self.dsLayout.setSpacing(6)
        self.dsLayout.addStretch(1)
        khung_ds = QWidget()
        khung_ds.setLayout(self.dsLayout)
        cuon = QScrollArea()
        cuon.setWidgetResizable(True)
        cuon.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        cuon.setWidget(khung_ds)
        self.btnThem = QPushButton("＋ Thêm hàm")
        vn.addWidget(cuon, 1)
        vn.addWidget(self.btnThem)

        # ---- 8 nút lệnh: 2 dòng x 4 cột, mỗi dòng một nhóm việc ----
        #   dòng 1 (làm việc với mã):   Thực hiện | Sao chép TikZ | Hoàn tác | Làm lại
        #   dòng 2 (dự án và cửa sổ):   Lưu dự án | Mở dự án | Mặc định | Ẩn cửa sổ
        self.button1 = QPushButton("Thực hiện")
        self.btnCopy = QPushButton(self._NHAN_COPY)
        self.btnUndo = QPushButton("Hoàn tác")
        self.btnRedo = QPushButton("Làm lại")
        self.btnSave = QPushButton("Lưu dự án")
        self.btnOpen = QPushButton("Mở dự án")
        self.button2 = QPushButton("Mặc định")
        self.button3 = QPushButton("Ẩn cửa sổ")
        sp, kieu = QStyle.StandardPixmap, self.style()
        for b, icon, tip, phim in (
                (self.button1, sp.SP_DialogApplyButton,
                 "Chèn mã TikZ vào khung soạn thảo của cửa sổ chính.", "Ctrl+Return"),
                (self.btnCopy, sp.SP_FileIcon,
                 "Sao chép mã TikZ đang hiển thị vào clipboard để dán vào nơi khác.", "Ctrl+Shift+C"),
                (self.btnUndo, sp.SP_ArrowBack,
                 "Hoàn tác thao tác gần nhất.", QKeySequence.StandardKey.Undo),
                (self.btnRedo, sp.SP_ArrowForward,
                 "Làm lại thao tác vừa hoàn tác.", QKeySequence.StandardKey.Redo),
                (self.btnSave, sp.SP_DialogSaveButton,
                 "Lưu các hàm, điểm đánh dấu và khung nhìn ra tệp dự án (.json).", QKeySequence.StandardKey.Save),
                (self.btnOpen, sp.SP_DialogOpenButton,
                 "Mở lại một dự án đã lưu (.json).", QKeySequence.StandardKey.Open),
                (self.button2, sp.SP_BrowserReload,
                 "Khai báo mặc định: xóa hết hàm, điểm đánh dấu và lịch sử hoàn tác, đưa khung nhìn về ban đầu.", None),
                (self.button3, sp.SP_DialogCloseButton,
                 "Ẩn cửa sổ này.", None)):
            b.setIcon(kieu.standardIcon(icon))
            if phim is not None:
                b.setShortcut(QKeySequence(phim))
                tip += f" ({QKeySequence(phim).toString(QKeySequence.SequenceFormat.NativeText)})"
            b.setToolTip(tip)
            b.setMinimumHeight(34)
            b.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        f_dam = self.button1.font()                 # nút chính nổi bật hơn các nút còn lại
        f_dam.setBold(True)
        self.button1.setFont(f_dam)
        self._hen_copy = QTimer(self)               # trả chữ trên nút về như cũ sau khi báo "Đã sao chép"
        self._hen_copy.setSingleShot(True)
        self._hen_copy.setInterval(1500)
        self._hen_copy.timeout.connect(lambda: self.btnCopy.setText(self._NHAN_COPY))
        hn = QGridLayout()
        hn.setHorizontalSpacing(6)
        hn.setVerticalSpacing(6)
        for i, b in enumerate((self.button1, self.btnCopy, self.btnUndo, self.btnRedo,
                               self.btnSave, self.btnOpen, self.button2, self.button3)):
            hn.addWidget(b, i // 4, i % 4)
        for cot in range(4):
            hn.setColumnStretch(cot, 1)             # 4 cột rộng đều nhau

        trai = QWidget()
        trai.setMinimumWidth(520)
        trai.setMaximumWidth(640)
        lt = QVBoxLayout(trai)
        lt.setContentsMargins(0, 0, 0, 0)
        lt.addWidget(nhom_khung)
        lt.addWidget(nhom_ham, 1)
        self.chkTenDiem = QCheckBox("Ghi tên các điểm đã đánh dấu (A, B, C…)")
        self.chkTenDiem.setChecked(True)
        self.chkTenDiem.setToolTip("Giao điểm của các đường biên không tự hiện: ở chế độ “Thêm / xóa điểm”, rê chuột tới chỗ\n"
                                   "hai đường cắt nhau (hoặc tới một đường) rồi bấm để đánh dấu điểm. Tên điểm được cấp\n"
                                   "theo thứ tự thêm (A, B, C…) và giữ nguyên khi sửa hình. Bỏ chọn để chỉ vẽ chấm, không ghi tên.")
        lt.addWidget(self.chkTenDiem)
        self.chkGhiChu =QCheckBox("Ghi chú trong mã TikZ (một dòng chú thích cho từng hàm)")
        self.chkGhiChu.setChecked(True)
        lt.addWidget(self.chkGhiChu)
        lt.addLayout(hn)

        # ---------- cột phải: xem trước và mã TikZ ----------
        self.xem = XemTruoc()
        self.txtTikz = KhungMaTikz()          # tô màu cú pháp, tab = 0,6 cm
        tab_ma = QWidget()
        lm = QVBoxLayout(tab_ma)
        self.lblThuVien = QLabel(self._CHU_CAN_PATTERN)
        self.lblThuVien.setWordWrap(True)
        lm.addWidget(self.lblThuVien)
        lm.addWidget(self.txtTikz, 1)
        self.tabs = QTabWidget()
        self.tabs.addTab(self.xem, "Hình xem trước")
        self.tabs.addTab(tab_ma, "Mã TikZ")
        self.txtHuongDan = QTextBrowser()        # tab hướng dẫn sử dụng (chỉ đọc; mục lục dùng liên kết #neo trong trang)
        self.txtHuongDan.setHtml(self._HUONG_DAN_HTML)
        self.tabs.addTab(self.txtHuongDan, "Hướng dẫn")
        self._phim_f1 = QShortcut(QKeySequence("F1"), self)
        self._phim_f1.activated.connect(self._mo_huong_dan)
        self.lblTrangThai = QLabel()
        self.lblTrangThai.setWordWrap(True)
        phai = QWidget()
        lp = QVBoxLayout(phai)
        lp.setContentsMargins(0, 0, 0, 0)
        self.lblChon = QLabel()
        self.lblChon.setWordWrap(True)
        self.lblChon.setMinimumHeight(44)         # tránh hình xem trước bị giật khi chữ đổi số dòng
        self.cbBat = QComboBox()
        for ten, n in (("Vạch chia", 1), ("Nửa vạch chia", 2), ("Tự do", 100)):
            self.cbBat.addItem(ten, n)
        self.cbBat.setToolTip("Cách bắt điểm khi click trên hình xem trước.")
        self.chkBatGiao = QCheckBox("Bắt giao điểm")
        self.chkBatGiao.setChecked(True)
        self.chkBatGiao.setToolTip("Khi bật: lúc chọn điểm, giao điểm của từng cặp đường biên hiện thành vòng tròn cam;\n"
                                   "click gần vòng tròn đó sẽ lấy đúng giao điểm (chính xác, không làm tròn theo lưới).\n"
                                   "Hai đường song song hoặc giao điểm nằm ngoài khung nhìn thì không có vòng tròn.")
        # Kiểu tương tác chuột: 5 nút bật / tắt (chỉ một nút sáng), khỏi phải mở danh sách thả xuống. Hộp danh sách
        # cbTuongTac vẫn giữ làm nguồn dữ liệu (lưu / mở dự án, hoàn tác dùng chỉ số của nó) nhưng không hiện ra;
        # nút và hộp luôn đồng bộ với nhau (xem _dong_bo_nut_che_do).
        self.cbTuongTac = QComboBox(self)
        self.cbTuongTac.hide()
        self.nhomTT = QButtonGroup(self)
        self.nhomTT.setExclusive(True)
        hang_tt = QHBoxLayout()
        hang_tt.setSpacing(4)
        for i, (ten_day_du, ten_nut, goi_y) in enumerate(self._CAC_CHE_DO):
            self.cbTuongTac.addItem(ten_day_du, i)
            b = QPushButton(ten_nut)
            b.setCheckable(True)
            b.setMinimumHeight(32)
            b.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            b.setToolTip(goi_y)
            self.nhomTT.addButton(b, i)
            hang_tt.addWidget(b, 1)
        self.nhomTT.button(0).setChecked(True)
        self.btnXoaDiem = QPushButton("Xóa hết điểm")
        self.btnXoaDiem.setToolTip("Xóa tất cả điểm đã đánh dấu trên các đường biên.")
        self.btnXoaDiem.setEnabled(False)
        self.btnHuyChon = QPushButton("Hủy chọn")
        self.btnHuyChon.hide()
        thanh = QHBoxLayout()                    # dòng hướng dẫn (đổi theo kiểu tương tác) và nút hủy chọn
        thanh.addWidget(self.lblChon, 1)
        thanh.addWidget(self.btnHuyChon)
        thanh2 = QHBoxLayout()                   # cách bắt điểm và xóa điểm
        thanh2.addWidget(QLabel("Bắt điểm:"))
        thanh2.addWidget(self.cbBat)
        thanh2.addSpacing(10)
        thanh2.addWidget(self.chkBatGiao)
        thanh2.addStretch(1)
        thanh2.addWidget(self.btnXoaDiem)
        lp.addLayout(hang_tt)                    # dòng 1: kiểu tương tác chuột
        lp.addLayout(thanh2)                     # dòng 2: bắt điểm, xóa hết điểm
        lp.addLayout(thanh)                      # hướng dẫn ngay phía trên hình
        lp.addWidget(self.tabs, 1)
        lp.addWidget(self.lblTrangThai)

        chinh = QHBoxLayout(self)
        chinh.addWidget(trai)
        chinh.addWidget(phai, 1)

        # ---------- kết nối ----------
        for ed in (self.edXmin, self.edXmax, self.edYmin, self.edYmax, self.edBx, self.edBy):
            ed.textChanged.connect(lambda _t: self.LenLich())
        self.chkTuDong.toggled.connect(self._doi_che_do_buoc)
        self.btnKhung.clicked.connect(lambda _c=False: self.TuChonKhung())
        self.btnThem.clicked.connect(lambda _c=False: self.ThemHam())
        self.button1.clicked.connect(lambda _c=False: self.TaoMaBPT())
        self.btnCopy.clicked.connect(lambda _c=False: self.SaoChepMa())
        self.button2.clicked.connect(lambda _c=False: self.Khaibaomacdinh())
        self.button3.clicked.connect(self.close)
        self.btnUndo.clicked.connect(self.HoanTac)
        self.btnRedo.clicked.connect(self.LamLai)
        self.btnSave.clicked.connect(self.LuuDuAn)
        self.btnOpen.clicked.connect(self.MoDuAn)
        self.chkGhiChu.toggled.connect(lambda _b: self.LenLich())
        self.chkTenDiem.toggled.connect(lambda _b: self.LenLich())
        self.chkSoTruc.toggled.connect(lambda _b: self.LenLich())
        self.chkGachTruc.toggled.connect(lambda _b: self.LenLich())
        self.btnXoaDiem.clicked.connect(lambda _c=False: self._xoa_het_diem_phu())
        self.xem.themDiemPhu.connect(self._them_diem_phu)
        self.xem.xoaDiemPhu.connect(self._xoa_diem_phu)
        self.xem.batDauKeoDiem.connect(self._bat_dau_keo_diem)
        self.xem.keoDiemYeuCau.connect(self._keo_diem)
        self.xem.ketThucKeoDiem.connect(self._ket_thuc_keo_diem)
        self.cbTuongTac.currentIndexChanged.connect(lambda _i: self._cap_nhat_huong_dan())
        self.nhomTT.idClicked.connect(self.cbTuongTac.setCurrentIndex)           # bấm nút -> đổi kiểu tương tác
        self.cbTuongTac.currentIndexChanged.connect(self._dong_bo_nut_che_do)     # mở dự án / hoàn tác -> nút sáng theo
        self.xem.chonDiem.connect(self._nhan_diem)
        self.xem.lamLai.connect(self._lui_diem)
        self.xem.huyChon.connect(self.HuyChon)
        self.xem.batDauKeo.connect(self._bat_dau_keo_hinh)
        self.xem.keoYeuCau.connect(self._keo_hinh)
        self.xem.ketThucKeo.connect(self._ket_thuc_keo_hinh)
        self.cbTuongTac.currentIndexChanged.connect(lambda _i: self.xem.dat_che_do_keo(int(self.cbTuongTac.currentData() or 0)))
        self.btnHuyChon.clicked.connect(lambda _c=False: self.HuyChon())
        self.cbBat.currentIndexChanged.connect(lambda _i: self._doi_bat_diem())
        self.chkBatGiao.toggled.connect(lambda _b: self._doi_bat_diem())
        self._doi_bat_diem()
        self._cap_nhat_huong_dan()

        self.Khaibaomacdinh()

    # ------------------------- quản lý danh sách hàm -------------------------
    def ThemHam(self, text: str = '', chi_so_mau: Optional[int] = None,
                goc: int = -1, kc: float = 3.0, vt: Optional[int] = None,
                hien_nhan: bool = True, to_mau: bool = False, do_dam: int = 25):
        if chi_so_mau is None:
            chi_so_mau = 1 + len(self.hang) % (len(BANG_MAU) - 1)    # bỏ qua màu đen
        if vt is None:                       # vị trí nhãn mặc định xoay vòng để khỏi chồng nhau
            vt = round(VI_TRI_NHAN[len(self.hang) % len(VI_TRI_NHAN)] * 100)
        h = HangHam(len(self.hang) + 1, text, chi_so_mau, goc, kc, vt, hien_nhan,
                    to_mau, do_dam)
        h.thayDoi.connect(self.LenLich)
        h.yeuCauLen.connect(lambda hh: self._di_chuyen(hh, -1))
        h.yeuCauXuong.connect(lambda hh: self._di_chuyen(hh, +1))
        h.yeuCauXoa.connect(self._xoa)
        h.yeuCauChon.connect(self._chon_hang)
        self.hang.append(h)
        self.dsLayout.insertWidget(self.dsLayout.count() - 1, h)    # trước phần giãn cuối
        self._danh_so()
        self.LenLich()
        return h

    def _xoa(self, h: HangHam):
        if h not in self.hang:
            return
        if h is self._hang_chon:
            self.HuyChon()
        self._chot_vi_tri_diem()             # điểm gắn với hàm này và hàm khác thì đứng yên tại chỗ đang hiển thị
        self.hang.remove(h)
        # bỏ hàm vừa xóa khỏi các điểm gắn với nó; điểm không còn đường nào để gắn thì xóa theo
        con = []
        for p in self.state.points:
            rows = [r for r in p.get('rows', []) if r != h.uid]
            if rows:
                con.append({**p, 'rows': rows})
        self.state.points = con
        self.dsLayout.removeWidget(h)
        h.hide()
        h.setParent(None)
        h.deleteLater()
        self._danh_so()
        self.LenLich()

    def _di_chuyen(self, h: HangHam, delta: int):
        i = self.hang.index(h)
        j = i + delta
        if not 0 <= j < len(self.hang):
            return
        self.hang[i], self.hang[j] = self.hang[j], self.hang[i]
        self.dsLayout.removeWidget(h)
        self.dsLayout.insertWidget(j, h)
        self._danh_so()
        self.LenLich()

    # ------------------- điểm đánh dấu trên các đường biên -------------------
    # Mỗi điểm trong state.points: {'id', 'ten', 'x', 'y' (chuỗi phân số: vị trí gợi ý), 'rows' (uid của 1 - 2 hàng
    # mà điểm gắn vào)}. Điểm gắn với uid của hàng (không phải số thứ tự) nên đổi thứ tự hàm vẫn giữ đúng điểm.
    # Vị trí hiển thị do tao_canh suy ra từ các đường gắn với điểm (xem vi_tri_diem): giao điểm của hai đường,
    # hoặc điểm trên một đường. Mỗi đường có tối đa SO_DIEM_TOI_DA điểm; kéo các điểm đó (chế độ "Kéo điểm")
    # thì đường đổi theo: còn một điểm khác thì đường xoay quanh điểm đó, chỉ có một điểm thì đường tịnh tiến.
    def _ds_diem_phu(self, thay: Optional[Dict[str, Tuple[Fraction, Fraction]]] = None):
        """state.points -> danh sách (mã, tên, x, y, chỉ số các hàm gắn vào) cho tao_canh.
        thay: {mã: (x, y)} thay vị trí gợi ý (dùng khi kéo điểm). Bỏ điểm hỏng hoặc không còn hàng nào để gắn."""
        vi_tri = {h.uid: i for i, h in enumerate(self.hang)}
        ra = []
        for p in self.state.points:
            idx = tuple(vi_tri[r] for r in p.get('rows', []) if r in vi_tri)
            if not idx:
                continue
            try:
                x, y = Fraction(str(p.get('x'))), Fraction(str(p.get('y')))
            except (ValueError, ZeroDivisionError):
                continue
            ma = str(p.get('id', ''))
            if thay and ma in thay:
                x, y = thay[ma]
            ra.append((ma, str(p.get('ten', '?')), x, y, idx))
        return ra

    def _diem_hien(self, ma: str):
        """Điểm đang hiển thị (DiemPhu) có mã `ma`; None nếu không có hoặc đang bị ẩn."""
        if self.canh is None:
            return None
        return next((d for d in self.canh.diem_phu if d.ma == ma), None)

    def _dem_diem_tren(self, uid: str) -> int:
        """Số điểm đánh dấu đang gắn với hàng có mã uid."""
        return sum(1 for p in self.state.points if uid in p.get('rows', []))

    def _chot_vi_tri_diem(self):
        """Ghi vị trí đang hiển thị vào vị trí gợi ý của từng điểm, để điểm đứng yên khi các đường quanh nó đổi."""
        if self.canh is None:
            return
        hien = {d.ma: d for d in self.canh.diem_phu}
        for p in self.state.points:
            d = hien.get(p.get('id'))
            if d is not None:
                p['x'], p['y'] = str(d.x), str(d.y)

    def _them_diem_phu(self, ham, x, y):
        """Chế độ "Thêm / xóa điểm": đánh dấu một điểm tại (x, y), gắn với các đường `ham` (chỉ số hàng đi qua điểm):
        hai đường nếu là giao điểm, một đường nếu là điểm trên đường. Mỗi đường tối đa SO_DIEM_TOI_DA điểm."""
        ham = [i for i in ham if 0 <= i < len(self.hang)]
        if not ham:
            return
        for i in ham:
            if self._dem_diem_tren(self.hang[i].uid) >= SO_DIEM_TOI_DA:
                self._cap_nhat_huong_dan(f"Hàm {i + 1} đã có đủ {SO_DIEM_TOI_DA} điểm. "
                                         "Hãy xóa bớt một điểm trên đường đó trước khi thêm.", loi=True)
                return
        x, y = Fraction(x), Fraction(y)
        if self.canh is not None and any(d.x == x and d.y == y for d in self.canh.diem_phu):
            return                                # đã có điểm ở đó
        ten = ten_diem_ranh(p.get('ten', '') for p in self.state.points)
        self.state.points.append({'id': str(uuid.uuid4()), 'ten': ten, 'x': str(x), 'y': str(y),
                                  'rows': [self.hang[i].uid for i in ham]})
        self.LenLich()                            # LenLich so snapshot cũ / mới và tự ghi mốc hoàn tác
        self.LamMoi()                             # vẽ lại ngay, không chờ bộ hẹn giờ
        self._cap_nhat_huong_dan(f"Đã thêm điểm {ten}.")

    def _xoa_diem_phu(self, ma: str):
        """Chế độ "Thêm / xóa điểm": bấm vào một điểm đã đánh dấu (hoặc chuột phải) thì xóa điểm đó."""
        con_lai = [p for p in self.state.points if p.get('id') != ma]
        if len(con_lai) == len(self.state.points):
            return
        self.state.points = con_lai
        self.LenLich()
        self.LamMoi()

    def _xoa_het_diem_phu(self):
        if not self.state.points:
            return
        self.state.points = []
        self.LenLich()
        self.LamMoi()

    # ----------------- kéo điểm: các đường gắn với điểm đổi theo -----------------
    @staticmethod
    def _chuan_so_nguyen(a: Fraction, b: Fraction, c: Fraction):
        """Nhân (a, b, c) với một số dương để được ba số nguyên tối giản (phần nghiệm a*x + b*y + c > 0 giữ nguyên)."""
        mau = 1
        for t in (a, b, c):
            mau = mau * t.denominator // math.gcd(mau, t.denominator)
        ia, ib, ic = int(a * mau), int(b * mau), int(c * mau)
        g = math.gcd(math.gcd(abs(ia), abs(ib)), abs(ic)) or 1
        return Fraction(ia // g), Fraction(ib // g), Fraction(ic // g)

    @staticmethod
    def _duong_theo_diem(st: dict, P):
        """Các đường gắn với điểm đang kéo khi điểm ở vị trí P = (x, y): {chỉ số hàng: (a, b, c)}.
        Đường còn một điểm khác thì xoay quanh điểm đó (đi qua P và điểm kia); đường chỉ có điểm này thì tịnh tiến,
        giữ hướng. Chiều (a, b) giữ cùng phía với chiều trước đó để phần nghiệm không bị lật.
        None nếu P trùng với điểm còn lại của một đường."""
        ra = {}
        for i, inf in st['dong'].items():
            q = inf['q']
            if q is None:
                a, b = inf['ori']
            else:
                if q == P:
                    return None
                a, b = q[1] - P[1], P[0] - q[0]           # pháp tuyến của đường đi qua P và q
                if a * inf['ori'][0] + b * inf['ori'][1] < 0:
                    a, b = -a, -b
            ra[i] = (a, b, -(a * P[0] + b * P[1]))
        return ra

    def _bat_dau_keo_diem(self, ma: str):
        self._pkeo = None
        d = self._diem_hien(ma)
        if d is None or self.canh is None:
            return
        he_ham = {h.chi_so: h.he for h in self.canh.ham}
        dong = {}
        for i in d.ham:
            he = he_ham.get(i)
            if he is None:
                continue
            # điểm còn lại gắn với đường này (nếu có): đường sẽ xoay quanh điểm đó
            q = next(((o.x, o.y) for o in self.canh.diem_phu if o.ma != ma and i in o.ham), None)
            dong[i] = {'q': q, 'ori': (he[0], he[1])}
        if not dong:
            return
        self._hen_gio.stop()                      # trong lúc kéo chỉ vẽ lại hình xem trước
        self._pkeo = {'ma': ma, 'dong': dong, 'ds': [h.du_lieu() for h in self.hang],
                      'moi': None, 'da_luu': False}
        self._bao("Đang kéo điểm…")

    def _keo_diem(self, ma: str, xf: float, yf: float):
        """Mỗi nhịp kéo: đặt điểm tại chuột, tính lại các đường gắn với điểm rồi vẽ lại hình xem trước.
        KHÔNG ghi vào ô nhập, KHÔNG sinh mã TikZ."""
        st = self._pkeo
        if not st or st['ma'] != ma:
            return
        try:
            P = (Fraction(xf), Fraction(yf))
        except (ValueError, OverflowError):
            return
        ra = self._duong_theo_diem(st, P)
        if ra is None:
            return
        if not st['da_luu']:                      # chỉ ghi một mốc hoàn tác, và chỉ khi thật sự có kéo
            self._luu_moc_lich_su()
            self._chot_vi_tri_diem()              # các điểm khác đứng yên khi đường xoay quanh chúng
            st['da_luu'] = True
        ds = list(st['ds'])
        for i, (a, b, c) in ra.items():
            ds[i] = replace(ds[i], he_so=(a, b, c))
            st['dong'][i]['ori'] = (a, b)
        try:
            canh = self._tinh(ds, self._ds_diem_phu({ma: P}))
        except LoiBPT:
            return
        st['moi'] = P
        self.xem.dat_canh(canh)

    def _ket_thuc_keo_diem(self):
        """Thả chuột: bắt điểm vào lưới theo mục "Bắt điểm", ghi hệ số mới của các đường vào ô nhập một lần,
        rồi tính lại đầy đủ."""
        st, self._pkeo = self._pkeo, None
        if st is None or not st['da_luu'] or st['moi'] is None or self.canh is None:
            if st is not None:
                self.LamMoi()                     # chỉ nhấp chuột, chưa kéo gì: trả hình về đúng trạng thái đã tính
            self.setFocus()
            return
        chia = max(1, int(self.xem.chia))
        bx, by = Fraction(self.canh.buoc_x), Fraction(self.canh.buoc_y)
        P = (self._lam_tron_luoi(st['moi'][0], bx, chia), self._lam_tron_luoi(st['moi'][1], by, chia))
        ra = self._duong_theo_diem(st, P)
        if ra is None:                            # sau khi bắt lưới, điểm trùng điểm còn lại của một đường
            if self._undo_stack:
                self._undo_stack.pop()            # bỏ mốc hoàn tác đã ghi: không có gì thay đổi
            self.LamMoi()
            self._cap_nhat_huong_dan("Hai điểm của cùng một đường không được trùng nhau.", loi=True)
            self.setFocus()
            return
        for p in self.state.points:
            if p.get('id') == st['ma']:
                p['x'], p['y'] = str(P[0]), str(P[1])
        for i, (a, b, c) in ra.items():
            a, b, c = self._chuan_so_nguyen(a, b, c)
            edit = self.hang[i].edit
            edit.blockSignals(True)               # tránh LenLich (đã có mốc hoàn tác ở nhịp kéo đầu tiên)
            edit.setText(self._bpt_tu_he_so(a, b, c))
            edit.blockSignals(False)
        self.LamMoi()
        self.setFocus()

    def _danh_so(self):
        n = len(self.hang)
        for i, h in enumerate(self.hang):
            h.dat_so_thu_tu(i + 1)
            h.dat_nut(i > 0, i < n - 1)

    # ------------------------- kéo trực tiếp hình học -------------------------
    @staticmethod
    def _fraction_text(v: Fraction) -> str:
        v = Fraction(v)
        return str(v.numerator) if v.denominator == 1 else f"({v.numerator}/{v.denominator})"

    @classmethod
    def _bpt_tu_he_so(cls, a: Fraction, b: Fraction, c: Fraction) -> str:
        """(a, b, c) với nghiệm a*x + b*y + c > 0 -> chuỗi nhập dạng 'ax+by>k' (hệ số đầu luôn dương)."""
        dau = '>'
        if (a if a != 0 else b) < 0:             # hệ số đầu âm: đổi dấu cả bất phương trình
            a, b, c, dau = -a, -b, -c, '<'
        ve_trai = ''
        for k, bien in ((a, 'x'), (b, 'y')):
            if k == 0:
                continue
            hs = '' if abs(k) == 1 else cls._fraction_text(abs(k))
            ve_trai += ('-' if k < 0 else ('+' if ve_trai else '')) + hs + bien
        return f"{ve_trai}{dau}{cls._fraction_text(-c)}"

    @staticmethod
    def _ucln_phan_so(p: Fraction, q: Fraction) -> Fraction:
        """Ước chung lớn nhất của hai số hữu tỉ không âm (0 nếu cả hai bằng 0)."""
        p, q = abs(Fraction(p)), abs(Fraction(q))
        if p == 0:
            return q
        if q == 0:
            return p
        m = p.denominator * q.denominator // math.gcd(p.denominator, q.denominator)
        return Fraction(math.gcd(int(p * m), int(q * m)), m)

    @staticmethod
    def _lam_tron_luoi(v: Fraction, buoc: Fraction, chia: int) -> Fraction:
        """Làm tròn v tới bội gần nhất của buoc/chia."""
        q = buoc / chia
        return round(v / q) * q

    def _bat_dau_keo_hinh(self, chi_so):
        self._keo_co_so = None
        self._keo_ds = None
        self._keo_da_luu = False
        self._keo_dx = self._keo_dy = 0.0
        if not chi_so:
            return
        co_so = {}
        for i in chi_so:
            if 0 <= i < len(self.hang):
                try:
                    co_so[i] = tuple(Fraction(v) for v in phan_tich_bpt(self.hang[i].edit.text()))
                except LoiBPT:
                    continue
        if not co_so:
            return
        diem0 = None                              # kéo giao điểm: toạ độ chính xác của giao điểm lúc bắt đầu
        if self.cbTuongTac.currentData() == 2 and self.canh is not None:
            for g in self.canh.giao_diem:
                if tuple(g.ham) == tuple(chi_so):
                    diem0 = (g.x, g.y)
                    break
        self._hen_gio.stop()                      # chặn lần tính lại đang chờ: trong lúc kéo chỉ vẽ lại hình
        self._keo_ds = [h.du_lieu() for h in self.hang]      # đọc các ô nhập một lần, không đọc lại mỗi nhịp
        self._keo_co_so = (tuple(chi_so), co_so, diem0)
        self._bao("Đang kéo hình…")

    def _keo_hinh(self, chi_so, dx: float, dy: float):
        """Mỗi nhịp kéo: tính lại Canh từ hệ số mới rồi vẽ lại hình xem trước. KHÔNG ghi vào ô nhập,
        KHÔNG sinh mã TikZ, KHÔNG đưa vào lịch sử hoàn tác, nên hình chạy theo chuột liên tục."""
        if not self._keo_co_so:
            return
        ids, co_so, _diem0 = self._keo_co_so
        if tuple(chi_so) != ids:
            return
        if not self._keo_da_luu:                  # chỉ ghi một mốc hoàn tác, và chỉ khi thật sự có kéo
            self._luu_moc_lich_su()
            self._keo_da_luu = True
        self._keo_dx, self._keo_dy = dx, dy
        fx, fy = Fraction(dx), Fraction(dy)
        ds = list(self._keo_ds)
        for i, (a, b, c) in co_so.items():
            # tịnh tiến đường đi qua điểm (dx, dy): a*x + b*y + c' = 0 với c' = c - a*dx - b*dy
            # (kéo đường riêng lẻ chỉ có thành phần theo pháp tuyến tác dụng nên cùng công thức)
            ds[i] = replace(ds[i], he_so=(a, b, c - a * fx - b * fy))
        try:
            canh = self._tinh(ds)
        except LoiBPT:
            return
        self.xem.dat_canh(canh)

    def _ket_thuc_keo_hinh(self):
        """Thả chuột: bắt vào lưới theo mục "Bắt điểm", ghi hệ số vào ô nhập một lần, tính lại đầy đủ."""
        st, self._keo_co_so = self._keo_co_so, None
        da_keo, self._keo_da_luu = self._keo_da_luu, False
        self._keo_ds = None
        if st is None or not da_keo or self.canh is None:     # chỉ nhấp chuột, chưa kéo gì
            if st is not None:
                self.LamMoi()                                  # trả hình về đúng trạng thái đã tính
            self.setFocus()
            return
        _ids, co_so, diem0 = st
        chia = max(1, int(self.xem.chia))
        bx, by = Fraction(self.canh.buoc_x), Fraction(self.canh.buoc_y)
        fx, fy = Fraction(self._keo_dx), Fraction(self._keo_dy)
        moi = {}
        if diem0 is not None:
            # kéo giao điểm: giao điểm mới rơi đúng vào điểm lưới; mọi đường đi qua nó cùng tịnh tiến
            X = self._lam_tron_luoi(diem0[0] + fx, bx, chia)
            Y = self._lam_tron_luoi(diem0[1] + fy, by, chia)
            for i, (a, b, c) in co_so.items():
                moi[i] = c - a * (X - diem0[0]) - b * (Y - diem0[1])
        else:
            # kéo đường: c mới làm tròn tới bội của lượng tử để đường đi qua điểm lưới
            for i, (a, b, c) in co_so.items():
                c_moi = c - a * fx - b * fy
                q = self._ucln_phan_so(a * bx / chia, b * by / chia)
                if q > 0:
                    c_moi = round(c_moi / q) * q
                moi[i] = c_moi
        doi = False
        for i, c_moi in moi.items():
            a, b, c = co_so[i]
            if c_moi == c:
                continue
            edit = self.hang[i].edit
            edit.blockSignals(True)               # tránh LenLich (đã có mốc hoàn tác ở nhịp kéo đầu tiên)
            edit.setText(self._bpt_tu_he_so(a, b, c_moi))
            edit.blockSignals(False)
            doi = True
        if not doi and self._undo_stack:          # kéo xong lại về đúng chỗ cũ: bỏ mốc hoàn tác thừa
            self._undo_stack.pop()
        self.LamMoi()                             # tính lại đầy đủ: hình, mã TikZ, trạng thái
        self.setFocus()

    # ------------------- nhập hàm bằng 3 điểm click trên hình -------------------
    def _mo_huong_dan(self):
        """F1: chuyển sang tab Hướng dẫn và về đầu trang."""
        self.tabs.setCurrentWidget(self.txtHuongDan)
        self.txtHuongDan.verticalScrollBar().setValue(0)

    def _dong_bo_nut_che_do(self, i: int):
        """Chỉ số của cbTuongTac đổi (do bấm nút, mở dự án hoặc hoàn tác): nút tương ứng sáng lên."""
        b = self.nhomTT.button(int(i))
        if b is not None and not b.isChecked():
            b.setChecked(True)

    def _doi_bat_diem(self):
        self.xem.chia = int(self.cbBat.currentData() or 1)
        self.xem.dat_bat_giao(self.chkBatGiao.isChecked())

    def _dong_bo_giao_diem(self):
        """Cấp cho hình xem trước các giao điểm có thể bắt. Bỏ đường biên của hàm đang được nhập
        (nó sắp bị thay), giữ lại những điểm còn ít nhất hai đường khác đi qua."""
        bo = self.hang.index(self._hang_chon) if self._hang_chon in self.hang else None
        ds = []
        if self.canh is not None:
            for g in self.canh.giao_diem:
                con = tuple(i for i in g.ham if i != bo)
                if len(con) >= 2:
                    ds.append(replace(g, ham=con))        # giữ nguyên tên và hướng đặt tên
        self.xem.dat_giao_diem(ds)

    def _chon_hang(self, h: HangHam):
        if self._hang_chon is h:
            self.HuyChon()                       # bấm lại nút đang bật = hủy
        else:
            self.BatDauChon(h)

    def BatDauChon(self, h: HangHam):
        if self.canh is None:
            h.dat_dang_chon(False)
            self._bao("Cần khung nhìn hợp lệ trước khi chọn điểm trên hình.", loi=True)
            return
        for x in self.hang:
            x.dat_dang_chon(x is h)
        self._hang_chon = h
        self._diem = []
        self.tabs.setCurrentIndex(0)             # chuyển sang tab hình xem trước
        self._dong_bo_giao_diem()
        self.xem.bat_chon(True)
        self.btnHuyChon.show()
        self._cap_nhat_huong_dan()

    def HuyChon(self):
        self._hang_chon = None
        self._diem = []
        for x in self.hang:
            x.dat_dang_chon(False)
        self._dong_bo_giao_diem()
        self.xem.bat_chon(False)
        self.btnHuyChon.hide()
        self._cap_nhat_huong_dan()

    def _lui_diem(self):
        """Click phải: bỏ điểm vừa chọn; chưa có điểm nào thì hủy."""
        if self._diem:
            self._diem.pop()
            self._cap_nhat_huong_dan()
        else:
            self.HuyChon()

    def _nhan_diem(self, u: float, v: float, giao=None):
        c = self.canh
        if self._hang_chon is None or c is None:
            return
        if giao is not None:                     # đã bắt vào giao điểm: dùng toạ độ chính xác
            p = (giao.x, giao.y)
        else:
            p = diem_tu_luoi(u, v, c.buoc_x, c.buoc_y, self.xem.chia)
        if len(self._diem) == 1 and p == self._diem[0]:
            self._cap_nhat_huong_dan("Điểm thứ hai trùng điểm thứ nhất, hãy chọn điểm khác.", loi=True)
            return
        self._diem.append(p)
        if len(self._diem) < 3:
            self._cap_nhat_huong_dan()
            return
        try:
            text = bpt_tu_3_diem(*self._diem)
        except LoiBPT as e:
            self._diem.pop()                     # giữ lại hai điểm đầu, cho chọn lại điểm thứ ba
            self._cap_nhat_huong_dan(str(e), loi=True)
            return
        hang = self._hang_chon
        stt = self.hang.index(hang) + 1
        self.HuyChon()
        hang.edit.setText(text)                  # kích hoạt vẽ lại qua tín hiệu của ô nhập
        self._cap_nhat_huong_dan(f"Đã nhập Hàm {stt}: {text}")

    def _cap_nhat_huong_dan(self, noi: str = '', loi: bool = False):
        if self._hang_chon is not None:
            stt = self.hang.index(self._hang_chon) + 1
            buoc = len(self._diem)
            viec = ("điểm thứ nhất trên đường biên",
                    "điểm thứ hai trên đường biên",
                    "một điểm thuộc miền nghiệm (miền không gạch sọc)")[buoc]
            chu = (f"Hàm {stt} - bước {buoc + 1}/3: click {viec}. "
                   "Chuột phải: lùi một bước. Esc: hủy.")
            if noi:
                chu = noi + "\n" + chu
            kieu = "color: #b00020;" if loi else "color: #d81b60; font-weight: bold;"
            self.xem.dat_diem_chon([(float(x), float(y)) for x, y in self._diem])
        else:
            che_do = int(self.cbTuongTac.currentData() or 0)
            goi_y = {
                1: "Kéo đường biên: rê chuột tới một đường (con trỏ thành mũi tên hai đầu vuông góc với đường), "
                   "giữ chuột rồi kéo để tịnh tiến song song.",
                2: "Kéo giao điểm: rê chuột tới giao điểm (con trỏ thành mũi tên bốn hướng), giữ chuột rồi kéo, "
                   "các đường đi qua điểm cùng di chuyển.",
                3: "Thêm / xóa điểm: rê chuột tới chỗ hai đường cắt nhau hoặc tới một đường (con trỏ có dấu + xanh) rồi bấm "
                   "để đánh dấu điểm; rê tới điểm đã đánh dấu (con trỏ có dấu × đỏ) rồi bấm để xóa. Mỗi đường tối đa 2 điểm.",
                4: "Kéo điểm: rê chuột tới điểm đã đánh dấu (con trỏ thành bàn tay), giữ chuột rồi kéo; "
                   "các đường đi qua điểm đổi theo.",
            }.get(che_do)
            chu = noi or goi_y or ("Mẹo: bấm “Chọn 3 điểm” ở một hàm, rồi click 2 điểm trên đường biên "
                                   "và 1 điểm trong miền nghiệm để nhập hàm.")
            kieu = "color: #2e7d32;" if noi else "color: #777777;"
        self.lblChon.setStyleSheet(kieu)
        self.lblChon.setText(chu)

    # ------------------------------ khung nhìn ------------------------------
    def _doi_che_do_buoc(self, tu_dong: bool):
        self.edBx.setEnabled(not tu_dong)
        self.edBy.setEnabled(not tu_dong)
        if not tu_dong and self.canh is not None and not self.edBx.text().strip():
            self.edBx.setText(format(self.canh.buoc_x.normalize(), 'f'))
            self.edBy.setText(format(self.canh.buoc_y.normalize(), 'f'))
        self.LenLich()

    @staticmethod
    def _chuoi_so(v: float) -> str:
        return f"{v:.12g}"

    def TuChonKhung(self):
        xmin, xmax, ymin, ymax = tu_dong_khung([h.du_lieu() for h in self.hang])
        self.edXmin.setText(self._chuoi_so(xmin))
        self.edXmax.setText(self._chuoi_so(xmax))
        self.edYmin.setText(self._chuoi_so(ymin))
        self.edYmax.setText(self._chuoi_so(ymax))
        self.edBx.clear()
        self.edBy.clear()
        self.chkTuDong.setChecked(True)
        self.LamMoi()

    # ------------------------- cập nhật xem trước, mã -------------------------
    def LenLich(self):
        if not self._dang_cap_nhat and not self._dang_khoi_phuc and self._last_snapshot is not None:
            hien_tai = self._chup_snapshot()
            if hien_tai != self._last_snapshot:
                self._undo_stack.append(deepcopy(self._last_snapshot))
                if len(self._undo_stack) > self._gioi_han_lich_su:
                    self._undo_stack.pop(0)
                self._redo_stack.clear()
                self._cap_nhat_trang_thai()
        self._hen_gio.start()

    def _tinh(self, ds_ham: Optional[List[Ham]] = None, diem=None) -> Canh:
        """Tính hình từ các ô nhập; ds_ham (nếu có) thay cho dữ liệu đọc từ các hàng (dùng khi kéo hình),
        diem (nếu có) thay cho danh sách điểm đánh dấu (dùng khi kéo điểm)."""
        xmin = doc_so(self.edXmin.text(), "X min")
        xmax = doc_so(self.edXmax.text(), "X max")
        ymin = doc_so(self.edYmin.text(), "Y min")
        ymax = doc_so(self.edYmax.text(), "Y max")
        bx = by = None
        if not self.chkTuDong.isChecked():
            bx = doc_buoc(self.edBx.text(), "Bước X")
            by = doc_buoc(self.edBy.text(), "Bước Y")
        if ds_ham is None:
            ds_ham = [h.du_lieu() for h in self.hang]
        if diem is None:
            diem = self._ds_diem_phu()
        return tao_canh(xmin, xmax, ymin, ymax, ds_ham, bx, by,
                        hien_so=self.chkSoTruc.isChecked(),
                        hien_gach=self.chkGachTruc.isChecked(),
                        diem=diem,
                        hien_ten_diem=self.chkTenDiem.isChecked())

    def LamMoi(self):
        if self._dang_cap_nhat:
            return
        self._hen_gio.stop()
        self._dang_cap_nhat = True
        try:
            canh = self._tinh()
        except LoiBPT as e:
            self.canh = None
            self.xem.dat_canh(None, str(e))
            self._dong_bo_giao_diem()
            self._dat_ma_tikz('')
            self._bao(str(e), loi=True)
            for h in self.hang:
                h.dat_loi('')
            self._dang_cap_nhat = False
            self._last_snapshot = self._chup_snapshot()
            self._cap_nhat_trang_thai()
            return
        self.canh = canh
        for i, h in enumerate(self.hang):
            h.dat_loi(canh.loi.get(i, ''))
        self.xem.dat_canh(canh)
        self._dong_bo_giao_diem()
        self._dat_ma_tikz(tao_tikz(canh, self.chkGhiChu.isChecked()))
        co_soc = any(h.da_giac and not h.to_mau for h in canh.ham)
        co_to = any(h.da_giac and h.to_mau for h in canh.ham)
        self.lblThuVien.setText(self._CHU_CHI_TO_MAU if (co_to and not co_soc)
                                else self._CHU_CAN_PATTERN)
        if canh.loi:
            i = min(canh.loi)
            self._bao(f"Hàm {i + 1}: {canh.loi[i]}", loi=True)
        else:
            n_diem = f", {len(canh.diem_phu)} điểm đánh dấu" if canh.diem_phu else ""
            self._bao(f"{len(canh.ham)} bất phương trình{n_diem}. Bước chia: "
                      f"X = {canh.buoc_x.normalize():f}, Y = {canh.buoc_y.normalize():f}")
        self._dong_bo_state()
        self._dang_cap_nhat = False
        self._last_snapshot = self._chup_snapshot()
        self._cap_nhat_trang_thai()

    def _dat_ma_tikz(self, ma: str):
        """Cập nhật vùng mã mà không phát sinh chuỗi tín hiệu ngược."""
        if self.txtTikz.toPlainText() == ma:
            return
        blocker = QSignalBlocker(self.txtTikz)
        self.txtTikz.setPlainText(ma)
        del blocker

    def _dong_bo_state(self):
        self.state.rows = [self._dong_hang(h) for h in self.hang]
        self.state.view = {
            'xmin': self.edXmin.text(), 'xmax': self.edXmax.text(),
            'ymin': self.edYmin.text(), 'ymax': self.edYmax.text(),
            'bx': self.edBx.text(), 'by': self.edBy.text(),
            'auto_step': self.chkTuDong.isChecked(),
            'show_point_names': self.chkTenDiem.isChecked(),
            'show_axis_numbers': self.chkSoTruc.isChecked(),
            'show_axis_ticks': self.chkGachTruc.isChecked(),
            'comments': self.chkGhiChu.isChecked(),
            'snap_mode': self.cbBat.currentIndex(),
            'snap_intersections': self.chkBatGiao.isChecked(),
            'drag_mode': self.cbTuongTac.currentIndex(),
        }
        self.state.selected_row_id = self._hang_chon.uid if self._hang_chon in self.hang else None
        self.state.selected_points = list(self._diem)

    @staticmethod
    def _dong_hang(h):
        return {
            'id': h.uid, 'text': h.edit.text(),
            'color_index': h.cbMau.currentIndex(), 'angle': h.spGoc.value(),
            'spacing': h.spKc.value(), 'label_position': h.spVt.value(),
            'show_label': h.chkNhan.isChecked(),
            'fill': h.cbKieu.currentIndex() == 1, 'opacity': h.spDam.value(),
        }

    def _cap_nhat_trang_thai(self):
        self.btnUndo.setEnabled(bool(self._undo_stack))
        self.btnRedo.setEnabled(bool(self._redo_stack))
        self.btnXoaDiem.setEnabled(bool(self.state.points))

    def _chup_snapshot(self):
        self._dong_bo_state()
        return deepcopy({
            'rows': self.state.rows, 'view': self.state.view,
            'selected_row_id': self.state.selected_row_id,
            'selected_points': self.state.selected_points,
            'points': self.state.points,
        })

    def _nap_snapshot(self, data):
        self._dang_khoi_phuc = True
        self._hen_gio.stop()
        self.HuyChon()
        for h in list(self.hang):
            self.dsLayout.removeWidget(h)
            h.hide(); h.setParent(None); h.deleteLater()
        self.hang.clear()
        for row in data.get('rows', []):
            h = self.ThemHam(row.get('text', ''), row.get('color_index', 1),
                             row.get('angle', -1), row.get('spacing', 3.0),
                             row.get('label_position', 75), row.get('show_label', True),
                             row.get('fill', False), row.get('opacity', 25))
            h.uid = row.get('id') or str(uuid.uuid4())
        v = data.get('view', {})
        for key, widget in (('xmin', self.edXmin), ('xmax', self.edXmax),
                            ('ymin', self.edYmin), ('ymax', self.edYmax),
                            ('bx', self.edBx), ('by', self.edBy)):
            widget.setText(str(v.get(key, widget.text())))
        self.chkTuDong.setChecked(v.get('auto_step', True))
        self.chkTenDiem.setChecked(v.get('show_point_names', True))
        self.chkSoTruc.setChecked(v.get('show_axis_numbers', True))
        self.chkGachTruc.setChecked(v.get('show_axis_ticks', True))
        self.chkGhiChu.setChecked(v.get('comments', True))
        self.cbBat.setCurrentIndex(v.get('snap_mode', 0))
        self.chkBatGiao.setChecked(v.get('snap_intersections', True))
        self.cbTuongTac.setCurrentIndex(v.get('drag_mode', 0))
        # điểm đánh dấu: chỉ nhận mục đủ khoá; điểm gắn với hàng không còn thì _ds_diem_phu tự bỏ qua
        diem = []
        for p in data.get('points', []):
            if not (isinstance(p, dict) and {'id', 'x', 'y', 'rows'} <= set(p) and isinstance(p['rows'], list)):
                continue
            q = dict(p)
            q['ten'] = q.get('ten') or ten_diem_ranh(d.get('ten', '') for d in diem)
            diem.append(q)
        self.state.points = diem
        selected_id = data.get('selected_row_id')
        selected = next((h for h in self.hang if h.uid == selected_id), None)
        if selected is not None:
            self._hang_chon = selected
            self._diem = list(data.get('selected_points', []))
            for h in self.hang: h.dat_dang_chon(h is selected)
            self.xem.bat_chon(True)
            self.btnHuyChon.show()
        self._danh_so()
        self._dang_khoi_phuc = False
        self.LamMoi()
        if selected is not None: self._cap_nhat_huong_dan()
        self._last_snapshot = self._chup_snapshot()

    def HoanTac(self):
        if not self._undo_stack: return
        self._redo_stack.append(self._chup_snapshot())
        data = self._undo_stack.pop()
        self._nap_snapshot(data)
        self._cap_nhat_trang_thai()

    def LamLai(self):
        if not self._redo_stack: return
        self._undo_stack.append(self._chup_snapshot())
        data = self._redo_stack.pop()
        self._nap_snapshot(data)
        self._cap_nhat_trang_thai()

    def _luu_moc_lich_su(self):
        self._undo_stack.append(self._chup_snapshot())
        if len(self._undo_stack) > self._gioi_han_lich_su:
            self._undo_stack.pop(0)
        self._redo_stack.clear()
        self._cap_nhat_trang_thai()

    def LuuDuAn(self):
        from PyQt6.QtWidgets import QFileDialog
        path, _ = QFileDialog.getSaveFileName(self, 'Lưu dự án', '', 'Dự án BPTBN (*.json)')
        if not path: return
        self._dong_bo_state()
        data = {'version': 1, 'rows': self.state.rows, 'view': self.state.view,
                'points': self.state.points}
        try:
            Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            self._bao(f'Đã lưu dự án: {path}')
        except OSError as e:
            QMessageBox.critical(self, 'Không thể lưu dự án', str(e))

    def MoDuAn(self):
        from PyQt6.QtWidgets import QFileDialog
        path, _ = QFileDialog.getOpenFileName(self, 'Mở dự án', '', 'Dự án BPTBN (*.json)')
        if not path: return
        try:
            data = json.loads(Path(path).read_text(encoding='utf-8'))
            if data.get('version') != 1 or not isinstance(data.get('rows'), list):
                raise ValueError('Định dạng dự án không được hỗ trợ.')
            self._luu_moc_lich_su()
            self._nap_snapshot(data)
            self._bao(f'Đã mở dự án: {path}')
        except (OSError, ValueError, json.JSONDecodeError) as e:
            QMessageBox.critical(self, 'Không thể mở dự án', str(e))

    def _bao(self, noi_dung: str, loi: bool = False):
        self.lblTrangThai.setStyleSheet("color: #b00020;" if loi else "color: #555555;")
        self.lblTrangThai.setText(noi_dung)

    # ------------------------------- nút lệnh -------------------------------
    def _lay_ma(self) -> Optional[str]:
        """Tính lại rồi trả về mã TikZ hiện tại; None (kèm thông báo) nếu chưa có gì để vẽ."""
        self.LamMoi()
        if self.canh is None:
            QMessageBox.warning(self, "Chưa thể tạo mã", self.lblTrangThai.text())
            return None
        if not self.canh.ham:
            QMessageBox.information(self, "Thông báo",
                                    "Chưa có bất phương trình hợp lệ nào để vẽ.")
            return None
        return tao_tikz(self.canh, self.chkGhiChu.isChecked()).strip()

    def SaoChepMa(self):
        """Sao chép đúng mã đang hiện ở tab "Mã TikZ" vào clipboard."""
        ma = self._lay_ma()
        if ma is None:
            return
        QApplication.clipboard().setText(ma + '\n')
        self.btnCopy.setText("Đã sao chép ✓")
        self._hen_copy.start()
        self._bao("Đã sao chép mã TikZ vào clipboard.")

    def TaoMaBPT(self):
        try:
            ma = self._lay_ma()
            if ma is None:
                return
            soan_thao = getattr(self.parent_window, 'text_edit_tikz', None)
            if soan_thao is not None:
                cursor = soan_thao.textCursor()
                cursor.insertText(ma)
                soan_thao.setTextCursor(cursor)
            else:
                QApplication.clipboard().setText(ma)
                self._bao("Không tìm thấy khung soạn thảo của cửa sổ chính; "
                          "đã sao chép mã TikZ vào clipboard.")
        except Exception as e:
            msg = QMessageBox()
            msg.setIcon(QMessageBox.Icon.Critical)
            msg.setText("Đã xảy ra lỗi:")
            msg.setInformativeText(str(e))
            msg.setWindowTitle("Lỗi")
            msg.exec()

    def Khaibaomacdinh(self):
        self._undo_stack.clear(); self._redo_stack.clear()
        self.HuyChon()
        self.state.points = []
        for h in list(self.hang):
            self.dsLayout.removeWidget(h)
            h.hide()
            h.setParent(None)
            h.deleteLater()
        self.hang.clear()
        for ed, v in ((self.edXmin, "-5"), (self.edXmax, "5"),
                      (self.edYmin, "-5"), (self.edYmax, "5")):
            ed.setText(v)
        self.edBx.clear()
        self.edBy.clear()
        self.chkTuDong.setChecked(True)
        for _ in range(3):
            self.ThemHam()
        self.LamMoi()
        self._undo_stack.clear(); self._redo_stack.clear()
        self._last_snapshot = self._chup_snapshot()
        self._cap_nhat_trang_thai()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    hop = BPTBNSDialog()
    hop.show()
    sys.exit(app.exec())
