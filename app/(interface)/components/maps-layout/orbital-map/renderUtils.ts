
// render utils
import * as d3 from 'd3';

export function getRadiusByDepth(depth: number): number {
  return Math.max(22, 75 - depth * 12);
}

export function getFontSizeForRadius(r: number): number {
  return Math.max(10, Math.min(18, r * 0.4));
}

export function drag(simulation: d3.Simulation<any, undefined>) {
  function dragstarted(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event: any, d: any) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
}

