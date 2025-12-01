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
import { RefreshCw, Plus, Minus, Maximize } from 'lucide-react';

interface TopologyGraphProps {
  nodes: Device[];
  links: Link[];
  onRefresh: () => void;
  onNodeClick?: (device: Device) => void;
}

const TopologyGraph: React.FC<TopologyGraphProps> = ({ nodes, links, onRefresh, onNodeClick }) => {
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

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    
    // Safety check for empty data to prevent D3 errors
    const safeNodes = nodes.map(n => ({...n})); 
    const safeLinks = links.map(l => ({...l})); 

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    // Clear previous render
    select(svgRef.current).selectAll("*").remove();

    const svg = select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "100%");

    // Container group for zooming
    const g = svg.append("g");

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior);

    // Simulation Setup
    const simulation = forceSimulation(safeNodes as SimulationNodeDatum[])
      .force("link", forceLink(safeLinks).id((d: any) => d.id).distance(250)) // More distance for labels
      .force("charge", forceManyBody().strength(-1000))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide().radius(70));

    // --- Draw Links ---
    const linkGroup = g.append("g").attr("class", "links");
    
    const link = linkGroup
      .selectAll("line")
      .data(safeLinks)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(parseInt(d.bandwidth || '1')) * 2)
      .attr("stroke", (d: any) => d.status === 'DOWN' ? '#ef4444' : '#475569')
      .attr("stroke-opacity", 0.6);

    // --- Draw Link Labels (Ports) ---
    // We use a group for each label to contain the text and a background rect
    const labelGroup = g.append("g").attr("class", "labels");
    
    const linkLabel = labelGroup
      .selectAll("g")
      .data(safeLinks)
      .join("g");

    // White/Dark background for text to make it readable over lines
    linkLabel.append("rect")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", "#0f172a") // Dark background matching theme
        .attr("fill-opacity", 0.8)
        .attr("stroke", "#334155")
        .attr("stroke-width", 1);

    const labelText = linkLabel.append("text")
      .text((d: any) => d.label || '')
      .attr("font-size", "11px")
      .attr("fill", "#cbd5e1") // slate-300
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-family", "monospace");
      
    // Resize rect based on text size (approximate)
    linkLabel.each(function(d: any) {
        const textWidth = d.label ? d.label.length * 7 : 0;
        select(this).select("rect")
            .attr("width", textWidth + 10)
            .attr("height", 18)
            .attr("x", -(textWidth + 10) / 2)
            .attr("y", -9);
    });

    // --- Draw Nodes ---
    const nodeGroup = g.append("g").attr("class", "nodes");
    
    const node = nodeGroup
      .selectAll("g")
      .data(safeNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag(simulation) as any)
      .on("click", (event, d: any) => {
          // Stop propagation to prevent map drag/click issues
          event.stopPropagation();
          if (onNodeClick) onNodeClick(d);
      });

    // Node Glow effect for Hover (Initial invisible)
    node.append("circle")
        .attr("r", 35)
        .attr("fill", (d: any) => getStatusColor(d.status))
        .attr("fill-opacity", 0)
        .attr("class", "hover-glow")
        .transition().duration(200);

    // Node Main Circle
    node.append("circle")
      .attr("r", 28)
      .attr("fill", "#1e293b") // slate-800
      .attr("stroke", (d: any) => getStatusColor(d.status))
      .attr("stroke-width", 3);

    // Icon / Type Text
    node.append("text")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("stroke", "none")
      .attr("fill", "#fff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text((d: any) => {
          if (d.type === DeviceType.ROUTER) return 'R';
          if (d.type === DeviceType.SWITCH) return 'SW';
          if (d.type === DeviceType.FIREWALL) return 'FW';
          return 'S';
      });

    // Node Name Label
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 45)
      .text((d: any) => d.name)
      .attr("text-anchor", "middle")
      .attr("fill", "#e2e8f0")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("pointer-events", "none")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)");

    // Hover Events
    node.on("mouseenter", function() {
        select(this).select(".hover-glow").attr("fill-opacity", 0.3);
        select(this).select("circle").attr("stroke", "#fff");
    }).on("mouseleave", function(event, d: any) {
        select(this).select(".hover-glow").attr("fill-opacity", 0);
        select(this).select("circle").attr("stroke", getStatusColor(d.status));
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      
      linkLabel
        .attr("transform", (d: any) => {
            const x = (d.source.x + d.target.x) / 2;
            const y = (d.source.y + d.target.y) / 2;
            return `translate(${x},${y})`;
        });

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, onNodeClick]);

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
    <div className="relative w-full h-[700px] bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-inner group" ref={wrapperRef}>
      <svg ref={svgRef} className="w-full h-full cursor-move outline-none"></svg>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-slate-800/90 p-2 rounded-lg backdrop-blur-sm border border-slate-700 shadow-lg">
         <button onClick={onRefresh} className="p-2 hover:bg-slate-700 rounded text-slate-300 transition-colors" title="Refresh Topology">
            <RefreshCw size={20} />
         </button>
      </div>

      <div className="absolute bottom-4 left-4 bg-slate-800/90 p-4 rounded-lg backdrop-blur-sm border border-slate-700 text-xs text-slate-300 shadow-lg pointer-events-none">
        <h4 className="font-semibold mb-2 text-slate-400 uppercase tracking-wider">Legend</h4>
        <div className="flex items-center gap-3 mb-1"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Online</div>
        <div className="flex items-center gap-3 mb-1"><span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span> Warning</div>
        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span> Offline</div>
        <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-700 pt-2">
            Click nodes for details
        </div>
      </div>
    </div>
  );
};

export default TopologyGraph;
