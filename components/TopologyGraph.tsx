import React, { useEffect, useRef, useState } from 'react';
import {
  select,
  zoom as d3Zoom,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  drag as d3Drag,
  SimulationNodeDatum,
  Simulation
} from 'd3';
import { Device, Link, DeviceStatus, DeviceType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface TopologyGraphProps {
  nodes: Device[];
  links: Link[];
  onRefresh: () => void;
}

const TopologyGraph: React.FC<TopologyGraphProps> = ({ nodes, links, onRefresh }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Helper to get color by device status
  const getStatusColor = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.ONLINE: return '#10b981'; // emerald-500
      case DeviceStatus.WARNING: return '#f59e0b'; // amber-500
      case DeviceStatus.OFFLINE: return '#ef4444'; // red-500
      default: return '#64748b';
    }
  };

  // Helper to get shape/icon by type
  const getDeviceIcon = (type: DeviceType) => {
     // Simplified representation: 
     // Router = Square, Switch = Circle, Server = Rect, Firewall = Triangle-ish (path)
     // D3 handles shapes easily with paths or basic shapes
     return type;
  };

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current || nodes.length === 0) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    // Clear previous render
    select(svgRef.current).selectAll("*").remove();

    const svg = select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto;");

    // Add zoom behavior
    const g = svg.append("g");
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior);

    // Simulation Setup
    const simulation = forceSimulation(nodes as SimulationNodeDatum[])
      .force("link", forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", forceManyBody().strength(-500))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide().radius(40));

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#475569") // slate-600
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(parseInt(d.bandwidth || '1')))
      .attr("stroke", (d: any) => d.status === 'DOWN' ? '#ef4444' : '#475569');

    // Draw Nodes
    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(drag(simulation) as any);

    // Node Background Circle
    node.append("circle")
      .attr("r", 25)
      .attr("fill", "#1e293b") // slate-800
      .attr("stroke", (d: any) => getStatusColor(d.status))
      .attr("stroke-width", 3);

    // Node Label
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 40)
      .text((d: any) => d.name)
      .attr("text-anchor", "middle")
      .attr("fill", "#e2e8f0")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .attr("stroke", "none");
    
    // Node Type Label (Icon simplified as text char for now, or SVG path)
    node.append("text")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("stroke", "none")
      .attr("fill", "#94a3b8")
      .style("font-size", "10px")
      .text((d: any) => d.type === DeviceType.ROUTER ? 'R' : d.type === DeviceType.SWITCH ? 'SW' : d.type === DeviceType.FIREWALL ? 'FW' : 'S');

    // Tooltip behavior (simple title for now)
    node.append("title")
      .text((d: any) => `ID: ${d.id}\nIP: ${d.ip}\nStatus: ${d.status}\nLoad: ${d.cpuLoad}%`);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  // Drag utility
  const drag = (simulation: Simulation<SimulationNodeDatum, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3Drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div className="relative w-full h-[600px] bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-inner" ref={wrapperRef}>
      <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-slate-800/80 p-2 rounded-lg backdrop-blur-sm border border-slate-700">
         <button onClick={onRefresh} className="p-2 hover:bg-slate-700 rounded text-slate-300" title="Refresh Topology">
            <RefreshCw size={20} />
         </button>
         <div className="h-px bg-slate-600 my-1"></div>
         <div className="text-center text-xs text-slate-400 font-mono mb-1">{Math.round(zoomLevel * 100)}%</div>
      </div>

      <div className="absolute bottom-4 left-4 bg-slate-800/80 p-3 rounded-lg backdrop-blur-sm border border-slate-700 text-xs text-slate-300">
        <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Online</div>
        <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Warning</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Offline</div>
      </div>
    </div>
  );
};

export default TopologyGraph;