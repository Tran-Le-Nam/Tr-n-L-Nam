import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Fraction } from '../math/fraction';
import {
  BAN_KINH_BAT,
  BK_NHAN_PT,
  CM_MOI_PT,
  Canh,
  DiemPhu,
  GiaoDiem,
  HamHinh,
  MAU_RGB,
  SO_DIEM_TOI_DA,
  diem_gan_tren_duong,
} from '../math/inequality';
import { CursorKey, resolveCursorCss } from '../utils/cursors';

export type PointHoverTarget =
  | { kind: 'xoa'; diem: DiemPhu }
  | { kind: 'giao'; giao: GiaoDiem }
  | { kind: 'them'; ham: HamHinh; x: Fraction; y: Fraction }
  | { kind: 'keo'; diem: DiemPhu }
  | null;

export interface PreviewCanvasHandle {
  exportPng: (filename?: string) => void;
}

interface PreviewCanvasProps {
  canh: Canh | null;
  errorMessage: string;
  isSelecting: boolean;
  selectedPointsFloat: Array<[number, number]>;
  snapDivisions: number;
  snapIntersections: boolean;
  selectableIntersections: GiaoDiem[];
  interactionMode: number; // 0: none, 1: drag line, 2: drag intersection, 3: add/delete point, 4: drag point
  onSelectPoint: (u: number, v: number, giao: GiaoDiem | null) => void;
  onUndoSelectPoint: () => void;
  onCancelSelect: () => void;
  onStartDragLines: (ids: number[]) => void;
  onDragLines: (ids: number[], dx: number, dy: number) => void;
  onEndDragLines: () => void;
  onAddMarkedPoint: (hamIndices: number[], x: Fraction, y: Fraction) => void;
  onDeleteMarkedPoint: (ma: string) => void;
  onStartDragMarkedPoint: (ma: string) => void;
  onDragMarkedPoint: (ma: string, x: number, y: number) => void;
  onEndDragMarkedPoint: () => void;
}

function phaTrang(rgb: readonly [number, number, number], ratio: number): string {
  const r = Math.round(255 - ratio * (255 - rgb[0]));
  const g = Math.round(255 - ratio * (255 - rgb[1]));
  const b = Math.round(255 - ratio * (255 - rgb[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

function soNgan(v: number): string {
  const s = Number(v.toPrecision(6)).toString();
  return s === '-0' || s === '0' ? '0' : s;
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const den = dx * dx + dy * dy;
  const t = den === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / den));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function sameTarget(a: PointHoverTarget, b: PointHoverTarget): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'xoa' && b.kind === 'xoa') return a.diem.ma === b.diem.ma;
  if (a.kind === 'keo' && b.kind === 'keo') return a.diem.ma === b.diem.ma;
  if (a.kind === 'giao' && b.kind === 'giao') {
    return a.giao.x.eq(b.giao.x) && a.giao.y.eq(b.giao.y);
  }
  if (a.kind === 'them' && b.kind === 'them') {
    return a.ham.chi_so === b.ham.chi_so && a.x.eq(b.x) && a.y.eq(b.y);
  }
  return false;
}

export const PreviewCanvas = React.forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  (
    {
      canh,
      errorMessage,
      isSelecting,
      selectedPointsFloat,
      snapDivisions,
      snapIntersections,
      selectableIntersections,
      interactionMode,
      onSelectPoint,
      onUndoSelectPoint,
      onCancelSelect,
      onStartDragLines,
      onDragLines,
      onEndDragLines,
      onAddMarkedPoint,
      onDeleteMarkedPoint,
      onStartDragMarkedPoint,
      onDragMarkedPoint,
      onEndDragMarkedPoint,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [size, setSize] = useState<{ w: number; h: number }>({ w: 560, h: 520 });
    const [cursorCss, setCursorCss] = useState<string>('default');

    // Interactive states in refs to keep drag smooth at 60fps
    const hoverSelectRef = useRef<{ u: number; v: number; giao: GiaoDiem | null } | null>(null);
    const hoverTargetRef = useRef<PointHoverTarget>(null);
    const dragLinesRef = useRef<{ ids: number[]; x0: number; y0: number } | null>(null);
    const dragPointRef = useRef<string | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const pendingRafRef = useRef<number | null>(null);
    const pendingLineDeltaRef = useRef<{ ids: number[]; dx: number; dy: number } | null>(null);
    const pendingPointPosRef = useRef<{ ma: string; x: number; y: number } | null>(null);
    const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      exportPng: (filename = 'he-bat-phuong-trinh.png') => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      },
    }));

    // Track container size cleanly
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        const rect = el.getBoundingClientRect();
        const w = Math.max(320, Math.floor(rect.width));
        const h = Math.max(320, Math.floor(rect.height));
        setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Esc cancels 3-point mode
    useEffect(() => {
      if (!isSelecting) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancelSelect();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [isSelecting, onCancelSelect]);

    // Clear hover overlays when mode switches
    useEffect(() => {
      hoverSelectRef.current = null;
      hoverTargetRef.current = null;
      dragLinesRef.current = null;
      dragPointRef.current = null;
      isDraggingRef.current = false;
    }, [interactionMode, isSelecting]);

    const getTransform = useCallback(
      (c: Canh | null) => {
        if (!c) return null;
        const W = size.w;
        const H = size.h;
        const ub0 = c.umin - 1.0;
        const ub1 = c.umax + 1.0;
        const vb0 = c.vmin - 1.0;
        const vb1 = c.vmax + 1.0;
        const k = Math.min(
          Math.max(1.0, W - 20) / (ub1 - ub0),
          Math.max(1.0, H - 20) / (vb1 - vb0),
          90.0
        );
        const ox = (W - k * (ub1 - ub0)) / 2 - k * ub0;
        const oy = (H - k * (vb1 - vb0)) / 2 + k * vb1;
        return { k, ox, oy };
      },
      [size]
    );

    const countPointsOn = useCallback(
      (lineIdx: number): number => {
        if (!canh) return 0;
        return canh.diem_phu.filter((d) => d.ham.includes(lineIdx)).length;
      },
      [canh]
    );

    const snapPoint = useCallback(
      (px: number, py: number): { u: number; v: number; giao: GiaoDiem | null } | null => {
        const ht = getTransform(canh);
        if (!ht || !canh) return null;
        const { k, ox, oy } = ht;
        if (snapIntersections) {
          let best: GiaoDiem | null = null;
          let bestD2 = BAN_KINH_BAT * BAN_KINH_BAT;
          for (const g of selectableIntersections) {
            const dx = ox + k * g.u - px;
            const dy = oy - k * g.v - py;
            const d2 = dx * dx + dy * dy;
            if (d2 <= bestD2) {
              best = g;
              bestD2 = d2;
            }
          }
          if (best) return { u: best.u, v: best.v, giao: best };
        }
        const u = (px - ox) / k;
        const v = (oy - py) / k;
        return {
          u: Math.round(u * snapDivisions) / snapDivisions,
          v: Math.round(v * snapDivisions) / snapDivisions,
          giao: null,
        };
      },
      [canh, getTransform, selectableIntersections, snapDivisions, snapIntersections]
    );

    const toRealCoords = useCallback(
      (px: number, py: number): [number, number] | null => {
        const ht = getTransform(canh);
        if (!ht || !canh) return null;
        const u = (px - ht.ox) / ht.k;
        const v = (ht.oy - py) / ht.k;
        return [u * canh.buoc_x.toNumber(), v * canh.buoc_y.toNumber()];
      },
      [canh, getTransform]
    );

    const findDragTargetIds = useCallback(
      (px: number, py: number): number[] | null => {
        const ht = getTransform(canh);
        if (!ht || !canh) return null;
        const { k, ox, oy } = ht;
        if (interactionMode === 2) {
          let best: GiaoDiem | null = null;
          let dmin = 12.0;
          for (const g of canh.giao_diem) {
            const qx = ox + k * g.u;
            const qy = oy - k * g.v;
            const d = Math.hypot(px - qx, py - qy);
            if (d < dmin) {
              best = g;
              dmin = d;
            }
          }
          return best ? [...best.ham] : null;
        }
        if (interactionMode === 1) {
          let bestId: number | null = null;
          let dmin = 10.0;
          for (const h of canh.ham) {
            if (!h.doan) continue;
            const ax = ox + k * h.doan[0][0];
            const ay = oy - k * h.doan[0][1];
            const bx = ox + k * h.doan[1][0];
            const by = oy - k * h.doan[1][1];
            const d = pointToSegmentDist(px, py, ax, ay, bx, by);
            if (d < dmin) {
              bestId = h.chi_so;
              dmin = d;
            }
          }
          return bestId !== null ? [bestId] : null;
        }
        return null;
      },
      [canh, getTransform, interactionMode]
    );

    const findPointModeTarget = useCallback(
      (px: number, py: number): PointHoverTarget => {
        const ht = getTransform(canh);
        if (!ht || !canh) return null;
        const { k, ox, oy } = ht;

        let bestPt: DiemPhu | null = null;
        let dmin = interactionMode === 4 ? 12.0 : 11.0;
        for (const d of canh.diem_phu) {
          const kc = Math.hypot(px - (ox + k * d.u), py - (oy - k * d.v));
          if (kc < dmin) {
            bestPt = d;
            dmin = kc;
          }
        }
        if (interactionMode === 4) {
          return bestPt ? { kind: 'keo', diem: bestPt } : null;
        }
        if (bestPt) {
          return { kind: 'xoa', diem: bestPt };
        }

        let bestGiao: GiaoDiem | null = null;
        let gMin = BAN_KINH_BAT;
        for (const g of canh.giao_diem) {
          const kc = Math.hypot(px - (ox + k * g.u), py - (oy - k * g.v));
          if (kc <= gMin) {
            bestGiao = g;
            gMin = kc;
          }
        }
        if (bestGiao) {
          return { kind: 'giao', giao: bestGiao };
        }

        let bestHam: HamHinh | null = null;
        let hMin = 8.0;
        for (const h of canh.ham) {
          if (!h.doan || !h.he) continue;
          const ax = ox + k * h.doan[0][0];
          const ay = oy - k * h.doan[0][1];
          const bx = ox + k * h.doan[1][0];
          const by = oy - k * h.doan[1][1];
          const kc = pointToSegmentDist(px, py, ax, ay, bx, by);
          if (kc < hMin) {
            bestHam = h;
            hMin = kc;
          }
        }
        if (!bestHam || !bestHam.he) return null;
        const u = (px - ox) / k;
        const v = (oy - py) / k;
        const proj = diem_gan_tren_duong(
          bestHam.he,
          u,
          v,
          canh.buoc_x,
          canh.buoc_y,
          snapDivisions,
          14.0 / k
        );
        if (!proj) return null;
        return { kind: 'them', ham: bestHam, x: proj[2], y: proj[3] };
      },
      [canh, getTransform, interactionMode, snapDivisions]
    );

    const lineDragCursor = useCallback(
      (chiSo: number): string => {
        if (!canh) return 'move';
        const h = canh.ham.find((x) => x.chi_so === chiSo && x.doan);
        if (!h || !h.doan) return 'move';
        const [[u0, v0], [u1, v1]] = h.doan;
        const n = ((((Math.atan2(v1 - v0, u1 - u0) * 180) / Math.PI + 90) % 180) + 180) % 180;
        if (n < 22.5 || n >= 157.5) return 'ew-resize';
        if (n < 67.5) return 'nesw-resize';
        if (n < 112.5) return 'ns-resize';
        return 'nwse-resize';
      },
      [canh]
    );

    const updateCursor = useCallback(
      (px?: number, py?: number) => {
        if (dragLinesRef.current !== null || dragPointRef.current !== null) return;
        let key: CursorKey = { kind: 'default' };
        if (isSelecting) {
          const step = Math.min(selectedPointsFloat.length, 2) + 1;
          key = {
            kind: 'custom',
            mode: 'chon',
            orangeRing: Boolean(hoverSelectRef.current?.giao),
            stepText: String(step),
          };
        } else if (canh) {
          if ((interactionMode === 1 || interactionMode === 2) && px !== undefined && py !== undefined) {
            const ids = findDragTargetIds(px, py);
            if (ids && ids.length > 0) {
              key = {
                kind: 'std',
                css: interactionMode === 1 ? lineDragCursor(ids[0]) : 'move',
              };
            }
          } else if (interactionMode === 3) {
            const mt = hoverTargetRef.current;
            if (mt) {
              if (mt.kind === 'xoa') {
                key = { kind: 'custom', mode: 'xoa', orangeRing: false, stepText: '' };
              } else if (mt.kind === 'giao' || mt.kind === 'them') {
                const hamList = mt.kind === 'giao' ? mt.giao.ham : [mt.ham.chi_so];
                if (hamList.some((i) => countPointsOn(i) >= SO_DIEM_TOI_DA)) {
                  key = { kind: 'std', css: 'not-allowed' };
                } else {
                  key = {
                    kind: 'custom',
                    mode: 'them',
                    orangeRing: mt.kind === 'giao',
                    stepText: '',
                  };
                }
              }
            }
          } else if (interactionMode === 4 && hoverTargetRef.current?.kind === 'keo') {
            key = { kind: 'std', css: 'grab' };
          }
        }
        setCursorCss(resolveCursorCss(key));
      },
      [
        canh,
        countPointsOn,
        findDragTargetIds,
        interactionMode,
        isSelecting,
        lineDragCursor,
        selectedPointsFloat.length,
      ]
    );

    // Paint canvas whenever state/scene changes
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = size.w;
      const H = size.h;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      if (!canh) {
        if (errorMessage) {
          ctx.fillStyle = '#b00020';
          ctx.font = '500 14px "DM Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(errorMessage, W / 2, H / 2, Math.max(80, W - 40));
        }
        ctx.restore();
        return;
      }

      const ht = getTransform(canh)!;
      const { k, ox, oy } = ht;
      const P = (u: number, v: number): [number, number] => [ox + k * u, oy - k * v];
      const ppt = (k / canh.lu) * CM_MOI_PT;

      const fontSmallPx = Math.max(9, Math.min(22, Math.round(5 * ppt)));
      const fontLargePx = Math.max(12, Math.min(30, Math.round(10 * ppt)));
      const fontPointPx = Math.max(10, Math.min(26, Math.round(7 * ppt)));

      // 1) Hatching & fills (drawn before axes)
      for (const h of canh.ham) {
        if (h.da_giac.length === 0) continue;
        const rgb = MAU_RGB[h.mau] ?? [0, 0, 0];
        const pts = h.da_giac.map(([u, v]) => P(u, v));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let idx = 1; idx < pts.length; idx++) {
          ctx.lineTo(pts[idx][0], pts[idx][1]);
        }
        ctx.closePath();

        if (h.to_mau) {
          const alpha = Math.min(1, Math.max(0, h.do_dam / 100));
          ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
          ctx.fill();
        } else {
          ctx.clip();
          const kc = Math.max(h.kc * ppt, 2.0);
          const th = (h.goc * Math.PI) / 180;
          const dx = Math.cos(th);
          const dy = -Math.sin(th);
          const nx = Math.sin(th);
          const ny = Math.cos(th);
          let minProj = Infinity;
          let maxProj = -Infinity;
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          for (const [qx, qy] of pts) {
            const proj = nx * qx + ny * qy;
            if (proj < minProj) minProj = proj;
            if (proj > maxProj) maxProj = proj;
            if (qx < minX) minX = qx;
            if (qx > maxX) maxX = qx;
            if (qy < minY) minY = qy;
            if (qy > maxY) maxY = qy;
          }
          const k0 = Math.floor(minProj / kc);
          const k1 = Math.ceil(maxProj / kc);
          if (k1 - k0 <= 4000) {
            const dai = maxX - minX + (maxY - minY);
            const tx = (minX + maxX) / 2;
            const ty = (minY + maxY) / 2;
            ctx.strokeStyle = phaTrang(rgb, 0.25);
            ctx.lineWidth = Math.max(1.0, 0.4 * ppt);
            ctx.beginPath();
            for (let i = k0; i <= k1; i++) {
              const s = i * kc;
              const t = (tx - nx * s) * dx + (ty - ny * s) * dy;
              const x0 = nx * s + dx * t;
              const y0 = ny * s + dy * t;
              ctx.moveTo(x0 - dx * dai, y0 - dy * dai);
              ctx.lineTo(x0 + dx * dai, y0 + dy * dai);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 2) Axes & stealth arrowheads
      const axisWidth = Math.max(1.0, 0.4 * ppt);
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = axisWidth;
      const oPt = P(0, 0);
      const xStart = P(canh.umin - 0.5, 0);
      const xEnd = P(canh.umax + 0.5, 0);
      const yStart = P(0, canh.vmin - 0.5);
      const yEnd = P(0, canh.vmax + 0.5);

      ctx.beginPath();
      ctx.moveTo(xStart[0], xStart[1]);
      ctx.lineTo(xEnd[0], xEnd[1]);
      ctx.moveTo(yStart[0], yStart[1]);
      ctx.lineTo(yEnd[0], yEnd[1]);
      ctx.stroke();

      for (const [start, tip] of [
        [xStart, xEnd],
        [yStart, yEnd],
      ]) {
        const dx = tip[0] - start[0];
        const dy = tip[1] - start[1];
        const n = Math.hypot(dx, dy) || 1;
        const ux = dx / n;
        const uy = dy / n;
        const L = 4.5 * ppt;
        const w = 1.7 * ppt;
        const gx = tip[0] - ux * L;
        const gy = tip[1] - uy * L;
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        ctx.lineTo(gx - uy * w, gy + ux * w);
        ctx.lineTo(gx + uy * w, gy - ux * w);
        ctx.closePath();
        ctx.fill();
      }

      // 3) Ticks & axis labels
      ctx.font = `${fontSmallPx}px "DM Sans", sans-serif`;
      ctx.textBaseline = 'middle';
      for (const t of canh.vach_x) {
        const [qx, qy] = P(t.k, 0);
        if (canh.hien_gach) {
          ctx.beginPath();
          ctx.moveTo(qx, qy - 2 * ppt);
          ctx.lineTo(qx, qy + 2 * ppt);
          ctx.stroke();
        }
        if (canh.hien_so && t.co_nhan) {
          ctx.textAlign = 'center';
          ctx.fillText(t.van, qx, qy + 9 * ppt);
        }
      }
      for (const t of canh.vach_y) {
        const [qx, qy] = P(0, t.k);
        if (canh.hien_gach) {
          ctx.beginPath();
          ctx.moveTo(qx - 2 * ppt, qy);
          ctx.lineTo(qx + 2 * ppt, qy);
          ctx.stroke();
        }
        if (canh.hien_so && t.co_nhan) {
          ctx.textAlign = 'right';
          ctx.fillText(t.van, qx - 7 * ppt, qy);
        }
      }
      ctx.textAlign = 'center';
      ctx.fillText('O', oPt[0] - 6.4 * ppt, oPt[1] + 6.4 * ppt);

      ctx.font = `italic ${fontLargePx}px Georgia, "Times New Roman", serif`;
      ctx.fillText('x', xEnd[0] + 0.6 * ppt, xEnd[1] + 7 * ppt);
      ctx.fillText('y', yEnd[0] - 7 * ppt, yEnd[1] - 0.6 * ppt);

      // 4) Boundary lines & sloped labels
      ctx.font = `${fontSmallPx}px "DM Sans", sans-serif`;
      for (const h of canh.ham) {
        if (!h.doan) continue;
        const rgb = MAU_RGB[h.mau] ?? [0, 0, 0];
        const colorStr = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        const [pa, pb] = [P(h.doan[0][0], h.doan[0][1]), P(h.doan[1][0], h.doan[1][1])];
        ctx.strokeStyle = colorStr;
        ctx.lineWidth = Math.max(1.3, 0.45 * ppt);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();

        if (h.nhan && !isDraggingRef.current) {
          const chu = h.nhan_van || h.nhan;
          const mx = pa[0] + h.vi_tri_nhan * (pb[0] - pa[0]);
          const my = pa[1] + h.vi_tri_nhan * (pb[1] - pa[1]);
          const goc = Math.atan2(-(pb[1] - pa[1]), pb[0] - pa[0]);
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(-goc);
          ctx.fillStyle = colorStr;
          ctx.textAlign = 'center';
          ctx.textBaseline = h.nhan_phia_tren ? 'bottom' : 'top';
          ctx.fillText(chu, 0, h.nhan_phia_tren ? -4 : 4);
          ctx.restore();
        }
      }

      // 5) Marked points A, B, C...
      if (canh.diem_phu.length > 0) {
        const rDot = Math.max(2.6, 1.5 * ppt);
        ctx.fillStyle = '#000000';
        for (const d of canh.diem_phu) {
          const [qx, qy] = P(d.u, d.v);
          ctx.beginPath();
          ctx.arc(qx, qy, rDot, 0, Math.PI * 2);
          ctx.fill();
        }
        if (canh.hien_ten_diem) {
          ctx.font = `italic ${fontPointPx}px Georgia, "Times New Roman", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const rLabel = BK_NHAN_PT * ppt;
          for (const d of canh.diem_phu) {
            const [qx, qy] = P(d.u, d.v);
            const a = (d.goc_nhan * Math.PI) / 180;
            const cx = qx + rLabel * Math.cos(a);
            const cy = qy - rLabel * Math.sin(a);
            ctx.fillText(d.ten, cx, cy);
          }
        }
      }

      // 6) Interactive overlays
      const drawBadgeText = (qx: number, qy: number, text: string, color: string) => {
        ctx.font = '700 13px "DM Sans", sans-serif';
        const metrics = ctx.measureText(text);
        const w = metrics.width;
        let tx = qx + 11;
        if (tx + w > W - 4) tx = Math.max(4, qx - 11 - w);
        const ty = qy > 22 ? qy - 11 : qy + 22;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;
        ctx.fillText(text, tx, ty);
      };

      if (isSelecting) {
        const hong = '#d81b60';
        const cam = '#e67800';
        ctx.strokeStyle = hong;
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

        if (snapIntersections) {
          ctx.strokeStyle = cam;
          ctx.lineWidth = 1.6;
          for (const g of selectableIntersections) {
            const [qx, qy] = P(g.u, g.v);
            ctx.beginPath();
            ctx.arc(qx, qy, 6.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const sx = canh.buoc_x.toNumber();
        const sy = canh.buoc_y.toNumber();
        const pts = selectedPointsFloat.map(([x, y]) => [x / sx, y / sy] as [number, number]);
        if (pts.length >= 2) {
          const [ax, ay] = P(pts[0][0], pts[0][1]);
          const [bx, by] = P(pts[1][0], pts[1][1]);
          const dx = bx - ax;
          const dy = by - ay;
          const n = Math.hypot(dx, dy) || 1;
          const dai = 2 * (W + H);
          ctx.save();
          ctx.strokeStyle = hong;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(ax - (dx / n) * dai, ay - (dy / n) * dai);
          ctx.lineTo(ax + (dx / n) * dai, ay + (dy / n) * dai);
          ctx.stroke();
          ctx.restore();
        }

        pts.forEach(([u, v], idx) => {
          const [qx, qy] = P(u, v);
          const [x, y] = selectedPointsFloat[idx];
          ctx.fillStyle = hong;
          ctx.beginPath();
          ctx.arc(qx, qy, 5, 0, Math.PI * 2);
          ctx.fill();
          const labelName = (['A', 'B', 'M'] as const)[idx % 3];
          drawBadgeText(qx, qy, `${labelName}(${soNgan(x)}; ${soNgan(y)})`, hong);
        });

        const ro = hoverSelectRef.current;
        if (ro) {
          const [qx, qy] = P(ro.u, ro.v);
          if (ro.giao) {
            ctx.fillStyle = 'rgba(230, 120, 0, 0.27)';
            ctx.strokeStyle = cam;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(qx, qy, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const ten = ro.giao.ham.map((i) => `Hàm ${i + 1}`).join(' ∩ ');
            drawBadgeText(
              qx,
              qy,
              `${ten}: (${soNgan(ro.giao.x.toNumber())}; ${soNgan(ro.giao.y.toNumber())})`,
              cam
            );
          } else {
            ctx.strokeStyle = hong;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(qx, qy, 7, 0, Math.PI * 2);
            ctx.stroke();
            drawBadgeText(qx, qy, `(${soNgan(ro.u * sx)}; ${soNgan(ro.v * sy)})`, hong);
          }
        }
      } else if (interactionMode === 2) {
        ctx.strokeStyle = 'rgba(230, 120, 0, 0.7)';
        ctx.lineWidth = 1.4;
        for (const g of canh.giao_diem) {
          const [qx, qy] = P(g.u, g.v);
          ctx.beginPath();
          ctx.arc(qx, qy, 6.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (interactionMode === 3) {
        ctx.strokeStyle = 'rgba(216, 27, 96, 0.45)';
        ctx.lineWidth = 1.2;
        for (const d of canh.diem_phu) {
          const [qx, qy] = P(d.u, d.v);
          ctx.beginPath();
          ctx.arc(qx, qy, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        const mt = hoverTargetRef.current;
        if (mt) {
          const hong = '#d81b60';
          const cam = '#e67800';
          const xam = '#6e6e6e';
          if (mt.kind === 'xoa') {
            const [qx, qy] = P(mt.diem.u, mt.diem.v);
            ctx.fillStyle = 'rgba(216, 27, 96, 0.2)';
            ctx.strokeStyle = hong;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(qx, qy, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(qx - 5, qy - 5);
            ctx.lineTo(qx + 5, qy + 5);
            ctx.moveTo(qx - 5, qy + 5);
            ctx.lineTo(qx + 5, qy - 5);
            ctx.stroke();
            drawBadgeText(qx, qy, `Xóa điểm ${mt.diem.ten}`, hong);
          } else if (mt.kind === 'giao' || mt.kind === 'them') {
            const sx = canh.buoc_x.toNumber();
            const sy = canh.buoc_y.toNumber();
            const qx = mt.kind === 'giao' ? P(mt.giao.u, mt.giao.v)[0] : P(mt.x.toNumber() / sx, mt.y.toNumber() / sy)[0];
            const qy = mt.kind === 'giao' ? P(mt.giao.u, mt.giao.v)[1] : P(mt.x.toNumber() / sx, mt.y.toNumber() / sy)[1];
            const hamList = mt.kind === 'giao' ? mt.giao.ham : [mt.ham.chi_so];
            const fx = mt.kind === 'giao' ? mt.giao.x : mt.x;
            const fy = mt.kind === 'giao' ? mt.giao.y : mt.y;
            const tenHam =
              mt.kind === 'giao'
                ? hamList.map((i) => `Hàm ${i + 1}`).join(' ∩ ')
                : `Hàm ${mt.ham.chi_so + 1}`;
            const day = hamList.filter((i) => countPointsOn(i) >= SO_DIEM_TOI_DA);
            if (day.length > 0) {
              ctx.strokeStyle = xam;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(qx, qy, 9, 0, Math.PI * 2);
              ctx.stroke();
              drawBadgeText(qx, qy, `Hàm ${day[0] + 1} đã đủ ${SO_DIEM_TOI_DA} điểm`, xam);
            } else {
              const toaDo = `(${soNgan(fx.toNumber())}; ${soNgan(fy.toNumber())})`;
              if (mt.kind === 'giao') {
                ctx.fillStyle = 'rgba(230, 120, 0, 0.27)';
                ctx.strokeStyle = cam;
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(qx, qy, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.strokeStyle = hong;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.arc(qx, qy, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.arc(qx, qy, 3, 0, Math.PI * 2);
              ctx.fill();
              drawBadgeText(
                qx,
                qy,
                mt.kind === 'giao' ? `${tenHam}: ${toaDo}` : toaDo,
                mt.kind === 'giao' ? cam : hong
              );
            }
          }
        }
      } else if (interactionMode === 4) {
        ctx.strokeStyle = 'rgba(25, 118, 210, 0.55)';
        ctx.lineWidth = 1.2;
        for (const d of canh.diem_phu) {
          const [qx, qy] = P(d.u, d.v);
          ctx.beginPath();
          ctx.arc(qx, qy, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        const activeId =
          dragPointRef.current ??
          (hoverTargetRef.current?.kind === 'keo' ? hoverTargetRef.current.diem.ma : null);
        const active = activeId ? canh.diem_phu.find((d) => d.ma === activeId) : null;
        if (active) {
          const [qx, qy] = P(active.u, active.v);
          ctx.fillStyle = 'rgba(25, 118, 210, 0.2)';
          ctx.strokeStyle = '#1976d2';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(qx, qy, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    }, [
      canh,
      countPointsOn,
      errorMessage,
      getTransform,
      interactionMode,
      isSelecting,
      selectableIntersections,
      selectedPointsFloat,
      size,
      snapIntersections,
    ]);

    useEffect(() => {
      draw();
    }, [draw]);

    // Refresh hover target if scene changes under stationary mouse
    useEffect(() => {
      if (isDraggingRef.current) return;
      const last = lastMousePosRef.current;
      if (last && canh && !isSelecting && (interactionMode === 3 || interactionMode === 4)) {
        hoverTargetRef.current = findPointModeTarget(last.x, last.y);
      } else {
        hoverTargetRef.current = null;
      }
      updateCursor(last?.x, last?.y);
      draw();
    }, [canh, draw, findPointModeTarget, interactionMode, isSelecting, updateCursor]);

    const getLocalPos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
      const rect = e.currentTarget.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const scheduleDragEmit = () => {
      if (pendingRafRef.current !== null) return;
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null;
        if (pendingLineDeltaRef.current && dragLinesRef.current) {
          const { ids, dx, dy } = pendingLineDeltaRef.current;
          pendingLineDeltaRef.current = null;
          onDragLines(ids, dx, dy);
        }
        if (pendingPointPosRef.current && dragPointRef.current) {
          const { ma, x, y } = pendingPointPosRef.current;
          pendingPointPosRef.current = null;
          onDragMarkedPoint(ma, x, y);
        }
      });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [px, py] = getLocalPos(e);
      lastMousePosRef.current = { x: px, y: py };

      if (dragLinesRef.current && canh) {
        const xy = toRealCoords(px, py);
        if (xy) {
          pendingLineDeltaRef.current = {
            ids: dragLinesRef.current.ids,
            dx: xy[0] - dragLinesRef.current.x0,
            dy: xy[1] - dragLinesRef.current.y0,
          };
          scheduleDragEmit();
        }
        return;
      }

      if (dragPointRef.current && canh) {
        const xy = toRealCoords(px, py);
        if (xy) {
          pendingPointPosRef.current = {
            ma: dragPointRef.current,
            x: xy[0],
            y: xy[1],
          };
          scheduleDragEmit();
        }
        return;
      }

      if (isSelecting && canh) {
        hoverSelectRef.current = snapPoint(px, py);
        updateCursor(px, py);
        draw();
        return;
      }

      if ((interactionMode === 1 || interactionMode === 2) && canh) {
        updateCursor(px, py);
        return;
      }

      if ((interactionMode === 3 || interactionMode === 4) && canh) {
        const mt = findPointModeTarget(px, py);
        if (!sameTarget(mt, hoverTargetRef.current)) {
          hoverTargetRef.current = mt;
          draw();
        }
        updateCursor(px, py);
      }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canh) return;
      const [px, py] = getLocalPos(e);
      lastMousePosRef.current = { x: px, y: py };

      if (isSelecting) {
        if (e.button === 0) {
          const kq = snapPoint(px, py);
          if (kq) onSelectPoint(kq.u, kq.v, kq.giao);
        } else if (e.button === 2) {
          onUndoSelectPoint();
        }
        return;
      }

      if (interactionMode === 3) {
        const mt = findPointModeTarget(px, py);
        if (mt) {
          if (mt.kind === 'xoa') {
            onDeleteMarkedPoint(mt.diem.ma);
          } else if (e.button === 0) {
            if (mt.kind === 'giao') {
              onAddMarkedPoint(mt.giao.ham, mt.giao.x, mt.giao.y);
            } else if (mt.kind === 'them') {
              onAddMarkedPoint([mt.ham.chi_so], mt.x, mt.y);
            }
          }
        }
        return;
      }

      if (interactionMode === 4 && e.button === 0) {
        const mt = findPointModeTarget(px, py);
        if (mt && mt.kind === 'keo') {
          dragPointRef.current = mt.diem.ma;
          isDraggingRef.current = true;
          setCursorCss('grabbing');
          onStartDragMarkedPoint(mt.diem.ma);
          draw();
        }
        return;
      }

      if ((interactionMode === 1 || interactionMode === 2) && e.button === 0) {
        const ids = findDragTargetIds(px, py);
        const xy = toRealCoords(px, py);
        if (ids && ids.length > 0 && xy) {
          dragLinesRef.current = { ids, x0: xy[0], y0: xy[1] };
          isDraggingRef.current = true;
          setCursorCss(interactionMode === 1 ? lineDragCursor(ids[0]) : 'move');
          onStartDragLines(ids);
          draw();
        }
      }
    };

    const finishAnyDrag = useCallback(() => {
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      if (dragPointRef.current) {
        if (pendingPointPosRef.current) {
          const { ma, x, y } = pendingPointPosRef.current;
          pendingPointPosRef.current = null;
          onDragMarkedPoint(ma, x, y);
        }
        dragPointRef.current = null;
        isDraggingRef.current = false;
        onEndDragMarkedPoint();
        const last = lastMousePosRef.current;
        if (last) hoverTargetRef.current = findPointModeTarget(last.x, last.y);
        updateCursor(last?.x, last?.y);
        draw();
      } else if (dragLinesRef.current) {
        if (pendingLineDeltaRef.current) {
          const { ids, dx, dy } = pendingLineDeltaRef.current;
          pendingLineDeltaRef.current = null;
          onDragLines(ids, dx, dy);
        }
        dragLinesRef.current = null;
        isDraggingRef.current = false;
        onEndDragLines();
        const last = lastMousePosRef.current;
        updateCursor(last?.x, last?.y);
        draw();
      }
    }, [
      draw,
      findPointModeTarget,
      onDragLines,
      onDragMarkedPoint,
      onEndDragLines,
      onEndDragMarkedPoint,
      updateCursor,
    ]);

    useEffect(() => {
      window.addEventListener('mouseup', finishAnyDrag);
      return () => window.removeEventListener('mouseup', finishAnyDrag);
    }, [finishAnyDrag]);

    const handleMouseLeave = () => {
      lastMousePosRef.current = null;
      hoverSelectRef.current = null;
      hoverTargetRef.current = null;
      if (!isDraggingRef.current) {
        updateCursor();
        draw();
      }
    };

    return (
      <div
        ref={containerRef}
        className="relative h-full min-h-[340px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white lg:min-h-0"
      >
        <canvas
          ref={canvasRef}
          data-testid="preview-canvas"
          data-mode={interactionMode}
          data-selecting={isSelecting ? 'true' : 'false'}
          data-has-scene={canh ? 'true' : 'false'}
          data-line-count={canh ? canh.ham.length : 0}
          data-point-count={canh ? canh.diem_phu.length : 0}
          style={{ width: size.w, height: size.h, cursor: cursorCss }}
          className="block touch-none select-none"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={finishAnyDrag}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => {
            if (isSelecting || interactionMode === 3) {
              e.preventDefault();
            }
          }}
        />
      </div>
    );
  }
);

PreviewCanvas.displayName = 'PreviewCanvas';
