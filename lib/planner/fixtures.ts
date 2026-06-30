import type { PlannerDish } from "./types"

export const tooSmallLibrary: PlannerDish[] = [
  {
    id: "l1",
    name: "Chicken Salad",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["fresh"],
    ingredientNames: ["chicken", "lettuce"],
  },
]

export const noSpecialLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Oatmeal",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["oats", "milk"],
  },
  {
    id: "b2",
    name: "Scrambled Eggs",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["savory"],
    ingredientNames: ["eggs", "butter"],
  },
  {
    id: "l1",
    name: "Chicken Salad",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["fresh"],
    ingredientNames: ["chicken", "lettuce", "tomato"],
  },
  {
    id: "l2",
    name: "Pasta",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["umami"],
    ingredientNames: ["pasta", "tomato sauce"],
  },
  {
    id: "l3",
    name: "Rice Bowl",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["savory"],
    ingredientNames: ["rice", "vegetables"],
  },
  {
    id: "l4",
    name: "Sandwich",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["salty"],
    ingredientNames: ["bread", "ham", "cheese"],
  },
]

function makeFlavorDishes(
  count: number,
  flavor: string,
  prefix: string
): PlannerDish[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${i + 1}`,
    mealTime: (prefix.startsWith("b") ? "Breakfast" : "Lunch") as
      | "Breakfast"
      | "Lunch",
    isSpecial: false,
    flavors: [flavor],
    ingredientNames: [`${prefix}_ing_${i + 1}`],
  }))
}

export const singleFlavorLibrary: PlannerDish[] = [
  ...makeFlavorDishes(3, "salty", "b"),
  ...makeFlavorDishes(6, "salty", "l"),
  {
    id: "special1",
    name: "Special Salad",
    mealTime: "Lunch",
    isSpecial: true,
    flavors: ["salty"],
    ingredientNames: ["special_ingredient"],
  },
]

export const barelySufficientLibrary: PlannerDish[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `b${i + 1}`,
    name: `Breakfast ${i + 1}`,
    mealTime: "Breakfast" as const,
    isSpecial: false,
    flavors: [`sweet_${i}`],
    ingredientNames: [`b_ing_${i + 1}`],
  })),
  ...Array.from({ length: 29 }, (_, i) => ({
    id: `l${i + 1}`,
    name: `Lunch ${i + 1}`,
    mealTime: "Lunch" as const,
    isSpecial: i === 0,
    flavors: [`flavor_${i}`],
    ingredientNames: [`l_ing_${i + 1}`],
  })),
]

function makeNormalDishes(): PlannerDish[] {
  const breakfastFlavors = [
    ["sweet", "fruity"],
    ["savory", "creamy"],
    ["sweet", "crunchy"],
    ["savory", "smoky"],
    ["sweet", "warm"],
    ["savory", "herby"],
    ["sweet", "nutty"],
    ["savory", "spicy"],
  ]

  const breakfasts: PlannerDish[] = breakfastFlavors.map((flavors, i) => ({
    id: `nb${i + 1}`,
    name: `Normal Breakfast ${i + 1}`,
    mealTime: "Breakfast" as const,
    isSpecial: false,
    flavors,
    ingredientNames: [`nb_ing_${i + 1}_a`, `nb_ing_${i + 1}_b`],
  }))

  const lunchFlavors = [
    ["umami", "savory"],
    ["fresh", "light"],
    ["spicy", "bold"],
    ["creamy", "rich"],
    ["smoky", "hearty"],
    ["tangy", "bright"],
    ["sweet", "savory"],
    ["herby", "fresh"],
    ["umami", "bold"],
    ["savory", "warm"],
    ["spicy", "fresh"],
    ["creamy", "smoky"],
    ["tangy", "hearty"],
    ["sweet", "fruity"],
    ["herby", "bold"],
  ]

  const lunches: PlannerDish[] = lunchFlavors.map((flavors, i) => ({
    id: `nl${i + 1}`,
    name: `Normal Lunch ${i + 1}`,
    mealTime: "Lunch" as const,
    isSpecial: i === 0 || i === 5 || i === 10,
    flavors,
    ingredientNames: [`nl_ing_${i + 1}_a`, `nl_ing_${i + 1}_b`],
  }))

  return [...breakfasts, ...lunches]
}

export const normalLibrary: PlannerDish[] = makeNormalDishes()
