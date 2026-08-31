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
import type { GraphNode, GraphEdge } from '../types.ts';

const WIDTH = 860;
const HEIGHT = 540;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

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
type DragState =
  | { type: 'pan'; startClientX: number; startClientY: number; startX: number; startY: number; moved: boolean }
  | { type: 'node'; id: string; startClientX: number; startClientY: number; moved: boolean };

const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, k: 1 };

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlighted: Set<string>;
  selectedId?: string;
  onNodeClick?: (node: GraphNode) => void;
  visibleLabels: Set<string>;
}

// Lays out the graph once with d3-force (ticked synchronously, not animated
// continuously) and renders it as plain SVG. Nodes/edges on the path from the
// currently selected item light up violet - the "map with a lit route" idea,
// kept distinct from the amber used for Role nodes so the two don't blur together.
// Pan (drag background) and zoom (scroll) operate on a wrapping <g> transform;
// individual nodes can also be dragged to peel apart crowded clusters.
export default function GraphCanvas({ nodes, edges, highlighted, selectedId, onNodeClick, visibleLabels }: GraphCanvasProps) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY_TRANSFORM);
  const [panning, setPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const wheelCleanupRef = useRef<(() => void) | undefined>(undefined);

  const filteredNodes = useMemo(
    () => nodes.filter((n) => visibleLabels.has(n.label)),
    [nodes, visibleLabels]
  );
  const idSet = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
    [edges, idSet]
  );

  useEffect(() => {
    setTransform(IDENTITY_TRANSFORM);
    if (filteredNodes.length === 0) {
      setPositions(new Map());
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

    const map = new Map(
      simNodes.map((n) => [n.id, { x: clamp(n.x, 34, WIDTH - 34), y: clamp(n.y, 34, HEIGHT - 34) }])
    );
    setPositions(map);
  }, [filteredNodes, filteredEdges]);

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
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(id, { x: clamp(worldX, 10, WIDTH - 10), y: clamp(worldY, 10, HEIGHT - 10) });
        return next;
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
    <div className="graph-canvas-wrap">
      <button
        type="button"
        className="graph-reset-btn"
        onClick={() => setTransform(IDENTITY_TRANSFORM)}
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
              const s = positions.get(e.source);
              const t = positions.get(e.target);
              if (!s || !t) return null;
              const lit = highlighted.has(e.source) && highlighted.has(e.target);
              return (
                <line
                  key={e.id}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  className={lit ? 'graph-edge lit' : 'graph-edge'}
                />
              );
            })}
          </g>
          <g>
            {filteredNodes.map((n) => {
              const pos = positions.get(n.id);
              if (!pos) return null;
              const style = LABEL_STYLE[n.label] || LABEL_STYLE.Skill;
              const isHi = highlighted.has(n.id);
              const isSelected = selectedId === n.id;
              const displayName = n.name || n.title || '';
              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className={`graph-node label-${n.label}${isHi ? ' lit' : ''}${isSelected ? ' selected' : ''}`}
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
