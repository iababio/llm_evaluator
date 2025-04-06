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
  width,
  height,
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

    const height = 300;
    const radius = Math.min(width!, height) / 2;

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
      .innerRadius(radius * 0.5)
      .outerRadius(radius - 10);

    const outerArc = d3
      .arc<d3.PieArcDatum<PieChartDataItem>>()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);

    const arcs = pie(data);

    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width!)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto;")
      .append("g")
      .attr("transform", `translate(${width! / 2},${height / 2})`);

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

    slice
      .append("title")
      .text(
        (d) =>
          `${(d.data as any).name}: ${(d.data as any).value} (${formatPercent((d.data as any).value)})`,
      );

    function midAngle(d: any) {
      return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

    const labelThreshold = total * 0.04;

    const labelsData = arcs.filter(
      (d) => (d.data as any).value >= labelThreshold,
    );

    const wouldOverlap = (
      pos1: [number, number],
      pos2: [number, number],
      height: number = 30,
      width: number = 80,
    ) => {
      const [x1, y1] = pos1;
      const [x2, y2] = pos2;

      const horizontalOverlap = Math.abs(x1 - x2) < width;

      const verticalOverlap = Math.abs(y1 - y2) < height;

      return horizontalOverlap && verticalOverlap;
    };

    type LabelPosition = {
      id: number;
      data: d3.PieArcDatum<PieChartDataItem>;
      pos: [number, number];
      angle: number;
      side: "left" | "right";
    };

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

      const minSpacing = 20;

      for (let i = 1; i < labels.length; i++) {
        const prevLabel = labels[i - 1];
        const currLabel = labels[i];

        if (currLabel.pos[1] - prevLabel.pos[1] < minSpacing) {
          currLabel.pos[1] = prevLabel.pos[1] + minSpacing;
        }
      }

      if (labels.length > 2) {
        const bottomLabel = labels[labels.length - 1];
        if (bottomLabel.pos[1] > height / 2 - 20) {
          const offset = bottomLabel.pos[1] - (height / 2 - 20);

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
      .attr("stroke-width", 1)
      .attr("opacity", 0.5);

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

        return `<tspan x="${x}" y="${y}" text-anchor="${side === "right" ? "start" : "end"}">${dataItem.name.substring(0, 10)}</tspan>
                <tspan x="${x}" y="${y + 14}" text-anchor="${side === "right" ? "start" : "end"}" font-size="10px">${formatPercent(dataItem.value)}</tspan>`;
      })
      .attr("fill", "#333");

    const legendRectSize = 12;
    const legendSpacing = 5;
    const legendHeight = legendRectSize + legendSpacing;

    const legendWidth = width! - 40;

    const avgItemWidth = 80;
    const legendItemsPerRow = Math.max(
      2,
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

        const y =
          height / 2 -
          30 -
          (data.length / legendItemsPerRow) * legendHeight +
          row * legendHeight;

        return `translate(${x}, ${y})`;
      });

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
