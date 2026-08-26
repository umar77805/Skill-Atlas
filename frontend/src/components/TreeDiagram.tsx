import { useMemo, useState } from 'react';
import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import type { HierarchyPointNode } from 'd3-hierarchy';

export interface TreeNodeData {
  name: string;
  category: string;
  children: TreeNodeData[];
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 64;
const NODE_DX = 190; // horizontal gap between sibling node centers
const NODE_DY = 126; // vertical gap between depth levels
const CANVAS_MARGIN = 40;

interface IdNode {
  id: string; // full ancestry path, e.g. "Deep Learning>Machine Learning Basics>Python"
  name: string;
  category: string;
  hasChildren: boolean; // computed pre-collapse, so a collapsed node still renders as expandable
  children: IdNode[];
}

// Fed into d3.hierarchy(): children is `undefined` (not []) for a collapsed
// node so d3's default accessor (d => d.children) treats it as a leaf.
interface VisibleNode {
  id: string;
  name: string;
  category: string;
  hasChildren: boolean;
  children?: VisibleNode[];
}

interface Layout {
  nodes: HierarchyPointNode<VisibleNode>[];
  links: { source: HierarchyPointNode<VisibleNode>; target: HierarchyPointNode<VisibleNode> }[];
  width: number;
  height: number;
}

function addIds(node: TreeNodeData, parentId: string | null): IdNode {
  const id = parentId ? `${parentId}>${node.name}` : node.name;
  return {
    id,
    name: node.name,
    category: node.category,
    hasChildren: node.children.length > 0,
    children: node.children.map((c) => addIds(c, id)),
  };
}

function TreeNodeBox({
  node, x, y, isRoot, collapsed, onToggle,
}: {
  node: VisibleNode; x: number; y: number; isRoot: boolean;
  collapsed: boolean; onToggle: () => void;
}) {
  const clickable = node.hasChildren;
  return (
    <div
      className={`tree-box${isRoot ? ' root' : ''}${clickable ? ' clickable' : ''}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-expanded={clickable ? !collapsed : undefined}
      onClick={clickable ? onToggle : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
    >
      <div className="name">{node.name}</div>
      <div className="category">{node.category}</div>
      {clickable && (
        <span className={`tree-toggle-indicator${collapsed ? ' collapsed' : ''}`}>
          {collapsed ? '+' : '−'}
        </span>
      )}
    </div>
  );
}

// Self-contained, reusable tree visualization: pass any nested {name, category,
// children} structure and it lays itself out (d3-hierarchy) and renders as
// clickable, collapsible boxes connected by elbow SVG paths, root on top.
// Collapse state lives inside this component, keyed by each node's ancestry
// path — so the same name can appear in multiple branches (a shared
// prerequisite, say) and each occurrence collapses independently. Pass a
// `key` at the call site that changes whenever the tree's identity changes
// (e.g. `key={selectedSkill}`) so switching trees remounts with everything
// expanded, rather than carrying over stale collapse state.
export default function TreeDiagram({ root }: { root: TreeNodeData | null }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const idTree = useMemo(() => (root ? addIds(root, null) : null), [root]);

  const visibleTree = useMemo<VisibleNode | null>(() => {
    if (!idTree) return null;
    const toVisible = (node: IdNode): VisibleNode => ({
      id: node.id,
      name: node.name,
      category: node.category,
      hasChildren: node.hasChildren,
      children: collapsedIds.has(node.id) ? undefined : node.children.map(toVisible),
    });
    return toVisible(idTree);
  }, [idTree, collapsedIds]);

  const layout = useMemo<Layout | null>(() => {
    if (!visibleTree) return null;

    const laidOut = d3tree<VisibleNode>().nodeSize([NODE_DX, NODE_DY])(hierarchy(visibleTree));
    const nodes = laidOut.descendants();
    const links = laidOut.links();

    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }

    const shiftX = CANVAS_MARGIN - minX + NODE_WIDTH / 2;
    const shiftY = CANVAS_MARGIN + NODE_HEIGHT / 2;
    for (const n of nodes) {
      n.x += shiftX;
      n.y += shiftY;
    }

    return {
      nodes,
      links,
      width: (maxX - minX) + NODE_WIDTH + 2 * CANVAS_MARGIN,
      height: maxY + NODE_HEIGHT + 2 * CANVAS_MARGIN,
    };
  }, [visibleTree]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!layout) return null;

  return (
    <div className="tree-scroll">
      <div className="tree-canvas" style={{ width: layout.width, height: layout.height }}>
        <svg className="tree-links" width={layout.width} height={layout.height}>
          {layout.links.map(({ source, target }) => {
            const sx = source.x, sy = source.y + NODE_HEIGHT / 2;
            const tx = target.x, ty = target.y - NODE_HEIGHT / 2;
            const midY = (sy + ty) / 2;
            return <path key={`${source.data.id}>${target.data.id}`} d={`M ${sx},${sy} V ${midY} H ${tx} V ${ty}`} />;
          })}
        </svg>
        {layout.nodes.map((n) => (
          <TreeNodeBox
            key={n.data.id}
            node={n.data}
            x={n.x - NODE_WIDTH / 2}
            y={n.y - NODE_HEIGHT / 2}
            isRoot={n.depth === 0}
            collapsed={collapsedIds.has(n.data.id)}
            onToggle={() => toggleCollapse(n.data.id)}
          />
        ))}
      </div>
    </div>
  );
}
