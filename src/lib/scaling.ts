import type { Quantity } from "@/types/domain";

export function scaleQuantity(quantity: number | null, baseServings: number, targetServings: number): number | null {
  if (quantity === null) return null;
  if (baseServings <= 0) throw new Error("baseServings must be greater than 0");
  return roundForCooking(quantity * (targetServings / baseServings));
}

export function scaleIngredient(ingredient: Quantity, baseServings: number, targetServings: number): Quantity {
  return {
    ...ingredient,
    quantity: scaleQuantity(ingredient.quantity, baseServings, targetServings),
  };
}

function roundForCooking(value: number): number {
  if (value >= 10) return Math.round(value);
  return Math.round(value * 10) / 10;
}
