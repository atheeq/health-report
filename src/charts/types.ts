export type LineSeries = { label: string; points: Array<[number, number]> };
export interface ChartProvider { line(series: LineSeries[]): string; } // inline SVG string
