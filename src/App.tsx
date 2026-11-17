import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  ImageDown,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { GuideTab } from './components/GuideTab';
import { InequalityRow, RowModel } from './components/InequalityRow';
import { PreviewCanvas, PreviewCanvasHandle } from './components/PreviewCanvas';
import { TikzCodeTab } from './components/TikzCodeTab';
import { ExactDecimal } from './math/decimal';
import { Fraction } from './math/fraction';
import {
  BANG_MAU,
  Canh,
  Dang,
  DiemInput,
  GiaoDiem,
  Ham,
  KeoDiemDongInfo,
  LoiBPT,
  SO_DIEM_TOI_DA,
  VI_TRI_NHAN,
  bpt_tu_3_diem,
  bpt_tu_he_so,
  chuan_so_nguyen,
  diem_tu_luoi,
  duong_theo_diem,
  lam_tron_luoi,
  phan_tich_bpt,
  tao_canh,
  tao_tikz,
  ten_diem_ranh,
  tu_dong_khung,
  ucln_phan_so,
} from './math/inequality';

interface ViewSettings {
  xmin: string;
  xmax: string;
  ymin: string;
  ymax: string;
  bx: string;
  by: string;
  autoStep: boolean;
  showPointNames: boolean;
  showAxisNumbers: boolean;
  showAxisTicks: boolean;
  comments: boolean;
  snapMode: number; // 0: Vạch chia (1), 1: Nửa vạch chia (2), 2: Tự do (100)
  snapIntersections: boolean;
  dragMode: number; // 0..4
}

interface MarkedPointState {
  id: string;
  ten: string;
  x: string;
  y: string;
  rows: string[];
}

interface AppSnapshot {
  rows: RowModel[];
  view: ViewSettings;
  points: MarkedPointState[];
}

type ActiveTab = 'preview' | 'tikz' | 'guide';

const SNAP_DIVISIONS = [1, 2, 100] as const;
const MAX_HISTORY = 60;

const INTERACTION_MODES = [
  {
    id: 0,
    shortLabel: 'Không kéo',
    tip: 'Không kéo: chỉ xem hình, chuột không làm thay đổi gì.',
    guide:
      'Mẹo: bấm “Chọn 3 điểm” ở một hàm, rồi click 2 điểm trên đường biên và 1 điểm trong miền nghiệm để nhập hàm.',
  },
  {
    id: 1,
    shortLabel: 'Kéo đường',
    tip: 'Kéo đường biên: giữ chuột trên một đường rồi kéo để tịnh tiến song song.',
    guide:
      'Kéo đường biên: rê chuột tới một đường (con trỏ thành mũi tên hai đầu vuông góc với đường), giữ chuột rồi kéo để tịnh tiến song song.',
  },
  {
    id: 2,
    shortLabel: 'Kéo giao điểm',
    tip: 'Kéo giao điểm: giữ chuột trên giao điểm rồi kéo; các đường đi qua điểm cùng di chuyển, giữ nguyên hướng.',
    guide:
      'Kéo giao điểm: rê chuột tới giao điểm (con trỏ thành mũi tên bốn hướng), giữ chuột rồi kéo, các đường đi qua điểm cùng di chuyển.',
  },
  {
    id: 3,
    shortLabel: 'Thêm / xóa điểm',
    tip: 'Thêm / xóa điểm: bấm vào giao điểm hoặc đường để đánh dấu A, B, C…; bấm vào điểm đã đánh dấu để xóa.',
    guide:
      'Thêm / xóa điểm: rê chuột tới chỗ hai đường cắt nhau hoặc tới một đường (dấu + xanh) rồi bấm để đánh dấu; rê tới điểm đã đánh dấu (dấu × đỏ) để xóa. Mỗi đường tối đa 2 điểm.',
  },
  {
    id: 4,
    shortLabel: 'Kéo điểm',
    tip: 'Kéo điểm: kéo một điểm đã đánh dấu; các đường đi qua điểm xoay quanh điểm còn lại hoặc tịnh tiến.',
    guide:
      'Kéo điểm: rê chuột tới điểm đã đánh dấu (con trỏ thành bàn tay), giữ chuột rồi kéo; các đường đi qua điểm đổi theo.',
  },
] as const;

const CHUTHUYEN_PATTERN = 'Cần \\usetikzlibrary{patterns.meta} trong phần khai báo.';
const CHUTHUYEN_FILL_ONLY =
  'Chỉ có hàm tô màu: không cần thư viện TikZ bổ sung (tô trong suốt dùng được với pdfLaTeX, XeLaTeX, LuaLaTeX).';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultView(): ViewSettings {
  return {
    xmin: '-5',
    xmax: '5',
    ymin: '-5',
    ymax: '5',
    bx: '',
    by: '',
    autoStep: true,
    showPointNames: true,
    showAxisNumbers: true,
    showAxisTicks: true,
    comments: true,
    snapMode: 0,
    snapIntersections: true,
    dragMode: 0,
  };
}

function createRow(index: number, overrides: Partial<RowModel> = {}): RowModel {
  const colorIndex = 1 + (index % (BANG_MAU.length - 1));
  const labelPos = Math.round(VI_TRI_NHAN[index % VI_TRI_NHAN.length] * 100);
  return {
    id: makeId(),
    text: '',
    colorIndex,
    angle: -1,
    spacing: 3.0,
    labelPosition: labelPos,
    showLabel: true,
    fill: false,
    opacity: 25,
    ...overrides,
  };
}

function createSeedSnapshot(): AppSnapshot {
  const r0 = createRow(0, { text: '2x+3y<6', colorIndex: 3, labelPosition: 38 });
  const r1 = createRow(1, { text: 'x>0', colorIndex: 1, fill: true, opacity: 20 });
  const r2 = createRow(2, { text: 'y>0', colorIndex: 5 });
  return {
    rows: [r0, r1, r2],
    view: defaultView(),
    points: [
      { id: makeId(), ten: 'A', x: '0', y: '2', rows: [r0.id, r1.id] },
      { id: makeId(), ten: 'B', x: '3', y: '0', rows: [r0.id, r2.id] },
    ],
  };
}

function createBlankSnapshot(): AppSnapshot {
  return {
    rows: [createRow(0), createRow(1), createRow(2)],
    view: defaultView(),
    points: [],
  };
}

function cloneSnapshot(snap: AppSnapshot): AppSnapshot {
  return {
    rows: snap.rows.map((r) => ({ ...r })),
    view: { ...snap.view },
    points: snap.points.map((p) => ({ ...p, rows: [...p.rows] })),
  };
}

function snapshotsEqual(a: AppSnapshot, b: AppSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function rowsToHam(rows: RowModel[], overrides?: Record<number, Dang>): Ham[] {
  return rows.map((r, i) => ({
    text: r.text,
    mau: BANG_MAU[r.colorIndex]?.tikz ?? 'blue',
    goc: r.angle < 0 ? null : r.angle,
    kc: r.spacing,
    vi_tri: r.labelPosition / 100,
    hien_nhan: r.showLabel,
    to_mau: r.fill,
    do_dam: r.opacity,
    he_so: overrides?.[i] ?? null,
  }));
}

function buildPointsInput(
  points: MarkedPointState[],
  rows: RowModel[],
  posOverrides?: Record<string, [Fraction, Fraction]>
): DiemInput[] {
  const idxMap = new Map<string, number>();
  rows.forEach((r, i) => idxMap.set(r.id, i));
  const out: DiemInput[] = [];
  for (const p of points) {
    const idx = p.rows.map((rid) => idxMap.get(rid)).filter((n): n is number => n !== undefined);
    if (idx.length === 0) continue;
    try {
      let fx = Fraction.fromString(p.x);
      let fy = Fraction.fromString(p.y);
      if (posOverrides && posOverrides[p.id]) {
        [fx, fy] = posOverrides[p.id];
      }
      out.push([p.id, p.ten, fx, fy, idx]);
    } catch {
      continue;
    }
  }
  return out;
}

function parseDocSo(text: string, label: string): number {
  const t = text.trim().replace(/,/g, '.');
  if (!t) throw new LoiBPT(`${label}: chưa nhập`);
  const v = Number(t);
  if (Number.isNaN(v)) throw new LoiBPT(`${label}: '${text.trim()}' không phải là số`);
  if (!Number.isFinite(v) || Math.abs(v) > 1e15) {
    throw new LoiBPT(`${label}: giá trị quá lớn (tối đa 1e15)`);
  }
  return v;
}

function parseDocBuoc(text: string, label: string): ExactDecimal {
  const t = text.trim().replace(/,/g, '.');
  if (!t) throw new LoiBPT(`${label}: chưa nhập`);
  let d: ExactDecimal;
  try {
    d = ExactDecimal.parse(t);
  } catch {
    throw new LoiBPT(`${label}: '${text.trim()}' không phải là số`);
  }
  if (!d.isPositive()) throw new LoiBPT(`${label} phải là số dương`);
  return d;
}

function computeCanhFromSnapshot(
  snap: AppSnapshot,
  lineOverrides?: Record<number, Dang>,
  pointOverrides?: Record<string, [Fraction, Fraction]>
): { canh: Canh | null; error: string } {
  try {
    const xmin = parseDocSo(snap.view.xmin, 'X min');
    const xmax = parseDocSo(snap.view.xmax, 'X max');
    const ymin = parseDocSo(snap.view.ymin, 'Y min');
    const ymax = parseDocSo(snap.view.ymax, 'Y max');
    let bx: ExactDecimal | null = null;
    let by: ExactDecimal | null = null;
    if (!snap.view.autoStep) {
      bx = parseDocBuoc(snap.view.bx, 'Bước X');
      by = parseDocBuoc(snap.view.by, 'Bước Y');
    }
    const dsHam = rowsToHam(snap.rows, lineOverrides);
    const diem = buildPointsInput(snap.points, snap.rows, pointOverrides);
    const canh = tao_canh(xmin, xmax, ymin, ymax, dsHam, {
      buoc_x: bx,
      buoc_y: by,
      hien_so: snap.view.showAxisNumbers,
      hien_gach: snap.view.showAxisTicks,
      diem,
      hien_ten_diem: snap.view.showPointNames,
    });
    return { canh, error: '' };
  } catch (e) {
    if (e instanceof LoiBPT) {
      return { canh: null, error: e.message };
    }
    return { canh: null, error: String(e) };
  }
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => createSeedSnapshot());
  const [undoStack, setUndoStack] = useState<AppSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<AppSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [copied, setCopied] = useState(false);

  // 3-point entry state
  const [selectingRowId, setSelectingRowId] = useState<string | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<Array<[Fraction, Fraction]>>([]);
  const [instructionOverride, setInstructionOverride] = useState<{ text: string; isError: boolean } | null>(null);

  // Live drag preview state (separate from committed snapshot so dragging never triggers TikZ regen or undo spam)
  const [liveDragCanh, setLiveDragCanh] = useState<Canh | null>(null);
  const [dragBanner, setDragBanner] = useState<string | null>(null);

  const dragLinesStateRef = useRef<{
    ids: number[];
    coSo: Record<number, Dang>;
    diem0: [Fraction, Fraction] | null;
    snapBase: AppSnapshot;
    dx: number;
    dy: number;
    moved: boolean;
  } | null>(null);

  const dragPointStateRef = useRef<{
    ma: string;
    dong: Record<number, KeoDiemDongInfo>;
    snapBase: AppSnapshot;
    moi: [Fraction, Fraction] | null;
    moved: boolean;
  } | null>(null);

  const canvasRef = useRef<PreviewCanvasHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Commit helper that records undo history automatically
  const commitSnapshot = useCallback(
    (updater: (prev: AppSnapshot) => AppSnapshot, recordHistory = true) => {
      setSnapshot((prev) => {
        const next = updater(prev);
        if (snapshotsEqual(prev, next)) return prev;
        if (recordHistory) {
          setUndoStack((u) => {
            const updated = [...u, cloneSnapshot(prev)];
            return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
          });
          setRedoStack([]);
        }
        return next;
      });
    },
    []
  );

  // Computed scene and TikZ code from committed snapshot
  const { canh: committedCanh, error: viewError } = useMemo(
    () => computeCanhFromSnapshot(snapshot),
    [snapshot]
  );

  const displayedCanh = liveDragCanh ?? committedCanh;

  const tikzCode = useMemo(() => {
    if (!committedCanh) return '';
    return tao_tikz(committedCanh, snapshot.view.comments);
  }, [committedCanh, snapshot.view.comments]);

  const libraryNotice = useMemo(() => {
    if (!committedCanh) return CHUTHUYEN_PATTERN;
    const coSoc = committedCanh.ham.some((h) => h.da_giac.length > 0 && !h.to_mau);
    const coTo = committedCanh.ham.some((h) => h.da_giac.length > 0 && h.to_mau);
    return coTo && !coSoc ? CHUTHUYEN_FILL_ONLY : CHUTHUYEN_PATTERN;
  }, [committedCanh]);

  // Intersections available for 3-point capture (excluding boundary of row currently being entered)
  const selectableIntersections = useMemo<GiaoDiem[]>(() => {
    if (!committedCanh) return [];
    const skipIdx = selectingRowId
      ? snapshot.rows.findIndex((r) => r.id === selectingRowId)
      : -1;
    const list: GiaoDiem[] = [];
    for (const g of committedCanh.giao_diem) {
      const remaining = g.ham.filter((idx) => idx !== skipIdx);
      if (remaining.length >= 2) {
        list.push({ ...g, ham: remaining });
      }
    }
    return list;
  }, [committedCanh, selectingRowId, snapshot.rows]);

  // Status line computation
  const statusInfo = useMemo<{ text: string; isError: boolean }>(() => {
    if (dragBanner) return { text: dragBanner, isError: false };
    if (viewError) return { text: viewError, isError: true };
    if (!committedCanh) return { text: '', isError: false };
    const errKeys = Object.keys(committedCanh.loi).map(Number);
    if (errKeys.length > 0) {
      const firstIdx = Math.min(...errKeys);
      return {
        text: `Hàm ${firstIdx + 1}: ${committedCanh.loi[firstIdx]}`,
        isError: true,
      };
    }
    const nPoints = committedCanh.diem_phu.length;
    const ptsText = nPoints > 0 ? `, ${nPoints} điểm đánh dấu` : '';
    return {
      text: `${committedCanh.ham.length} bất phương trình${ptsText}. Bước chia: X = ${committedCanh.buoc_x.toFixedPlain()}, Y = ${committedCanh.buoc_y.toFixedPlain()}`,
      isError: false,
    };
  }, [committedCanh, dragBanner, viewError]);

  // Instruction banner above preview
  const instructionInfo = useMemo<{ text: string; tone: 'pink' | 'error' | 'success' | 'muted' }>(() => {
    if (selectingRowId) {
      const stt = snapshot.rows.findIndex((r) => r.id === selectingRowId) + 1;
      const step = selectedPoints.length;
      const action =
        step === 0
          ? 'điểm thứ nhất trên đường biên'
          : step === 1
          ? 'điểm thứ hai trên đường biên'
          : 'một điểm thuộc miền nghiệm (miền không gạch sọc)';
      const base = `Hàm ${stt} — bước ${step + 1}/3: click ${action}. Chuột phải: lùi một bước. Esc: hủy.`;
      if (instructionOverride) {
        return {
          text: `${instructionOverride.text} — ${base}`,
          tone: instructionOverride.isError ? 'error' : 'pink',
        };
      }
      return { text: base, tone: 'pink' };
    }
    if (instructionOverride) {
      return {
        text: instructionOverride.text,
        tone: instructionOverride.isError ? 'error' : 'success',
      };
    }
    const mode = INTERACTION_MODES[snapshot.view.dragMode] ?? INTERACTION_MODES[0];
    return { text: mode.guide, tone: 'muted' };
  }, [instructionOverride, selectedPoints.length, selectingRowId, snapshot.rows, snapshot.view.dragMode]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const prevSnap = u[u.length - 1];
      setRedoStack((r) => [...r, cloneSnapshot(snapshot)]);
      setSnapshot(cloneSnapshot(prevSnap));
      setSelectingRowId(null);
      setSelectedPoints([]);
      setInstructionOverride(null);
      return u.slice(0, -1);
    });
  }, [snapshot]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const nextSnap = r[r.length - 1];
      setUndoStack((u) => [...u, cloneSnapshot(snapshot)]);
      setSnapshot(cloneSnapshot(nextSnap));
      setSelectingRowId(null);
      setSelectedPoints([]);
      setInstructionOverride(null);
      return r.slice(0, -1);
    });
  }, [snapshot]);

  const copyTikzToClipboard = useCallback(
    async (switchToTab = false) => {
      if (!committedCanh) {
        setInstructionOverride({ text: viewError || 'Chưa có khung nhìn hợp lệ.', isError: true });
        return;
      }
      if (committedCanh.ham.length === 0) {
        setInstructionOverride({
          text: 'Chưa có bất phương trình hợp lệ nào để tạo mã TikZ.',
          isError: true,
        });
        return;
      }
      const text = tikzCode.trim() + '\n';
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback copy when clipboard API is restricted
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
      if (switchToTab) {
        setActiveTab('tikz');
        setInstructionOverride({ text: 'Đã tạo và sao chép mã TikZ vào clipboard.', isError: false });
      } else {
        setInstructionOverride({ text: 'Đã sao chép mã TikZ vào clipboard.', isError: false });
      }
    },
    [committedCanh, tikzCode, viewError]
  );

  // Project save / load (.json compatible with PyQt6 version 1)
  const handleSaveProject = useCallback(() => {
    const data = {
      version: 1,
      rows: snapshot.rows.map((r) => ({
        id: r.id,
        text: r.text,
        color_index: r.colorIndex,
        angle: r.angle,
        spacing: r.spacing,
        label_position: r.labelPosition,
        show_label: r.showLabel,
        fill: r.fill,
        opacity: r.opacity,
      })),
      view: {
        xmin: snapshot.view.xmin,
        xmax: snapshot.view.xmax,
        ymin: snapshot.view.ymin,
        ymax: snapshot.view.ymax,
        bx: snapshot.view.bx,
        by: snapshot.view.by,
        auto_step: snapshot.view.autoStep,
        show_point_names: snapshot.view.showPointNames,
        show_axis_numbers: snapshot.view.showAxisNumbers,
        show_axis_ticks: snapshot.view.showAxisTicks,
        comments: snapshot.view.comments,
        snap_mode: snapshot.view.snapMode,
        snap_intersections: snapshot.view.snapIntersections,
        drag_mode: snapshot.view.dragMode,
      },
      points: snapshot.points,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'du-an-bptbn.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setInstructionOverride({ text: 'Đã xuất tệp dự án du-an-bptbn.json.', isError: false });
  }, [snapshot]);

  const handleOpenProjectFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const raw = await file.text();
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !Array.isArray(data.rows)) {
          throw new Error('Định dạng dự án không được hỗ trợ.');
        }
        const loadedRows: RowModel[] = data.rows.map((row: Record<string, unknown>, idx: number) => ({
          id: typeof row.id === 'string' && row.id ? row.id : makeId(),
          text: typeof row.text === 'string' ? row.text : '',
          colorIndex: typeof row.color_index === 'number' ? row.color_index : 1 + (idx % (BANG_MAU.length - 1)),
          angle: typeof row.angle === 'number' ? row.angle : -1,
          spacing: typeof row.spacing === 'number' ? row.spacing : 3.0,
          labelPosition: typeof row.label_position === 'number' ? row.label_position : 75,
          showLabel: typeof row.show_label === 'boolean' ? row.show_label : true,
          fill: typeof row.fill === 'boolean' ? row.fill : false,
          opacity: typeof row.opacity === 'number' ? row.opacity : 25,
        }));
        const v = (data.view ?? {}) as Record<string, unknown>;
        const loadedView: ViewSettings = {
          xmin: String(v.xmin ?? '-5'),
          xmax: String(v.xmax ?? '5'),
          ymin: String(v.ymin ?? '-5'),
          ymax: String(v.ymax ?? '5'),
          bx: String(v.bx ?? ''),
          by: String(v.by ?? ''),
          autoStep: typeof v.auto_step === 'boolean' ? v.auto_step : true,
          showPointNames: typeof v.show_point_names === 'boolean' ? v.show_point_names : true,
          showAxisNumbers: typeof v.show_axis_numbers === 'boolean' ? v.show_axis_numbers : true,
          showAxisTicks: typeof v.show_axis_ticks === 'boolean' ? v.show_axis_ticks : true,
          comments: typeof v.comments === 'boolean' ? v.comments : true,
          snapMode: typeof v.snap_mode === 'number' ? v.snap_mode : 0,
          snapIntersections: typeof v.snap_intersections === 'boolean' ? v.snap_intersections : true,
          dragMode: typeof v.drag_mode === 'number' ? v.drag_mode : 0,
        };
        const loadedPoints: MarkedPointState[] = [];
        if (Array.isArray(data.points)) {
          for (const p of data.points) {
            if (p && typeof p === 'object' && 'id' in p && 'x' in p && 'y' in p && Array.isArray(p.rows)) {
              loadedPoints.push({
                id: String(p.id),
                ten: p.ten ? String(p.ten) : ten_diem_ranh(loadedPoints.map((q) => q.ten)),
                x: String(p.x),
                y: String(p.y),
                rows: p.rows.map(String),
              });
            }
          }
        }
        setSelectingRowId(null);
        setSelectedPoints([]);
        commitSnapshot(() => ({
          rows: loadedRows.length > 0 ? loadedRows : [createRow(0)],
          view: loadedView,
          points: loadedPoints,
        }));
        setInstructionOverride({ text: `Đã mở dự án: ${file.name}`, isError: false });
      } catch (err) {
        setInstructionOverride({
          text: err instanceof Error ? err.message : 'Không thể đọc tệp dự án.',
          isError: true,
        });
      }
    },
    [commitSnapshot]
  );

  // Global keyboard shortcuts matching Python app
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('guide');
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        void copyTikzToClipboard(true);
      } else if (e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        void copyTikzToClipboard(false);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          handleUndo();
        }
      } else if (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copyTikzToClipboard, handleRedo, handleSaveProject, handleUndo]);

  // Row mutations
  const handleRowChange = (id: string, patch: Partial<RowModel>) => {
    setInstructionOverride(null);
    commitSnapshot((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const handleAddRow = () => {
    setInstructionOverride(null);
    commitSnapshot((prev) => ({
      ...prev,
      rows: [...prev.rows, createRow(prev.rows.length)],
    }));
  };

  const handleMoveRow = (id: string, delta: -1 | 1) => {
    setInstructionOverride(null);
    commitSnapshot((prev) => {
      const i = prev.rows.findIndex((r) => r.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.rows.length) return prev;
      const nextRows = [...prev.rows];
      [nextRows[i], nextRows[j]] = [nextRows[j], nextRows[i]];
      return { ...prev, rows: nextRows };
    });
  };

  const handleDeleteRow = (id: string) => {
    if (selectingRowId === id) {
      setSelectingRowId(null);
      setSelectedPoints([]);
    }
    setInstructionOverride(null);
    commitSnapshot((prev) => {
      // Pin visible coordinates of surviving points before removing row
      const visibleMap = new Map(committedCanh?.diem_phu.map((d) => [d.ma, d]) ?? []);
      const nextPoints = prev.points
        .map((p) => {
          const vis = visibleMap.get(p.id);
          const rows = p.rows.filter((rid) => rid !== id);
          if (rows.length === 0) return null;
          return {
            ...p,
            x: vis ? vis.x.toString() : p.x,
            y: vis ? vis.y.toString() : p.y,
            rows,
          };
        })
        .filter((p): p is MarkedPointState => p !== null);

      return {
        ...prev,
        rows: prev.rows.filter((r) => r.id !== id),
        points: nextPoints,
      };
    });
  };

  // View mutations
  const updateView = (patch: Partial<ViewSettings>) => {
    setInstructionOverride(null);
    commitSnapshot((prev) => ({
      ...prev,
      view: { ...prev.view, ...patch },
    }));
  };

  const handleToggleAutoStep = (autoStep: boolean) => {
    commitSnapshot((prev) => {
      let bx = prev.view.bx;
      let by = prev.view.by;
      if (!autoStep && committedCanh && (!bx.trim() || !by.trim())) {
        bx = committedCanh.buoc_x.toFixedPlain();
        by = committedCanh.buoc_y.toFixedPlain();
      }
      return {
        ...prev,
        view: { ...prev.view, autoStep, bx, by },
      };
    });
  };

  const handleAutoFrame = () => {
    const [xmin, xmax, ymin, ymax] = tu_dong_khung(rowsToHam(snapshot.rows));
    const fmt = (v: number) => Number(v.toPrecision(12)).toString();
    commitSnapshot((prev) => ({
      ...prev,
      view: {
        ...prev.view,
        xmin: fmt(xmin),
        xmax: fmt(xmax),
        ymin: fmt(ymin),
        ymax: fmt(ymax),
        bx: '',
        by: '',
        autoStep: true,
      },
    }));
  };

  const handleResetDefault = () => {
    setSelectingRowId(null);
    setSelectedPoints([]);
    setInstructionOverride(null);
    setUndoStack([]);
    setRedoStack([]);
    setSnapshot(createBlankSnapshot());
  };

  const handleLoadExample = () => {
    setSelectingRowId(null);
    setSelectedPoints([]);
    setInstructionOverride({ text: 'Đã nạp hệ bất phương trình mẫu.', isError: false });
    commitSnapshot(() => createSeedSnapshot());
  };

  // 3-point capture handlers
  const handleToggleSelectRow = (id: string) => {
    if (selectingRowId === id) {
      setSelectingRowId(null);
      setSelectedPoints([]);
      setInstructionOverride(null);
      return;
    }
    if (!committedCanh) {
      setInstructionOverride({
        text: 'Cần khung nhìn hợp lệ trước khi chọn điểm trên hình.',
        isError: true,
      });
      return;
    }
    setSelectingRowId(id);
    setSelectedPoints([]);
    setInstructionOverride(null);
    setActiveTab('preview');
  };

  const handleSelectPoint = (u: number, v: number, giao: GiaoDiem | null) => {
    if (!selectingRowId || !committedCanh) return;
    const snapDiv = SNAP_DIVISIONS[snapshot.view.snapMode] ?? 1;
    const p: [Fraction, Fraction] = giao
      ? [giao.x, giao.y]
      : diem_tu_luoi(u, v, committedCanh.buoc_x, committedCanh.buoc_y, snapDiv);

    if (selectedPoints.length === 1 && p[0].eq(selectedPoints[0][0]) && p[1].eq(selectedPoints[0][1])) {
      setInstructionOverride({
        text: 'Điểm thứ hai trùng điểm thứ nhất, hãy chọn điểm khác.',
        isError: true,
      });
      return;
    }

    const nextPts = [...selectedPoints, p];
    if (nextPts.length < 3) {
      setSelectedPoints(nextPts);
      setInstructionOverride(null);
      return;
    }

    try {
      const expr = bpt_tu_3_diem(nextPts[0], nextPts[1], nextPts[2]);
      const rowIdx = snapshot.rows.findIndex((r) => r.id === selectingRowId);
      const targetId = selectingRowId;
      setSelectingRowId(null);
      setSelectedPoints([]);
      commitSnapshot((prev) => ({
        ...prev,
        rows: prev.rows.map((r) => (r.id === targetId ? { ...r, text: expr } : r)),
      }));
      setInstructionOverride({
        text: `Đã nhập Hàm ${rowIdx + 1}: ${expr}`,
        isError: false,
      });
    } catch (e) {
      setInstructionOverride({
        text: e instanceof LoiBPT ? e.message : 'Không thể tạo bất phương trình từ 3 điểm này.',
        isError: true,
      });
    }
  };

  const handleUndoSelectPoint = () => {
    if (selectedPoints.length > 0) {
      setSelectedPoints((prev) => prev.slice(0, -1));
      setInstructionOverride(null);
    } else {
      setSelectingRowId(null);
      setInstructionOverride(null);
    }
  };

  // Marked points (Add / Delete mode)
  const handleAddMarkedPoint = (hamIndices: number[], x: Fraction, y: Fraction) => {
    const valid = hamIndices.filter((i) => i >= 0 && i < snapshot.rows.length);
    if (valid.length === 0) return;

    for (const i of valid) {
      const uid = snapshot.rows[i].id;
      const count = snapshot.points.filter((p) => p.rows.includes(uid)).length;
      if (count >= SO_DIEM_TOI_DA) {
        setInstructionOverride({
          text: `Hàm ${i + 1} đã có đủ ${SO_DIEM_TOI_DA} điểm. Hãy xóa bớt một điểm trên đường đó trước khi thêm.`,
          isError: true,
        });
        return;
      }
    }

    if (committedCanh?.diem_phu.some((d) => d.x.eq(x) && d.y.eq(y))) {
      return;
    }

    const ten = ten_diem_ranh(snapshot.points.map((p) => p.ten));
    const rowIds = valid.map((i) => snapshot.rows[i].id);
    commitSnapshot((prev) => ({
      ...prev,
      points: [
        ...prev.points,
        { id: makeId(), ten, x: x.toString(), y: y.toString(), rows: rowIds },
      ],
    }));
    setInstructionOverride({ text: `Đã thêm điểm ${ten}.`, isError: false });
  };

  const handleDeleteMarkedPoint = (ma: string) => {
    setInstructionOverride(null);
    commitSnapshot((prev) => ({
      ...prev,
      points: prev.points.filter((p) => p.id !== ma),
    }));
  };

  const handleClearAllPoints = () => {
    if (snapshot.points.length === 0) return;
    setInstructionOverride(null);
    commitSnapshot((prev) => ({ ...prev, points: [] }));
  };

  // Dragging boundary lines / intersections (Modes 1 & 2)
  const handleStartDragLines = (ids: number[]) => {
    if (!committedCanh || ids.length === 0) return;
    const coSo: Record<number, Dang> = {};
    for (const i of ids) {
      const row = snapshot.rows[i];
      if (!row) continue;
      try {
        coSo[i] = phan_tich_bpt(row.text);
      } catch {
        continue;
      }
    }
    if (Object.keys(coSo).length === 0) return;

    let diem0: [Fraction, Fraction] | null = null;
    if (snapshot.view.dragMode === 2) {
      const sortedIds = [...ids].sort((a, b) => a - b);
      const match = committedCanh.giao_diem.find(
        (g) =>
          g.ham.length === sortedIds.length &&
          g.ham.every((val, k) => val === sortedIds[k])
      );
      if (match) diem0 = [match.x, match.y];
    }

    dragLinesStateRef.current = {
      ids,
      coSo,
      diem0,
      snapBase: cloneSnapshot(snapshot),
      dx: 0,
      dy: 0,
      moved: false,
    };
    setDragBanner('Đang kéo hình…');
  };

  const handleDragLines = (ids: number[], dx: number, dy: number) => {
    const st = dragLinesStateRef.current;
    if (!st) return;
    if (ids.length !== st.ids.length || !ids.every((v, k) => v === st.ids[k])) return;
    st.dx = dx;
    st.dy = dy;
    st.moved = true;
    const fx = Fraction.fromNumber(dx);
    const fy = Fraction.fromNumber(dy);
    const overrides: Record<number, Dang> = {};
    for (const [key, [a, b, c]] of Object.entries(st.coSo)) {
      overrides[Number(key)] = [a, b, c.sub(a.mul(fx)).sub(b.mul(fy))];
    }
    const { canh } = computeCanhFromSnapshot(st.snapBase, overrides);
    if (canh) setLiveDragCanh(canh);
  };

  const handleEndDragLines = () => {
    const st = dragLinesStateRef.current;
    dragLinesStateRef.current = null;
    setLiveDragCanh(null);
    setDragBanner(null);
    if (!st || !st.moved || !committedCanh) return;

    const chia = SNAP_DIVISIONS[st.snapBase.view.snapMode] ?? 1;
    const bx = committedCanh.buoc_x.toFraction();
    const by = committedCanh.buoc_y.toFraction();
    const fx = Fraction.fromNumber(st.dx);
    const fy = Fraction.fromNumber(st.dy);

    const newCs: Record<number, Fraction> = {};
    if (st.diem0) {
      const X = lam_tron_luoi(st.diem0[0].add(fx), bx, chia);
      const Y = lam_tron_luoi(st.diem0[1].add(fy), by, chia);
      for (const [key, [a, b, c]] of Object.entries(st.coSo)) {
        const i = Number(key);
        newCs[i] = c.sub(a.mul(X.sub(st.diem0[0]))).sub(b.mul(Y.sub(st.diem0[1])));
      }
    } else {
      const qx = bx.div(new Fraction(chia));
      const qy = by.div(new Fraction(chia));
      for (const [key, [a, b, c]] of Object.entries(st.coSo)) {
        const i = Number(key);
        let cNew = c.sub(a.mul(fx)).sub(b.mul(fy));
        const q = ucln_phan_so(a.mul(qx), b.mul(qy));
        if (!q.isZero()) {
          const steps = cNew.div(q).roundInt();
          cNew = new Fraction(steps).mul(q);
        }
        newCs[i] = cNew;
      }
    }

    let changed = false;
    const nextRows = st.snapBase.rows.map((r, i) => {
      if (!(i in newCs)) return r;
      const [a, b, c] = st.coSo[i];
      if (newCs[i].eq(c)) return r;
      changed = true;
      return { ...r, text: bpt_tu_he_so(a, b, newCs[i]) };
    });

    if (changed) {
      commitSnapshot((prev) => ({ ...prev, rows: nextRows }));
    }
  };

  // Dragging marked points (Mode 4)
  const handleStartDragMarkedPoint = (ma: string) => {
    if (!committedCanh) return;
    const d = committedCanh.diem_phu.find((pt) => pt.ma === ma);
    if (!d) return;
    const heHam = new Map<number, Dang>();
    for (const h of committedCanh.ham) {
      if (h.he) heHam.set(h.chi_so, h.he);
    }
    const dong: Record<number, KeoDiemDongInfo> = {};
    for (const i of d.ham) {
      const he = heHam.get(i);
      if (!he) continue;
      const other = committedCanh.diem_phu.find((o) => o.ma !== ma && o.ham.includes(i));
      dong[i] = {
        q: other ? [other.x, other.y] : null,
        ori: [he[0], he[1]],
      };
    }
    if (Object.keys(dong).length === 0) return;

    // Pin visible positions of other points so lines rotate cleanly around them
    const visibleMap = new Map(committedCanh.diem_phu.map((pt) => [pt.ma, pt]));
    const pinnedSnap = cloneSnapshot(snapshot);
    pinnedSnap.points = pinnedSnap.points.map((p) => {
      const vis = visibleMap.get(p.id);
      return vis ? { ...p, x: vis.x.toString(), y: vis.y.toString() } : p;
    });

    dragPointStateRef.current = {
      ma,
      dong,
      snapBase: pinnedSnap,
      moi: null,
      moved: false,
    };
    setDragBanner('Đang kéo điểm…');
  };

  const handleDragMarkedPoint = (ma: string, xf: number, yf: number) => {
    const st = dragPointStateRef.current;
    if (!st || st.ma !== ma) return;
    let P: [Fraction, Fraction];
    try {
      P = [Fraction.fromNumber(xf), Fraction.fromNumber(yf)];
    } catch {
      return;
    }
    const ra = duong_theo_diem(st.dong, P);
    if (!ra) return;
    st.moved = true;
    st.moi = P;
    for (const [key, [a, b]] of Object.entries(ra)) {
      st.dong[Number(key)].ori = [a, b];
    }
    const { canh } = computeCanhFromSnapshot(st.snapBase, ra, { [ma]: P });
    if (canh) setLiveDragCanh(canh);
  };

  const handleEndDragMarkedPoint = () => {
    const st = dragPointStateRef.current;
    dragPointStateRef.current = null;
    setLiveDragCanh(null);
    setDragBanner(null);
    if (!st || !st.moved || !st.moi || !committedCanh) return;

    const chia = SNAP_DIVISIONS[st.snapBase.view.snapMode] ?? 1;
    const bx = committedCanh.buoc_x.toFraction();
    const by = committedCanh.buoc_y.toFraction();
    const P: [Fraction, Fraction] = [
      lam_tron_luoi(st.moi[0], bx, chia),
      lam_tron_luoi(st.moi[1], by, chia),
    ];
    const ra = duong_theo_diem(st.dong, P);
    if (!ra) {
      setInstructionOverride({
        text: 'Hai điểm của cùng một đường không được trùng nhau.',
        isError: true,
      });
      return;
    }

    const nextPoints = st.snapBase.points.map((p) =>
      p.id === st.ma ? { ...p, x: P[0].toString(), y: P[1].toString() } : p
    );
    const nextRows = st.snapBase.rows.map((r, i) => {
      if (!(i in ra)) return r;
      const [a, b, c] = chuan_so_nguyen(...ra[i]);
      return { ...r, text: bpt_tu_he_so(a, b, c) };
    });

    commitSnapshot(() => ({
      ...st.snapBase,
      rows: nextRows,
      points: nextPoints,
    }));
  };

  const snapDivisions = SNAP_DIVISIONS[snapshot.view.snapMode] ?? 1;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 lg:h-screen lg:overflow-hidden">
      {/* Hidden file input for Mở dự án */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleOpenProjectFile}
      />

      {/* Top Navigation Bar (Clean 3-Zone Contract) */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-5 py-2.5">
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Hệ bất phương trình bậc nhất
        </span>

        <nav
          aria-label="Chuyển vùng làm việc"
          className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex"
        >
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`cursor-pointer border-b-2 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'preview'
                ? 'border-sky-600 text-slate-950'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Hình xem trước
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tikz')}
            className={`cursor-pointer border-b-2 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'tikz'
                ? 'border-sky-600 text-slate-950'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Mã TikZ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`cursor-pointer border-b-2 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'border-sky-600 text-slate-950'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Hướng dẫn
          </button>
          <button
            type="button"
            onClick={handleLoadExample}
            className="cursor-pointer border-b-2 border-transparent py-0.5 text-slate-600 transition-colors hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            Mẫu ví dụ
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void copyTikzToClipboard(true)}
            title="Tính lại, sao chép mã TikZ và mở tab Mã TikZ (Ctrl+Enter)"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>Thực hiện</span>
          </button>
        </div>
      </header>

      {/* Main 2-Zone Scientific Sandbox */}
      <main className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[480px_1fr] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[510px_1fr]">
        {/* Left Control & Inequality Deck */}
        <section
          aria-label="Thiết lập hệ bất phương trình"
          className="flex min-h-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:h-full"
        >
          {/* Viewport & Axis Scale */}
          <fieldset className="shrink-0 rounded-lg border border-slate-200 p-2.5">
            <legend className="px-1.5 text-xs font-semibold text-slate-700">
              Khung nhìn và tỉ lệ trục
            </legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                <span>X min</span>
                <input
                  type="text"
                  aria-label="X min"
                  value={snapshot.view.xmin}
                  onChange={(e) => updateView({ xmin: e.target.value })}
                  title="Chấp nhận số rất lớn / rất nhỏ, ví dụ 200000 hoặc 1e-3"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 tabular-nums outline-none focus-visible:border-sky-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                <span>X max</span>
                <input
                  type="text"
                  aria-label="X max"
                  value={snapshot.view.xmax}
                  onChange={(e) => updateView({ xmax: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 tabular-nums outline-none focus-visible:border-sky-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                <span>Y min</span>
                <input
                  type="text"
                  aria-label="Y min"
                  value={snapshot.view.ymin}
                  onChange={(e) => updateView({ ymin: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 tabular-nums outline-none focus-visible:border-sky-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                <span>Y max</span>
                <input
                  type="text"
                  aria-label="Y max"
                  value={snapshot.view.ymax}
                  onChange={(e) => updateView({ ymax: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 tabular-nums outline-none focus-visible:border-sky-500"
                />
              </label>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={snapshot.view.autoStep}
                  onChange={(e) => handleToggleAutoStep(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Tự chia vạch trên hai trục</span>
              </label>

              <button
                type="button"
                onClick={handleAutoFrame}
                className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
              >
                Tự chọn khung nhìn theo các hàm
              </button>
            </div>

            {!snapshot.view.autoStep && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="shrink-0">Bước X:</span>
                  <input
                    type="text"
                    aria-label="Bước X"
                    value={snapshot.view.bx}
                    onChange={(e) => updateView({ bx: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 tabular-nums outline-none focus-visible:border-sky-500"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="shrink-0">Bước Y:</span>
                  <input
                    type="text"
                    aria-label="Bước Y"
                    value={snapshot.view.by}
                    onChange={(e) => updateView({ by: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 tabular-nums outline-none focus-visible:border-sky-500"
                  />
                </label>
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2 text-xs text-slate-700">
              <label className="flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={snapshot.view.showAxisNumbers}
                  onChange={(e) => updateView({ showAxisNumbers: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Hiện số trên trục</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={snapshot.view.showAxisTicks}
                  onChange={(e) => updateView({ showAxisTicks: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Hiện gạch trên trục</span>
              </label>
            </div>
          </fieldset>

          {/* Inequalities list */}
          <div className="flex min-h-[140px] flex-1 flex-col gap-1.5 lg:min-h-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-700">
                Các bất phương trình ({snapshot.rows.length})
              </h2>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Thêm hàm</span>
              </button>
            </div>

            <div
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
              data-testid="inequality-list"
            >
              {snapshot.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
                  <p>Chưa có bất phương trình nào.</p>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="mt-2 font-semibold text-sky-700 hover:underline"
                  >
                    ＋ Thêm hàm mới
                  </button>
                </div>
              ) : (
                snapshot.rows.map((row, index) => (
                  <InequalityRow
                    key={row.id}
                    index={index}
                    total={snapshot.rows.length}
                    row={row}
                    error={committedCanh?.loi[index]}
                    isSelecting={selectingRowId === row.id}
                    onChange={handleRowChange}
                    onMove={handleMoveRow}
                    onDelete={handleDeleteRow}
                    onToggleSelect={handleToggleSelectRow}
                  />
                ))
              )}
            </div>
          </div>

          {/* Output toggles */}
          <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-700">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={snapshot.view.showPointNames}
                onChange={(e) => updateView({ showPointNames: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Ghi tên các điểm đã đánh dấu (A, B, C…)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={snapshot.view.comments}
                onChange={(e) => updateView({ comments: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Ghi chú trong mã TikZ (một dòng chú thích cho từng hàm)</span>
            </label>
          </div>

          {/* Command Buttons Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => void copyTikzToClipboard(false)}
              title="Sao chép mã TikZ đang hiển thị vào clipboard (Ctrl+Shift+C)"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Đã chép ✓</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Sao chép TikZ</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title="Hoàn tác thao tác gần nhất (Ctrl+Z)"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title="Làm lại thao tác vừa hoàn tác (Ctrl+Y)"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <Redo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Làm lại</span>
            </button>

            <button
              type="button"
              onClick={() => canvasRef.current?.exportPng()}
              disabled={!displayedCanh}
              title="Tải xuống ảnh PNG của hình xem trước"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <ImageDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Xuất PNG</span>
            </button>

            <button
              type="button"
              onClick={handleSaveProject}
              title="Lưu dự án ra tệp .json (Ctrl+S)"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <Save className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Lưu dự án</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Mở tệp dự án .json đã lưu (Ctrl+O)"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <FolderOpen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Mở dự án</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefault}
              title="Đưa khung nhìn về −5…5 và tạo 3 hàng trống"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Mặc định</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!tikzCode) return;
                const blob = new Blob([tikzCode], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'he-bpt-tikz.tex';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              disabled={!tikzCode}
              title="Tải về tệp mã nguồn .tex"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Tải .tex</span>
            </button>
          </div>
        </section>

        {/* Right Interactive Canvas / TikZ / Guide Stage */}
        <section
          aria-label="Khu vực xem trước và mã TikZ"
          className="flex min-h-0 min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:h-full"
        >
          {/* Row 1: 5 Interactive Mouse Modes */}
          <div
            role="group"
            aria-label="Chế độ tương tác chuột"
            className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 sm:grid-cols-5"
          >
            {INTERACTION_MODES.map((m) => {
              const active = snapshot.view.dragMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  title={m.tip}
                  aria-pressed={active}
                  onClick={() => {
                    setInstructionOverride(null);
                    updateView({ dragMode: m.id });
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Row 2: Snap Mode & Clear Marked Points */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5">
                <span className="font-medium">Bắt điểm:</span>
                <select
                  aria-label="Bắt điểm"
                  value={snapshot.view.snapMode}
                  onChange={(e) => updateView({ snapMode: Number(e.target.value) })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus-visible:border-sky-500"
                >
                  <option value={0}>Vạch chia</option>
                  <option value={1}>Nửa vạch chia</option>
                  <option value={2}>Tự do</option>
                </select>
              </label>

              <label className="flex cursor-pointer items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={snapshot.view.snapIntersections}
                  onChange={(e) => updateView({ snapIntersections: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Bắt giao điểm</span>
              </label>
            </div>

            <button
              type="button"
              disabled={snapshot.points.length === 0}
              onClick={handleClearAllPoints}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Xóa hết điểm ({snapshot.points.length})</span>
            </button>
          </div>

          {/* Contextual Instruction Bar */}
          <div className="flex min-h-[38px] items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <p
              data-testid="instruction-banner"
              className={`leading-relaxed ${
                instructionInfo.tone === 'pink'
                  ? 'font-semibold text-pink-700'
                  : instructionInfo.tone === 'error'
                  ? 'font-medium text-rose-700'
                  : instructionInfo.tone === 'success'
                  ? 'font-medium text-emerald-700'
                  : 'text-slate-600'
              }`}
            >
              {instructionInfo.text}
            </p>
            {selectingRowId && (
              <button
                type="button"
                onClick={() => {
                  setSelectingRowId(null);
                  setSelectedPoints([]);
                  setInstructionOverride(null);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-pink-300 bg-white px-2.5 py-1 text-xs font-medium text-pink-700 hover:bg-pink-50 whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hủy chọn</span>
              </button>
            )}
          </div>

          {/* Mobile Tabs Switcher (desktop uses top nav bar) */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-1.5 md:hidden" role="tablist">
            {(
              [
                ['preview', 'Hình xem trước'],
                ['tikz', 'Mã TikZ'],
                ['guide', 'Hướng dẫn'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tabKey
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active Stage Body */}
          <div className="min-h-[340px] flex-1 overflow-hidden lg:min-h-0">
            {activeTab === 'preview' && (
              <PreviewCanvas
                ref={canvasRef}
                canh={displayedCanh}
                errorMessage={viewError}
                isSelecting={Boolean(selectingRowId)}
                selectedPointsFloat={selectedPoints.map(([x, y]) => [x.toNumber(), y.toNumber()])}
                snapDivisions={snapDivisions}
                snapIntersections={snapshot.view.snapIntersections}
                selectableIntersections={selectableIntersections}
                interactionMode={snapshot.view.dragMode}
                onSelectPoint={handleSelectPoint}
                onUndoSelectPoint={handleUndoSelectPoint}
                onCancelSelect={() => {
                  setSelectingRowId(null);
                  setSelectedPoints([]);
                  setInstructionOverride(null);
                }}
                onStartDragLines={handleStartDragLines}
                onDragLines={handleDragLines}
                onEndDragLines={handleEndDragLines}
                onAddMarkedPoint={handleAddMarkedPoint}
                onDeleteMarkedPoint={handleDeleteMarkedPoint}
                onStartDragMarkedPoint={handleStartDragMarkedPoint}
                onDragMarkedPoint={handleDragMarkedPoint}
                onEndDragMarkedPoint={handleEndDragMarkedPoint}
              />
            )}

            {activeTab === 'tikz' && (
              <TikzCodeTab
                code={tikzCode}
                libraryNotice={libraryNotice}
                copied={copied}
                onCopy={() => void copyTikzToClipboard(false)}
              />
            )}

            {activeTab === 'guide' && <GuideTab />}
          </div>

          {/* Status Bar */}
          <div
            data-testid="status-bar"
            className={`border-t border-slate-100 pt-2 text-xs tabular-nums ${
              statusInfo.isError ? 'font-medium text-rose-700' : 'text-slate-500'
            }`}
          >
            {statusInfo.text}
          </div>
        </section>
      </main>
    </div>
  );
}
