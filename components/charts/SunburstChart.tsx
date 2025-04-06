"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface SunburstDataItem {
  name: string;
  value?: number;
  children?: SunburstDataItem[];
}

// Extended interface to include D3 partition layout properties
interface PartitionHierarchyNode extends d3.HierarchyNode<SunburstDataItem> {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  current?: any;
  target?: any;
}

interface SunburstChartProps {
  data: SunburstDataItem;
  width?: number;
  height?: number;
  maxDepth?: number;
}

export default function SunburstChart({
  data,
  width = 360,
  height = 360,
  maxDepth = 2,
}: SunburstChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current && data && (data.children?.length || 0) > 0) {
      renderSunburstChart();
    }
  }, [data, width, height, maxDepth]);

  const renderSunburstChart = () => {
    if (!chartRef.current) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Define fixed margins to ensure proper fit
    const margin = { top: 35, right: 10, bottom: 10, left: 10 };

    // Calculate available space for chart
    const availableWidth = width - margin.left - margin.right;
    const availableHeight = height - margin.top - margin.bottom;

    // Calculate radius based on available space
    const radius = Math.min(availableWidth, availableHeight) / 2;

    // Reduced center circle size to 8% of radius
    const centerRadius = radius * 0.08;

    // Create the color scale
    const colorScheme = d3.schemeCategory10;
    const color = d3.scaleOrdinal(colorScheme);

    // Compute the hierarchy layout
    const hierarchy = d3
      .hierarchy(data)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Modify partition to start closer to center
    const root = d3
      .partition<SunburstDataItem>()
      .size([2 * Math.PI, hierarchy.height + 0.5])(
      // Reduced from +1 to +0.5
      hierarchy,
    );

    root.each((d) => {
      (d as any).current = d;
    });

    // Create the arc generator
    const arc = d3
      .arc<any>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius((d) => {
        // Make first level start very close to center, with minimal gap
        if (d.y0 === 0) return centerRadius;
        // Scale y0 to start closer to center
        return Math.max(d.y0 * radius * 0.7, centerRadius);
      })
      .outerRadius((d) => Math.max(d.y0 * radius * 0.7, d.y1 * radius - 1));

    // Create the SVG container with proper dimensions and viewBox
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;")
      .style("font", "11px sans-serif");

    // Create a group for the sunburst with proper translation to account for margins
    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${width / 2}, ${margin.top + radius})`);

    // Add title to the chart
    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .attr("x", width / 2)
      .attr("y", 20)
      .text("Sentiment Analysis");

    // Calculate total value for percentage display
    const totalValue = root.value || 0;

    // Append the arcs - filtered to maxDepth for simplicity
    const path = chartGroup
      .selectAll("path")
      .data(
        root
          .descendants()
          .slice(1)
          .filter((d) => d.depth <= maxDepth),
      ) // Limit depth
      .join("path")
      .attr("fill", (d) => {
        let current = d;
        while (current.depth > 1) current = current.parent!;
        return color(current.data.name);
      })
      .attr("fill-opacity", (d) =>
        arcVisible((d as any).current) ? (d.children ? 0.8 : 0.6) : 0,
      )
      .attr("pointer-events", (d) =>
        arcVisible((d as any).current) ? "auto" : "none",
      )
      .attr("d", (d) => arc((d as any).current));

    // Add gradient effect
    const defs = svg.append("defs");
    root
      .descendants()
      .slice(1)
      .filter((d) => d.depth <= maxDepth)
      .forEach((d, i) => {
        let current = d;
        while (current.depth > 1) current = current.parent!;
        const baseColor = color(current.data.name);

        const gradientId = `sunburst-gradient-${i}`;
        const gradient = defs
          .append("radialGradient")
          .attr("id", gradientId)
          .attr("cx", "35%")
          .attr("cy", "35%")
          .attr("r", "60%");

        gradient
          .append("stop")
          .attr("offset", "0%")
          .attr(
            "stop-color",
            d3.color(baseColor)?.brighter(0.3).toString() || "#fff",
          );

        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", baseColor);
      });

    // Update paths with gradients
    path.each(function (d, i) {
      d3.select(this).attr("fill", `url(#sunburst-gradient-${i})`);
    });

    // Make them clickable if they have children
    path
      .filter((d) => !!d.children)
      .style("cursor", "pointer")
      .on("click", clicked);

    // Format for numbers - percentage display
    const format = (value: number) => {
      const percentage = (value / totalValue) * 100;
      return percentage < 1 ? "<1%" : `${Math.round(percentage)}%`;
    };

    // Add tooltips with more detailed info
    path.append("title").text((d) => {
      const ancestry = d
        .ancestors()
        .map((d) => d.data.name)
        .reverse()
        .join("/");
      return `${ancestry}\nCount: ${d.value}\n${format(d.value || 0)}`;
    });

    // Adjust label visibility thresholds to show more labels
    const label = chartGroup
      .append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
      .selectAll("text")
      .data(
        root
          .descendants()
          .slice(1)
          .filter((d) => {
            // Reduced thresholds to show more labels
            const angle = d.x1 - d.x0;
            const area = angle * (d.y1 - d.y0);
            return (
              d.depth <= maxDepth && area > 0.03 && d.value! / totalValue > 0.03
            );
          }),
      )
      .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", (d) => +labelVisible((d as any).current))
      .attr("transform", (d) => labelTransform((d as any).current))
      .style("font-size", "9px")
      .text((d) => {
        const name = d.data.name;
        return name.length > 8 ? `${name.substring(0, 6)}...` : name;
      });

    // Make center circle smaller
    const parent = chartGroup
      .append("circle")
      .datum(root)
      .attr("r", centerRadius)
      .attr("fill", "white")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.8)
      .attr("pointer-events", "all")
      .on("click", clicked);

    // Adjust Reset text size
    chartGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "7px") // Smaller font
      .attr("dy", "0.2em") // Adjust vertical position
      .attr("fill", "#555")
      .attr("pointer-events", "none")
      .text("Reset");

    // Add percentage in the center
    chartGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "6px") // Smaller font
      .attr("dy", "1.2em")
      .attr("fill", "#777")
      .attr("pointer-events", "none")
      .text(`100%`);

    // Function to handle zoom on click
    function clicked(event: any, p: PartitionHierarchyNode) {
      parent.datum(p.parent || root);

      root.each((d) => {
        const node = d as unknown as PartitionHierarchyNode;
        node.target = {
          x0:
            Math.max(0, Math.min(1, (node.x0 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          x1:
            Math.max(0, Math.min(1, (node.x1 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          y0: Math.max(0, node.y0 - p.depth),
          y1: Math.max(0, node.y1 - p.depth),
        };
      });

      // Update center text to show percentage of viewed segment
      const percentage =
        p === root ? 100 : Math.round(((p.value || 0) / totalValue) * 100);
      chartGroup
        .select("text[dy='1.2em']") // Updated selector to match new dy value
        .text(`${percentage}%`);

      const duration = event.altKey ? 7500 : 450;
      const transitionName = "sunburstTransition";

      // Use a named transition
      const t = svg.transition(transitionName).duration(duration);

      // Transition the data on all arcs
      path
        .transition(transitionName)
        .tween("data", (d) => {
          const i = d3.interpolate((d as any).current, (d as any).target);
          return (t: number) => ((d as any).current = i(t));
        })
        .filter(function (d) {
          return (
            +((this as SVGElement).getAttribute("fill-opacity") ?? "0") > 0 ||
            arcVisible((d as any).target)
          );
        })
        .attr("fill-opacity", (d) =>
          arcVisible((d as any).target) ? (d.children ? 0.8 : 0.6) : 0,
        )
        .attr("pointer-events", (d) =>
          arcVisible((d as any).target) ? "auto" : "none",
        )
        .attrTween("d", (d) => () => arc((d as any).current) || "");

      label
        .filter(function (d) {
          return (
            +((this as SVGElement).getAttribute("fill-opacity") ?? "0") > 0 ||
            labelVisible((d as any).target)
          );
        })
        .transition(transitionName)
        .attr("fill-opacity", (d) => +labelVisible((d as any).target))
        .attrTween(
          "transform",
          (d) => () => labelTransform((d as any).current),
        );
    }

    // Helper functions for determining visibility
    function arcVisible(d: any) {
      return d.y1 <= maxDepth + 1 && d.y0 >= 0.5 && d.x1 > d.x0; // Changed from 1 to 0.5
    }

    function labelVisible(d: any) {
      return (
        d.y1 <= maxDepth + 1 &&
        d.y0 >= 0.5 &&
        (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
      ); // Reduced threshold
    }

    function labelTransform(d: any) {
      const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
      const y = ((d.y0 + d.y1) / 2) * radius * 0.7; // Match the scale factor from arc definition
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div ref={chartRef} className="w-full overflow-visible"></div>
      {(!data || !data.children || data.children.length === 0) && (
        <div className="text-gray-500 mt-4 text-sm">
          No data available for visualization
        </div>
      )}
    </div>
  );
}
