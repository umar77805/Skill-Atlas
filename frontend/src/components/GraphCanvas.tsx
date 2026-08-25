import { useEffect, useMemo, useState } from 'react';
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
// currently selected item light up amber - the "map with a lit route" idea.
export default function GraphCanvas({ nodes, edges, highlighted, selectedId, onNodeClick, visibleLabels }: GraphCanvasProps) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);

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
    if (filteredNodes.length === 0) {
      setPositions(new Map());
      return;
    }
    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const simLinks: SimulationLinkDatum<SimNode>[] = filteredEdges.map((e) => ({ ...e }));

    const sim = forceSimulation(simNodes)
      .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks).id((d) => d.id).distance(58).strength(0.4))
      .force('charge', forceManyBody().strength(-150))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide().radius(22))
      .stop();

    for (let i = 0; i < 280; i++) sim.tick();

    const map = new Map(
      simNodes.map((n) => [n.id, { x: clamp(n.x, 34, WIDTH - 34), y: clamp(n.y, 34, HEIGHT - 34) }])
    );
    setPositions(map);
  }, [filteredNodes, filteredEdges]);

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
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="graph-svg" role="img" aria-label="Skill graph visualization">
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
          const showLabel = isHi || isSelected || n.label === 'Role';
          const displayName = n.name || n.title || '';
          return (
            <g
              key={n.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className={`graph-node label-${n.label}${isHi ? ' lit' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => onNodeClick?.(n)}
              tabIndex={0}
              role="button"
              aria-label={displayName}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick?.(n)}
            >
              <circle r={isSelected ? style.r + 3 : style.r} />
              {showLabel && (
                <text x={style.r + 6} y={4} className="graph-label">{displayName}</text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
