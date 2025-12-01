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
import { RefreshCw } from 'lucide-react';

interface TopologyGraphProps {
  nodes: Device[];
  links: Link[];
  onRefresh: () => void;
  onNodeClick?: (device: Device) => void;
}

const TopologyGraph: React.FC<TopologyGraphProps> = ({ nodes, links, onRefresh, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const getStatusColor = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.ONLINE: return '#10b981';
      case DeviceStatus.WARNING: return '#f59e0b';
      case DeviceStatus.OFFLINE: return '#ef4444';
      default: return '#64748b';
    }
  };

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    
    const safeNodes = nodes.map(n => ({...n})); 
    const safeLinks = links.map(l => ({...l})); 

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    select(svgRef.current).selectAll("*").remove();

    const svg = select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "100%");

    const g = svg.append("g");

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    const simulation = forceSimulation(safeNodes as SimulationNodeDatum[])
      .force("link", forceLink(safeLinks).id((d: any) => d.id).distance(200)) 
      .force("charge", forceManyBody().strength(-800))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide().radius(80));

    // Links
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup.selectAll("line")
      .data(safeLinks)
      .join("line")
      .attr("stroke-width", 2)
      .attr("stroke", (d: any) => d.status === 'DOWN' ? '#ef4444' : '#475569')
      .attr("stroke-opacity", 0.6);

    // Link Labels (Ports) with Backgrounds
    const labelGroup = g.append("g").attr("class", "labels");
    const linkLabel = labelGroup.selectAll("g")
      .data(safeLinks)
      .join("g");

    linkLabel.append("rect")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", "#0f172a") 
        .attr("fill-opacity", 0.9)
        .attr("stroke", "#334155")
        .attr("stroke-width", 1);

    const labelText = linkLabel.append("text")
      .text((d: any) => d.label || '')
      .attr("font-size", "10px")
      .attr("fill", "#e2e8f0")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-family", "monospace");
      
    linkLabel.each(function(d: any) {
        if (d.label) {
            const textWidth = d.label.length * 6.5;
            select(this).select("rect")
                .attr("width", textWidth + 12)
                .attr("height", 20)
                .attr("x", -(textWidth + 12) / 2)
                .attr("y", -10);
        } else {
             select(this).select("rect").attr("opacity", 0);
        }
    });

    // Nodes
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup.selectAll("g")
      .data(safeNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag(simulation) as any)
      .on("click", (event, d: any) => {
          event.stopPropagation();
          if (onNodeClick) onNodeClick(d);
      });

    // Hover effect circle
    node.append("circle")
        .attr("r", 40)
        .attr("fill", (d: any) => getStatusColor(d.status))
        .attr("fill-opacity", 0)
        .attr("class", "hover-glow")
        .transition().duration(200);

    // Main Node Shape
    node.each(function(d: any) {
        const el = select(this);
        const color = getStatusColor(d.status);
        
        if (d.type === DeviceType.SERVER) {
            // Square for Compute/Server
            el.append("rect")
              .attr("width", 50)
              .attr("height", 50)
              .attr("x", -25)
              .attr("y", -25)
              .attr("rx", 8)
              .attr("fill", "#1e293b")
              .attr("stroke", color)
              .attr("stroke-width", 3);
        } else {
            // Circle for Network (Switch/Router)
            el.append("circle")
              .attr("r", 30)
              .attr("fill", "#1e293b") 
              .attr("stroke", color)
              .attr("stroke-width", 3);
        }
    });

    // Icon / Text inside node
    node.append("text")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("stroke", "none")
      .attr("fill", "#fff")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text((d: any) => {
          if (d.type === DeviceType.SERVER) return 'SRV';
          if (d.type === DeviceType.SWITCH) return 'SW';
          if (d.type === DeviceType.ROUTER) return 'RTR';
          return 'DEV';
      });

    // Name Label
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 50)
      .text((d: any) => d.name)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .style("font-size", "11px")
      .style("font-weight", "500")
      .style("pointer-events", "none")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)");

    // Interactions
    node.on("mouseenter", function() {
        select(this).select(".hover-glow").attr("fill-opacity", 0.3);
    }).on("mouseleave", function(event, d: any) {
        select(this).select(".hover-glow").attr("fill-opacity", 0);
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