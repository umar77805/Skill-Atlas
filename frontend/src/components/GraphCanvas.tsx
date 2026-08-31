import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { easeCubicInOut } from 'd3-ease';
import { interpolateObject } from 'd3-interpolate';
import type { GraphNode, GraphEdge } from '../types.ts';
import { useIsMobile, useMediaQuery } from '../hooks/useIsMobile.ts';

const WIDTH = 860;
const HEIGHT = 540;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
// Selection zoom-to-fit is capped tighter than manual zoom so a single
// highlighted node doesn't fill the whole viewport.
const SELECTION_MAX_ZOOM = 2.5;
const SELECTION_TWEEN_MS = 600;

const LABEL_STYLE: Record<string, { r: number }> = {
  Skill: { r: 7 },
  Role: { r: 11 },
  Course: { r: 4 },
  Person: { r: 9 },
};

function clamp(v: number | undefined, min: number, max: number): number {
  const val = Number.isFinite(v) ? (v as number) : (min + max) / 2;
  return Math.max(min, Math.min(max, val));
}

type SimNode = GraphNode & SimulationNodeDatum;
type Transform = { x: number; y: number; k: number };
type Point = { x: number; y: number };
type PosMap = Map<string, Point>;
type DragState =
  | { type: 'pan'; startClientX: number; startClientY: number; startX: number; startY: number; moved: boolean }
  | { type: 'node'; id: string; startClientX: number; startClientY: number; moved: boolean };

type FloatSeed = { phaseX: number; phaseY: number; freqX: number; freqY: number; ampX: number; ampY: number };

type TweenState = {
  startTime: number;
  duration: number;
  fromTransform: Transform;
  toTransform: Transform;
  nodeIds: string[];
  fromPositions: PosMap;
  toPositions: PosMap;
};

const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, k: 1 };

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlighted: Set<string>;
  selectedId?: string;
  onNodeClick?: (node: GraphNode) => void;
  visibleLabels: Set<string>;
}

// Runs a short, separate force pass scoped to just the highlighted nodes so
// they spread apart (readable, non-overlapping) when a selection zooms in,
// then rescales the result to fill most of the canvas - the main layout
// below is untouched, this only produces a target position for the tween in
// the selection-change effect to animate toward.
function computeSpreadLayout(
  activeIds: string[],
  homePositions: PosMap,
  nodesById: Map<string, GraphNode>,
  edges: GraphEdge[]
): PosMap {
  const idSet = new Set(activeIds);
  const simNodes: SimNode[] = activeIds.map((id) => {
    const home = homePositions.get(id);
    const node = nodesById.get(id);
    return { ...(node as GraphNode), id, x: home?.x ?? WIDTH / 2, y: home?.y ?? HEIGHT / 2 };
  });
  const simLinks: SimulationLinkDatum<SimNode>[] = edges
    .filter((e) => idSet.has(e.source) && idSet.has(e.target))
    .map((e) => ({ ...e }));

  const sim = forceSimulation(simNodes)
    .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks).id((d) => d.id).distance(90).strength(0.4))
    .force('charge', forceManyBody().strength(-140))
    .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((d) => (LABEL_STYLE[d.label]?.r ?? 7) + (d.label === 'Role' ? 80 : 24))
        .strength(1)
    )
    .stop();

  for (let i = 0; i < 200; i++) sim.tick();

  // The forces above only keep nodes from overlapping - rescale the
  // resulting arrangement so it always fills most of the canvas, regardless
  // of how tightly a small chain naturally converges, per the "spread as
  // wide as the graph" request. X/Y are scaled independently (not
  // aspect-preserving) since a force-settled chain's natural shape rarely
  // matches the canvas's aspect ratio, and filling both axes reads better
  // than a smaller, proportionally-correct cluster.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of simNodes) {
    minX = Math.min(minX, n.x!);
    maxX = Math.max(maxX, n.x!);
    minY = Math.min(minY, n.y!);
    maxY = Math.max(maxY, n.y!);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const targetW = WIDTH - 80;
  const targetH = HEIGHT - 80;
  const scaleX = targetW / spanX;
  const scaleY = targetH / spanY;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const result: PosMap = new Map();
  for (const n of simNodes) {
    const x = WIDTH / 2 + (n.x! - midX) * scaleX;
    const y = HEIGHT / 2 + (n.y! - midY) * scaleY;
    result.set(n.id, { x: clamp(x, 34, WIDTH - 34), y: clamp(y, 34, HEIGHT - 34) });
  }
  return result;
}

// Lays out the graph once with d3-force (ticked synchronously, not animated
// continuously) and renders it as plain SVG. Nodes/edges on the path from the
// currently selected item light up violet - the "map with a lit route" idea,
// kept distinct from the amber used for Role nodes so the two don't blur together.
// Pan (drag background) and zoom (scroll) operate on a wrapping <g> transform;
// individual nodes can also be dragged to peel apart crowded clusters.
//
// On top of that static layout, two animated behaviours are layered in via a
// single requestAnimationFrame loop (see the tickRef/trampoline below):
// idle nodes drift gently (paused on hover/mobile/reduced-motion/selection),
// and selecting a skill tweens the pan/zoom to fit the highlighted nodes
// while spreading them apart so the chain reads clearly.
export default function GraphCanvas({ nodes, edges, highlighted, selectedId, onNodeClick, visibleLabels }: GraphCanvasProps) {
  const [positions, setPositions] = useState<PosMap | null>(null);
  const [displayPositions, setDisplayPositions] = useState<PosMap | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY_TRANSFORM);
  const [panning, setPanning] = useState(false);
  const [hovering, setHovering] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const wheelCleanupRef = useRef<(() => void) | undefined>(undefined);
  const floatSeedsRef = useRef<Map<string, FloatSeed>>(new Map());
  const tweenRef = useRef<TweenState | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const tickRef = useRef<(now: number) => boolean>(() => false);

  const isMobile = useIsMobile();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const filteredNodes = useMemo(
    () => nodes.filter((n) => visibleLabels.has(n.label)),
    [nodes, visibleLabels]
  );
  const idSet = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
    [edges, idSet]
  );
  const nodesById = useMemo(() => new Map(filteredNodes.map((n) => [n.id, n])), [filteredNodes]);
  const highlightKey = useMemo(() => Array.from(highlighted).sort().join(','), [highlighted]);

  useEffect(() => {
    setTransform(IDENTITY_TRANSFORM);
    tweenRef.current = null;
    if (filteredNodes.length === 0) {
      setPositions(new Map());
      setDisplayPositions(new Map());
      floatSeedsRef.current = new Map();
      return;
    }
    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const simLinks: SimulationLinkDatum<SimNode>[] = filteredEdges.map((e) => ({ ...e }));

    const sim = forceSimulation(simNodes)
      .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks).id((d) => d.id).distance(80).strength(0.3))
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => (LABEL_STYLE[d.label]?.r ?? 7) + (d.label === 'Role' ? 68 : 14)))
      .stop();

    for (let i = 0; i < 320; i++) sim.tick();

    const map: PosMap = new Map(
      simNodes.map((n) => [n.id, { x: clamp(n.x, 34, WIDTH - 34), y: clamp(n.y, 34, HEIGHT - 34) }])
    );
    setPositions(map);
    setDisplayPositions(new Map(map));

    const seeds = new Map<string, FloatSeed>();
    for (const n of simNodes) {
      seeds.set(n.id, {
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        freqX: 0.5 + Math.random() * 0.4,
        freqY: 0.5 + Math.random() * 0.4,
        ampX: 5 + Math.random() * 4,
        ampY: 5 + Math.random() * 4,
      });
    }
    floatSeedsRef.current = seeds;
  }, [filteredNodes, filteredEdges]);

  // Stable trampoline: schedules itself only while tickRef.current says there's
  // still work to do, so the loop goes fully idle (no wasted frames) whenever
  // nothing is floating or tweening.
  const trampoline = useCallback((now: number) => {
    const keepGoing = tickRef.current(now);
    rafIdRef.current = keepGoing ? requestAnimationFrame(trampoline) : null;
  }, []);

  // Reassigned every render so the loop always reads this render's latest
  // props/state (highlighted, hovering, mobile, motion preference) without
  // needing to restart the rAF loop itself on every change.
  tickRef.current = (now: number) => {
    let active = false;

    const tw = tweenRef.current;
    if (tw) {
      const t = clamp((now - tw.startTime) / tw.duration, 0, 1);
      const eased = easeCubicInOut(t);
      setTransform(interpolateObject(tw.fromTransform, tw.toTransform)(eased) as Transform);
      if (tw.nodeIds.length > 0) {
        setDisplayPositions((prev) => {
          const next = new Map(prev);
          for (const id of tw.nodeIds) {
            const from = tw.fromPositions.get(id);
            const to = tw.toPositions.get(id);
            if (from && to) next.set(id, interpolateObject(from, to)(eased) as Point);
          }
          return next;
        });
      }
      if (t < 1) {
        active = true;
      } else {
        tweenRef.current = null;
      }
    }

    if (
      !tweenRef.current &&
      highlighted.size === 0 &&
      !hovering &&
      !isMobile &&
      !prefersReducedMotion &&
      positions &&
      positions.size > 0
    ) {
      setDisplayPositions(() => {
        const next: PosMap = new Map();
        positions.forEach((home, id) => {
          const seed = floatSeedsRef.current.get(id);
          if (!seed) {
            next.set(id, home);
            return;
          }
          const dx = Math.sin((now / 1000) * seed.freqX + seed.phaseX) * seed.ampX;
          const dy = Math.sin((now / 1000) * seed.freqY + seed.phaseY) * seed.ampY;
          next.set(id, { x: home.x + dx, y: home.y + dy });
        });
        return next;
      });
      active = true;
    }

    return active;
  };

  // The single place that "wakes up" the animation loop - covers every entry
  // point (hover ending, selection changing, mobile/motion-preference
  // flipping, a fresh layout) without scattering requestAnimationFrame calls
  // through individual handlers.
  useEffect(() => {
    const shouldFloat =
      highlighted.size === 0 && !hovering && !isMobile && !prefersReducedMotion && !!positions && positions.size > 0;
    const shouldTween = tweenRef.current !== null;
    if ((shouldFloat || shouldTween) && rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(trampoline);
    }
  }, [highlightKey, hovering, isMobile, prefersReducedMotion, positions, trampoline]);

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    },
    []
  );

  // Arms a zoom-to-fit (+ spread, if selecting more than one node) tween
  // whenever the selection changes. Deliberately keyed on highlightKey only -
  // positions/transform/displayPositions are read as a snapshot "as of the
  // moment selection changed", not tracked as reactive deps, since they're
  // mutated every animation frame by the loop above and would otherwise
  // re-arm the tween continuously.
  useEffect(() => {
    if (!positions) return;
    const activeIds = Array.from(highlighted).filter((id) => positions.has(id));
    const currentDisplay = displayPositions ?? positions;

    if (activeIds.length > 0) {
      const toPositions: PosMap =
        activeIds.length > 1
          ? computeSpreadLayout(activeIds, positions, nodesById, filteredEdges)
          : new Map([[activeIds[0], positions.get(activeIds[0])!]]);

      // Fit the zoom to the post-spread arrangement (not the original home
      // layout) so the camera frames however wide the chain actually ends
      // up spread across the canvas.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const id of activeIds) {
        const p = toPositions.get(id)!;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const PAD = 60;
      const bboxW = Math.max(maxX - minX + PAD * 2, 120);
      const bboxH = Math.max(maxY - minY + PAD * 2, 120);
      const k = clamp(Math.min(WIDTH / bboxW, HEIGHT / bboxH), MIN_ZOOM, SELECTION_MAX_ZOOM);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const toTransform: Transform = { k, x: WIDTH / 2 - k * cx, y: HEIGHT / 2 - k * cy };

      const fromPositions: PosMap = new Map();
      for (const id of activeIds) {
        fromPositions.set(id, currentDisplay.get(id) ?? positions.get(id)!);
      }

      tweenRef.current = {
        startTime: performance.now(),
        duration: SELECTION_TWEEN_MS,
        fromTransform: transform,
        toTransform,
        nodeIds: activeIds,
        fromPositions,
        toPositions,
      };
    } else {
      // Deselecting only zooms back out - the spread nodes stay right where
      // they are (animating them back to their pre-selection layout read as
      // a jarring "reset" next to the zoom-out), so this adopts whatever is
      // currently displayed as the new home layout instead of reverting it.
      setPositions(new Map(currentDisplay));
      tweenRef.current = {
        startTime: performance.now(),
        duration: SELECTION_TWEEN_MS,
        fromTransform: transform,
        toTransform: IDENTITY_TRANSFORM,
        nodeIds: [],
        fromPositions: new Map(),
        toPositions: new Map(),
      };
    }
  }, [highlightKey]);

  // Wheel zoom needs a non-passive native listener - React's synthetic onWheel
  // is attached passively, so preventDefault() there would silently no-op.
  // A callback ref (rather than a mount-effect) is required because the <svg>
  // doesn't exist on first render - it only appears once the force layout
  // finishes computing positions - so an empty-deps effect would run before
  // the node exists and never attach.
  const setSvgRef = useCallback((node: SVGSVGElement | null) => {
    svgRef.current = node;
    if (!node) return;
    const onWheel = (evt: WheelEvent) => {
      evt.preventDefault();
      tweenRef.current = null;
      const rect = node.getBoundingClientRect();
      const sx = ((evt.clientX - rect.left) / rect.width) * WIDTH;
      const sy = ((evt.clientY - rect.top) / rect.height) * HEIGHT;
      const factor = evt.deltaY < 0 ? 1.15 : 1 / 1.15;
      setTransform((t) => {
        const nextK = clamp(t.k * factor, MIN_ZOOM, MAX_ZOOM);
        const worldX = (sx - t.x) / t.k;
        const worldY = (sy - t.y) / t.k;
        return { k: nextK, x: sx - worldX * nextK, y: sy - worldY * nextK };
      });
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    wheelCleanupRef.current = () => node.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => () => wheelCleanupRef.current?.(), []);

  // Wheel-based zoom never fires on touch, so this gives touch users an
  // equivalent - anchored at the viewBox center since a button press has no
  // cursor position to anchor to (unlike the wheel handler above).
  const zoomByFactor = useCallback((factor: number) => {
    tweenRef.current = null;
    const sx = WIDTH / 2;
    const sy = HEIGHT / 2;
    setTransform((t) => {
      const nextK = clamp(t.k * factor, MIN_ZOOM, MAX_ZOOM);
      const worldX = (sx - t.x) / t.k;
      const worldY = (sy - t.y) / t.k;
      return { k: nextK, x: sx - worldX * nextK, y: sy - worldY * nextK };
    });
  }, []);

  const handleBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    tweenRef.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
    dragRef.current = {
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: transform.x,
      startY: transform.y,
      moved: false,
    };
  };

  const handleNodePointerDown = (e: React.PointerEvent<SVGGElement>, id: string) => {
    tweenRef.current = null;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { type: 'node', id, startClientX: e.clientX, startClientY: e.clientY, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dxClient = e.clientX - d.startClientX;
    const dyClient = e.clientY - d.startClientY;
    if (Math.abs(dxClient) > 2 || Math.abs(dyClient) > 2) d.moved = true;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (d.type === 'pan') {
      const dx = dxClient * (WIDTH / rect.width);
      const dy = dyClient * (HEIGHT / rect.height);
      setTransform({ x: d.startX + dx, y: d.startY + dy, k: transform.k });
    } else {
      const sx = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const sy = ((e.clientY - rect.top) / rect.height) * HEIGHT;
      const worldX = (sx - transform.x) / transform.k;
      const worldY = (sy - transform.y) / transform.k;
      const id = d.id;
      const next = { x: clamp(worldX, 10, WIDTH - 10), y: clamp(worldY, 10, HEIGHT - 10) };
      setPositions((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(id, next);
        return nextMap;
      });
      setDisplayPositions((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(id, next);
        return nextMap;
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setPanning(false);
    if (d && d.type === 'node' && !d.moved) {
      const node = filteredNodes.find((n) => n.id === d.id);
      if (node) onNodeClick?.(node);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!positions) return null;

  if (filteredNodes.length === 0) {
    return (
      <div className="state-block">
        <div className="state-title">No nodes to show</div>
        <div>Enable at least one node type below to render the atlas.</div>
      </div>
    );
  }

  return (
    <div
      className="graph-canvas-wrap"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <button
        type="button"
        className="graph-reset-btn"
        onClick={() => {
          tweenRef.current = null;
          setTransform(IDENTITY_TRANSFORM);
        }}
        title="Reset pan/zoom"
      >
        Reset view
      </button>
      <div className="graph-zoom-controls">
        <button
          type="button"
          className="graph-zoom-btn"
          onClick={() => zoomByFactor(1.3)}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="graph-zoom-btn"
          onClick={() => zoomByFactor(1 / 1.3)}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
      </div>
      <svg
        ref={setSvgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={`graph-svg${panning ? ' panning' : ''}`}
        role="img"
        aria-label="Skill graph visualization"
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          <g>
            {filteredEdges.map((e) => {
              const s = displayPositions?.get(e.source) ?? positions.get(e.source);
              const t = displayPositions?.get(e.target) ?? positions.get(e.target);
              if (!s || !t) return null;
              const lit = highlighted.has(e.source) && highlighted.has(e.target);
              const dimmed = highlighted.size > 0 && !lit;
              return (
                <line
                  key={e.id}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  className={`graph-edge${lit ? ' lit' : ''}${dimmed ? ' dimmed' : ''}`}
                />
              );
            })}
          </g>
          <g>
            {filteredNodes.map((n) => {
              const pos = displayPositions?.get(n.id) ?? positions.get(n.id);
              if (!pos) return null;
              const style = LABEL_STYLE[n.label] || LABEL_STYLE.Skill;
              const isHi = highlighted.has(n.id);
              const isSelected = selectedId === n.id;
              const dimmed = highlighted.size > 0 && !isHi;
              const displayName = n.name || n.title || '';
              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className={`graph-node label-${n.label}${isHi ? ' lit' : ''}${isSelected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
                  onPointerDown={(e) => handleNodePointerDown(e, n.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={displayName}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick?.(n)}
                >
                  <circle className="graph-node-hit" r={22} />
                  <circle r={isSelected ? style.r + 3 : style.r} />
                  <text x={style.r + 6} y={4} className="graph-label">{displayName}</text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
