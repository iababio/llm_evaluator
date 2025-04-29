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

    d3.select(chartRef.current).selectAll("*").remove();

    const margin = 1;

    const name = (d: any) => d.id.split(".").pop();
    const group = (d: any) => d.id.split(".")[0];
    const names = (d: any) => name(d).split(/(?=[A-Z][a-z])|\s+/g);

    const format = d3.format(",d");

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    interface HierarchyData {
      children: CirclePackDataItem[];
    }

    const pack = d3
      .pack<HierarchyData>()
      .size([width - margin * 2, height - margin * 2])
      .padding(3);

    const hierarchyData: HierarchyData = {
      children: data,
    };

    const root = pack(
      d3
        .hierarchy<HierarchyData>(hierarchyData)
        .sum((d) => (d as any).value || 0),
    );

    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-margin, -margin, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
      .attr("text-anchor", "middle");

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Sentiment Analysis Distribution");

    const node = svg
      .append("g")
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    node
      .append("title")
      .text((d) => `${(d.data as any).id}\n${format((d.data as any).value)}`);

    node
      .append("circle")
      .attr("fill-opacity", 0.7)
      .attr("fill", (d) => color(group(d.data as any)))
      .attr("r", (d) => d.r);

    const text = node.append("text").attr("clip-path", (d) => `circle(${d.r})`);

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
