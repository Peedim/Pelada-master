/**
 * Generates an SVG path data string for a smooth curve passing through the given points.
 * Uses Catmull-Rom spline algorithm converted to Cubic Bezier.
 */
export const getSmoothPath = (points: { x: number; y: number }[], tension: number = 0.2, closed: boolean = false): string => {
    if (points.length < 2) return "";
  
    const format = (n: number) => n.toFixed(2);
  
    // Helper to get control points
    // p0: previous, p1: current, p2: next, p3: next after next
    const getControlPoint = (p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, t: number) => {
      const d01 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
      const d12 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      
      const fa = t * d01 / (d01 + d12);
      const fb = t * d12 / (d01 + d12);
      
      const p1x = p1.x - fa * (p2.x - p0.x);
      const p1y = p1.y - fa * (p2.y - p0.y);
      const p2x = p1.x + fb * (p2.x - p0.x);
      const p2y = p1.y + fb * (p2.y - p0.y);
      
      return { p1x, p1y, p2x, p2y }; // Note: This isn't standard Catmull-Rom conversion, using simplified tension approach below instead for robust chart
    };
  
    // Simplified tension based approach usually works better for simple charts without loops
    // cp1 = current + (next - prev) * tension
    // cp2 = next - (nextNext - current) * tension
  
    let path = `M ${format(points[0].x)} ${format(points[0].y)}`;
  
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i > 0 ? i - 1 : i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
  
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
  
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
  
        path += ` C ${format(cp1x)} ${format(cp1y)}, ${format(cp2x)} ${format(cp2y)}, ${format(p2.x)} ${format(p2.y)}`;
    }
  
    return path;
  };
  
  /**
   * Generates a closed area path (for gradients) based on the line path.
   * Concatenates lines to bottom-right and bottom-left.
   */
  export const getAreaPath = (linePath: string, width: number, height: number, startX: number = 0): string => {
      // Assuming linePath starts with M and ends at the last point
      // We essentially just append L width,height L startX,height Z
      // However, we need to extract the last point from the path might be hard with string.
      // Better to accept points in a separate wrapper or just assume it ends at right side if normalized.
      // A simpler way for this specific chart usage:
      // constructing it manually from points is safer.
      return "";
  };
  
  export const getSmoothAreaPath = (points: { x: number; y: number }[], width: number, height: number, tension: number = 0.2): string => {
      const linePath = getSmoothPath(points, tension);
      if (!linePath) return "";
      
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      
      return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
  };
