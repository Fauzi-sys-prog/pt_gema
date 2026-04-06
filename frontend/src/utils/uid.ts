export const uid = (prefix = "ID") => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
