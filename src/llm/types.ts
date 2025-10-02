export type TooltipContext = { concept: 'condition'|'medication'|'lab'|'code'; text?: string; code?: { system?: string; code?: string; display?: string } };
export type TooltipProvider = (ctx: TooltipContext) => Promise<string> | string;
