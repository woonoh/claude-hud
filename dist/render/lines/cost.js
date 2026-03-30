import { label, green, yellow, red, RESET } from '../colors.js';

function getCostColor(cost) {
  if (cost >= 5.0) return red;
  if (cost >= 1.0) return yellow;
  return green;
}

function formatCost(amount) {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1.0) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

export function renderCostLine(ctx) {
  if (!ctx.costData) return null;

  const { totalCost, tier } = ctx.costData;
  const colors = ctx.config?.colors;
  const colorFn = getCostColor(totalCost);

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `${label('Cost', colors)} ${colorFn(formatCost(totalCost))} ${label(`(${tierLabel})`, colors)}`;
}
//# sourceMappingURL=cost.js.map
