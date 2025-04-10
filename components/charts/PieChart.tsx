"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface PieChartDataItem {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieChartDataItem[];
  sentimentColors: Record<string, string>;
  width?: number;
  height?: number;
}

export default function PieChart({
  data,
  sentimentColors,
  width = 240, // Reduced default width
  height = 200, // Reduced default height
}: PieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current) {
      renderPieChart();
    }
  }, [data]);

  const getSentimentColor = (sentiment: string): string => {
    const sentimentKey = sentiment.toLowerCase();
    const colorClass = sentimentColors[sentimentKey] || "bg-gray-300";

    const colorMap: Record<string, string> = {
      "bg-emerald-100": "#34d399", // Brighter emerald
      "bg-yellow-100": "#fbbf24", // Brighter yellow
      "bg-red-100": "#f87171", // Brighter red
      "bg-orange-100": "#fb923c", // Brighter orange
      "bg-green-100": "#4ade80", // Brighter green
      "bg-pink-100": "#f472b6", // Brighter pink
      "bg-purple-100": "#a78bfa", // Brighter purple
      "bg-indigo-100": "#818cf8", // Brighter indigo
      "bg-blue-100": "#60a5fa", // Brighter blue
      "bg-teal-100": "#2dd4bf", // Brighter teal
      "bg-rose-100": "#fb7185", // Brighter rose
      "bg-amber-100": "#fbbf24", // Brighter amber
      "bg-violet-100": "#a78bfa", // Brighter violet
      "bg-cyan-100": "#22d3ee", // Brighter cyan
      "bg-sky-100": "#38bdf8", // Brighter sky
      "bg-lime-100": "#a3e635", // Brighter lime
      "bg-slate-100": "#94a3b8", // Brighter slate
      "bg-zinc-100": "#a1a1aa", // Brighter zinc
      "bg-gray-300": "#d1d5db", // Default gray
    };

    const bgClass = colorClass.split(" ")[0];
    return colorMap[bgClass] || "#d1d5db";
  };

  const renderPieChart = () => {
    if (!chartRef.current || !data.length) return;

    d3.select(chartRef.current).selectAll("*").remove();

    const chartHeight = height;
    const chartWidth = width;
    // Reduce the radius to make the outer circle smaller
    const radius = (Math.min(chartWidth, chartHeight) / 2) * 0.65;

    const total = data.reduce((sum, d) => sum + d.value, 0);

    const formatPercent = (value: number) => {
      const percent = (value / total) * 100;
      return percent < 1 ? "<1%" : `${Math.round(percent)}%`;
    };

    const color = d3
      .scaleOrdinal<string>()
      .domain(data.map((d) => d.name))
      .range(data.map((d) => getSentimentColor(d.name)));

    const pie = d3
      .pie<PieChartDataItem>()
      .sort((a, b) => b.value - a.value)
      .value((d) => d.value);

    const arc = d3
      .arc<d3.PieArcDatum<PieChartDataItem>>()
      .innerRadius(radius * 0.35) // Increased inner circle size
      .outerRadius(radius - 30); // Tighter outer circle with less padding

    const outerArc = d3
      .arc<d3.PieArcDatum<PieChartDataItem>>()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);

    const arcs = pie(data);

    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
      .attr("style", "max-width: 100%; height: auto;")
      .append("g")
      .attr("transform", `translate(${chartWidth / 2},${chartHeight / 2})`);

    // Title text
    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .attr("y", -5)
      .text("Sentiment");

    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("y", 8)
      .text("Distribution");

    const defs = svg.append("defs");
    arcs.forEach((d, i) => {
      const gradientId = `gradient-${i}`;
      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "100%");

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr(
          "stop-color",
          d3
            .color(color((d.data as any).name))
            ?.brighter(0.5)
            .toString() || "#fff",
        );

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color((d.data as any).name));
    });

    const slice = svg
      .selectAll("path")
      .data(arcs)
      .join("path")
      .attr("d", arc as any)
      .attr("fill", (d, i) => `url(#gradient-${i})`)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d: d3.PieArcDatum<PieChartDataItem>) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("transform", function () {
            const dist = 3;
            const midAngle = (d.startAngle + d.endAngle) / 2;
            const x = Math.sin(midAngle) * dist;
            const y = -Math.cos(midAngle) * dist;
            return `translate(${x},${y})`;
          });
      })
      .on("mouseout", function () {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("transform", "translate(0,0)");
      });

    slice
      .append("title")
      .text(
        (d) =>
          `${(d.data as any).name}: ${(d.data as any).value} (${formatPercent((d.data as any).value)})`,
      );

    function midAngle(d: any) {
      return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

    // Show labels for all slices
    const labelThreshold = total * 0.01; // Very low threshold to include all slices

    const labelsData = arcs.filter(
      (d) => (d.data as any).value >= labelThreshold,
    );

    type LabelPosition = {
      id: number;
      data: d3.PieArcDatum<PieChartDataItem>;
      pos: [number, number];
      angle: number;
      side: "left" | "right";
    };

    // Move labels outward to accommodate the larger font
    const labelPositions: LabelPosition[] = labelsData.map((d, i) => {
      const angle = midAngle(d);
      const side = angle < Math.PI ? "right" : "left";

      const pos = outerArc.centroid(d as any);
      // Extend labels further out from the chart
      pos[0] = radius * 1.05 * (side === "right" ? 1 : -1);

      return {
        id: i,
        data: d,
        pos: [pos[0], pos[1]],
        angle,
        side,
      };
    });

    const sortedLabels = {
      left: labelPositions
        .filter((l) => l.side === "left")
        .sort((a, b) => a.pos[1] - b.pos[1]),
      right: labelPositions
        .filter((l) => l.side === "right")
        .sort((a, b) => a.pos[1] - b.pos[1]),
    };

    ["left", "right"].forEach((side) => {
      const labels = sortedLabels[side as "left" | "right"];

      if (labels.length <= 1) return;

      const minSpacing = 28; // Further increased spacing for better separation

      for (let i = 1; i < labels.length; i++) {
        const prevLabel = labels[i - 1];
        const currLabel = labels[i];

        if (currLabel.pos[1] - prevLabel.pos[1] < minSpacing) {
          currLabel.pos[1] = prevLabel.pos[1] + minSpacing;
        }
      }

      if (labels.length > 2) {
        const bottomLabel = labels[labels.length - 1];
        if (bottomLabel.pos[1] > chartHeight / 2 - 25) {
          // Increased bottom padding
          const offset = bottomLabel.pos[1] - (chartHeight / 2 - 25);

          const perLabelOffset = offset / (labels.length - 1);

          for (let i = 1; i < labels.length; i++) {
            labels[i].pos[1] -= perLabelOffset * (labels.length - i);
          }
        }
      }
    });

    const adjustedPositions = [...sortedLabels.left, ...sortedLabels.right];

    svg
      .selectAll("polyline")
      .data(adjustedPositions)
      .join("polyline")
      .attr("points", function (d) {
        const [x, y] = d.pos;
        const arcCentroid = arc.centroid(d.data as any);
        const outerArcCentroid = outerArc.centroid(d.data as any);
        return [arcCentroid, outerArcCentroid, [x, y]].join(",");
      })
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.5);

    // Larger label text
    svg
      .selectAll("text.label")
      .data(adjustedPositions)
      .join("text")
      .attr("class", "label")
      .attr("dy", ".35em")
      .html(function (d) {
        const [x, y] = d.pos;
        const side = d.side;
        const dataItem = d.data.data as any;
        const name = dataItem.name;

        return `<tspan x="${x}" y="${y}" text-anchor="${side === "right" ? "start" : "end"}" font-size="12px">${name}</tspan>
                <tspan x="${x}" y="${y + 14}" text-anchor="${side === "right" ? "start" : "end"}" font-size="12px">${formatPercent(dataItem.value)}</tspan>`;
      })
      .attr("fill", "#333");

    // Add compact legend
    const legendRectSize = 8;
    const legendSpacing = 3;
    const legendHeight = legendRectSize + legendSpacing;

    // Position legend outside the main chart area
    const legendWidth = chartWidth - 10;

    // Wider legend items to prevent overlap
    const avgItemWidth = 80; // Increased width for legend items
    const legendItemsPerRow = Math.max(
      2, // Reduce to 2 items per row
      Math.floor(legendWidth / avgItemWidth),
    );

    const legend = svg
      .selectAll(".legend")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", function (d, i) {
        const row = Math.floor(i / legendItemsPerRow);
        const col = i % legendItemsPerRow;

        const colWidth = legendWidth / legendItemsPerRow;

        const x = -legendWidth / 2 + col * colWidth + 10;

        // Increase spacing between legend rows
        const y =
          chartHeight / 2 -
          30 - // More space from bottom
          (data.length / legendItemsPerRow) * legendHeight * 1.5 + // Increased multiplier for more space
          row * legendHeight * 1.5; // Increased vertical spacing

        return `translate(${x}, ${y})`;
      });

    legend
      .append("rect")
      .attr("width", legendRectSize)
      .attr("height", legendRectSize)
      .attr("fill", (d) => color(d.name));

    legend
      .append("text")
      .attr("x", legendRectSize + legendSpacing)
      .attr("y", legendRectSize - legendSpacing + 1)
      .attr("font-size", "9px") // Increased font size
      .text(function (d) {
        // Shorter names for legend to prevent overlap
        const displayName =
          d.name.length > 5 ? `${d.name.substring(0, 8)}...` : d.name;
        // Shorter percentage representation
        return `${displayName} (${formatPercent(d.value)})`;
      });
  };

  return (
    <div className="flex flex-col items-center">
      <div ref={chartRef} className="flex justify-center"></div>
      {data.length === 0 && (
        <div className="text-gray-500 mt-4 text-xs">No data available</div>
      )}
    </div>
  );
}
