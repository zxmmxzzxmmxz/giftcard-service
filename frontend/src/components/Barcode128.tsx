import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function Barcode128({
  value,
  height = 48,
}: {
  value: string;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // clear previous
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const v = (value || "").trim();
    if (!v) return;

    try {
      JsBarcode(svg, v, {
        format: "CODE128",
        displayValue: false,
        lineColor: "#000",
        background: "#fff",
        height,
        margin: 0,
      });
    } catch {
      // ignore invalid input (rare for CODE128)
    }
  }, [value, height]);

  return <svg ref={svgRef} />;
}
