"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface CirclePackDataItem {
  id: string;
  value: number;
}

interface CirclePackProps {
  data: CirclePackDataItem[];
  width?: number;
  height?: number;
}

export default function CirclePack({
  data,
  width = 600,
  height = 600,
}: CirclePackProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && chartRef.current && data.length > 0) {
      renderCirclePack();
    }
  }, [data, isMounted, width, height]);

  const renderCirclePack = () => {
    if (!chartRef.current) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Configure dimensions and margins
    const margin = 1; // to avoid clipping the root circle stroke

    // Helpers for extracting info from data structure
    const name = (d: any) => d.id.split(".").pop(); // "Strings" of "flare.util.Strings"
    const group = (d: any) => d.id.split(".")[0]; // Group by first segment
    const names = (d: any) => name(d).split(/(?=[A-Z][a-z])|\s+/g); // ["Legend", "Item"] of "LegendItems"

    // Format for numbers
    const format = d3.format(",d");

    // Create a categorical color scale
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Define the type for our hierarchy data
    interface HierarchyData {
      children: CirclePackDataItem[];
    }

    // Create the pack layout with proper typing
    const pack = d3
      .pack<HierarchyData>()
      .size([width - margin * 2, height - margin * 2])
      .padding(3);

    // Prepare hierarchical data structure
    const hierarchyData: HierarchyData = {
      children: data,
    };

    // Compute the hierarchy and apply the pack layout
    const root = pack(
      d3
        .hierarchy<HierarchyData>(hierarchyData)
        .sum((d) => (d as any).value || 0),
    );

    // Create the SVG container
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-margin, -margin, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
      .attr("text-anchor", "middle");

    // Add title to the chart
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Sentiment Analysis Distribution");

    // Place each node according to the layout's x and y values
    const node = svg
      .append("g")
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Add a title tooltip
    node
      .append("title")
      .text((d) => `${(d.data as any).id}\n${format((d.data as any).value)}`);

    // Add a filled circle
    node
      .append("circle")
      .attr("fill-opacity", 0.7)
      .attr("fill", (d) => color(group(d.data as any)))
      .attr("r", (d) => d.r);

    // Add a label
    const text = node.append("text").attr("clip-path", (d) => `circle(${d.r})`);

    // Add a tspan for each word in the name
    text
      .selectAll("tspan.name")
      .data((d) => {
        const n = (d.data as any).id.split(".").pop();
        return n ? [n] : [];
      })
      .join("tspan")
      .attr("class", "name")
      .attr("x", 0)
      .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.35}em`)
      .attr("font-weight", "bold")
      .text((d) => d);

    // Add a tspan for the node's value
    text
      .append("tspan")
      .attr("x", 0)
      .attr("y", (d) => {
        const nameLength =
          ((d.data as any).id.split(".").pop()?.length || 0) > 0 ? 1 : 0;
        return `${nameLength / 2 + 0.35}em`;
      })
      .attr("fill-opacity", 0.7)
      .text((d) => format((d.data as any).value));

    // Add legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 120}, 40)`);

    const uniqueGroups = Array.from(
      new Set(data.map((d) => d.id.split(".")[0])),
    );

    uniqueGroups.forEach((group, i) => {
      const legendRow = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 20})`);

      legendRow
        .append("rect")
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", color(group as string));

      legendRow
        .append("text")
        .attr("x", 15)
        .attr("y", 10)
        .attr("text-anchor", "start")
        .attr("font-size", "12px")
        .text(group);
    });
  };

  return (
    <div className="circle-pack-container">
      <div ref={chartRef} className="flex justify-center"></div>
    </div>
  );
}
