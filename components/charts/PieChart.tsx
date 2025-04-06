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
}

export default function PieChart({ data, sentimentColors }: PieChartProps) {
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
    return colorMap[bgClass] || "#d1d5db"; // Default to gray if not found
  };

  const renderPieChart = () => {
    if (!chartRef.current || !data.length) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2;

    // Calculate total for percentages
    const total = data.reduce((sum, d) => sum + d.value, 0);

    // Format number as percentage
    const formatPercent = (value: number) => {
      const percent = (value / total) * 100;
      return percent < 1 ? "<1%" : `${Math.round(percent)}%`;
    };

    // Create the color scale using our custom color mapping
    const color = d3
      .scaleOrdinal<string>()
      .domain(data.map((d) => d.name))
      .range(data.map((d) => getSentimentColor(d.name)));

    // Create the pie layout and arc generator
    const pie = d3
      .pie<PieChartDataItem>()
      .sort((a, b) => b.value - a.value) // Sort by value (largest first)
      .value((d) => d.value);

    const arc = d3
      .arc<d3.PieArcDatum<PieChartDataItem>>()
      .innerRadius(radius * 0.5) // Create a donut chart for better visibility
      .outerRadius(radius - 10);

    const outerArc = d3
      .arc<d3.PieArcDatum<PieChartDataItem>>()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);

    const arcs = pie(data);

    // Create the SVG container
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto;")
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Add title in the center
    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("y", -5)
      .text("Sentiment");

    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("y", 15)
      .text("Distribution");

    // Create gradient for slices
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

    // Add a sector path for each value with gradient
    const slice = svg
      .selectAll("path")
      .data(arcs)
      .join("path")
      .attr("d", arc as any)
      .attr("fill", (d, i) => `url(#gradient-${i})`)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d: d3.PieArcDatum<PieChartDataItem>) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("transform", function () {
            const dist = 5;
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

    // Add hover tooltip
    slice
      .append("title")
      .text(
        (d) =>
          `${(d.data as any).name}: ${(d.data as any).value} (${formatPercent((d.data as any).value)})`,
      );

    // Utility function for calculating the middle angle of a slice
    function midAngle(d: any) {
      return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

    // Only add labels for segments that are large enough
    const labelThreshold = total * 0.04; // 4% threshold for labels

    // Filter data for labels
    const labelsData = arcs.filter(
      (d) => (d.data as any).value >= labelThreshold,
    );

    // IMPROVED LABEL POSITIONING ALGORITHM

    // Helper function to determine if two labels would overlap
    const wouldOverlap = (
      pos1: [number, number],
      pos2: [number, number],
      height: number = 30,
      width: number = 80,
    ) => {
      const [x1, y1] = pos1;
      const [x2, y2] = pos2;

      // Horizontal overlap check
      const horizontalOverlap = Math.abs(x1 - x2) < width;

      // Vertical overlap check
      const verticalOverlap = Math.abs(y1 - y2) < height;

      return horizontalOverlap && verticalOverlap;
    };

    // Calculate initial positions for all labels
    type LabelPosition = {
      id: number;
      data: d3.PieArcDatum<PieChartDataItem>;
      pos: [number, number];
      angle: number;
      side: "left" | "right";
    };

    // Calculate and sort label positions by vertical position
    const labelPositions: LabelPosition[] = labelsData.map((d, i) => {
      const angle = midAngle(d);
      const side = angle < Math.PI ? "right" : "left";

      const pos = outerArc.centroid(d as any);
      pos[0] = radius * 0.95 * (side === "right" ? 1 : -1);

      return {
        id: i,
        data: d,
        pos: [pos[0], pos[1]],
        angle,
        side,
      };
    });

    // Sort labels by y-position (top to bottom)
    const sortedLabels = {
      left: labelPositions
        .filter((l) => l.side === "left")
        .sort((a, b) => a.pos[1] - b.pos[1]),
      right: labelPositions
        .filter((l) => l.side === "right")
        .sort((a, b) => a.pos[1] - b.pos[1]),
    };

    // Adjust positions to prevent overlaps (for each side separately)
    ["left", "right"].forEach((side) => {
      const labels = sortedLabels[side as "left" | "right"];

      // Skip if no labels on this side
      if (labels.length <= 1) return;

      // Minimum vertical space between labels
      const minSpacing = 20;

      // Process labels from top to bottom
      for (let i = 1; i < labels.length; i++) {
        const prevLabel = labels[i - 1];
        const currLabel = labels[i];

        // If this label would overlap with previous label
        if (currLabel.pos[1] - prevLabel.pos[1] < minSpacing) {
          // Push current label down
          currLabel.pos[1] = prevLabel.pos[1] + minSpacing;
        }
      }

      // Second pass: If labels now extend too far down, push some labels up
      if (labels.length > 2) {
        const bottomLabel = labels[labels.length - 1];
        if (bottomLabel.pos[1] > height / 2 - 20) {
          // How much we need to move everything up
          const offset = bottomLabel.pos[1] - (height / 2 - 20);

          // Distribute the offset among all labels
          const perLabelOffset = offset / (labels.length - 1);

          // Start from the second label (keep first in place)
          for (let i = 1; i < labels.length; i++) {
            labels[i].pos[1] -= perLabelOffset * (labels.length - i);
          }
        }
      }
    });

    // Flatten positions back to a single array
    const adjustedPositions = [...sortedLabels.left, ...sortedLabels.right];

    // Add polylines for connecting labels with adjusted positions
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
      .attr("stroke-width", 1)
      .attr("opacity", 0.5);

    // Add labels with adjusted positions
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

        // Name on first line, percentage on second
        return `<tspan x="${x}" y="${y}" text-anchor="${side === "right" ? "start" : "end"}">${dataItem.name.substring(0, 10)}</tspan>
                <tspan x="${x}" y="${y + 14}" text-anchor="${side === "right" ? "start" : "end"}" font-size="10px">${formatPercent(dataItem.value)}</tspan>`;
      })
      .attr("fill", "#333");

    // Add legend at the bottom of the chart
    const legendRectSize = 12;
    const legendSpacing = 5;
    const legendHeight = legendRectSize + legendSpacing;

    // Calculate the width available for the legend
    const legendWidth = width - 40;

    // Determine how many items can fit in a row based on average text length
    const avgItemWidth = 80; // Estimate based on average item text width
    const legendItemsPerRow = Math.max(
      2,
      Math.floor(legendWidth / avgItemWidth),
    );

    // Create legend groups with improved positioning
    const legend = svg
      .selectAll(".legend")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", function (d, i) {
        const row = Math.floor(i / legendItemsPerRow);
        const col = i % legendItemsPerRow;

        // Calculate column width based on number of items per row
        const colWidth = legendWidth / legendItemsPerRow;

        // Position columns evenly
        const x = -legendWidth / 2 + col * colWidth + 10;

        // Position rows at the bottom of the chart
        const y =
          height / 2 -
          30 -
          (data.length / legendItemsPerRow) * legendHeight +
          row * legendHeight;

        return `translate(${x}, ${y})`;
      });

    // Add colored rectangles to legend
    legend
      .append("rect")
      .attr("width", legendRectSize)
      .attr("height", legendRectSize)
      .attr("fill", (d) => color(d.name));

    // Add text to legend
    legend
      .append("text")
      .attr("x", legendRectSize + legendSpacing)
      .attr("y", legendRectSize - legendSpacing + 2)
      .attr("font-size", "10px")
      .text((d) => {
        const displayName =
          d.name.length > 8 ? `${d.name.substring(0, 8)}...` : d.name;
        return `${displayName} (${formatPercent(d.value)})`;
      });
  };

  return (
    <div className="flex flex-col items-center">
      <div ref={chartRef} className="flex justify-center"></div>
      {data.length === 0 && (
        <div className="text-gray-500 mt-8">No sentiment data available</div>
      )}
    </div>
  );
}
