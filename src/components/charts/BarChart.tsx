"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface BarChartDataItem {
  id: number;
  text: string;
  width: number;
  length: number;
  sentiments: string;
}

interface BarChartProps {
  data: BarChartDataItem[];
  width?: number;
}

export default function BarChart({ data }: BarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current) {
      renderBarChart();
    }
  }, [data]);

  const renderBarChart = () => {
    if (!chartRef.current || !data.length) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    const width = 400;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };

    // Create the SVG container
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // Create scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.id.toString()))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.length) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Add bars
    svg
      .append("g")
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (d) => x(d.id.toString()) ?? 0)
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => y(0) - y(d.length))
      .attr("width", x.bandwidth())
      .attr("fill", "steelblue")
      .append("title")
      .text((d) => `${d.text}\nSentiments: ${d.sentiments}`);

    // Add x-axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d) => (+d + 1).toString()))
      .append("text")
      .attr("x", width / 2)
      .attr("y", margin.bottom - 4)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .text("Segment");

    // Add y-axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 10)
      .attr("x", -height / 2)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .text("Character Count");
  };

  return <div ref={chartRef}></div>;
}
