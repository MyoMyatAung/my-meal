import type { PlannerDish } from "./types"

export const tooSmallLibrary: PlannerDish[] = [
  {
    id: "l1",
    name: "Chicken Salad",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["fresh"],
    ingredientNames: ["chicken", "lettuce"],
    pairedDishIds: [],
  },
]

export const noMainLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Oatmeal",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["oats"],
    pairedDishIds: [],
  },
  {
    id: "l1",
    name: "Side A",
    category: "SIDE",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["salty"],
    ingredientNames: ["x"],
    pairedDishIds: [],
  },
]

export const noSideOrSoupLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Oatmeal",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["oats"],
    pairedDishIds: [],
  },
  {
    id: "l1",
    name: "Main A",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["savory"],
    ingredientNames: ["x"],
    pairedDishIds: [],
  },
]

export const noSpecialLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Oatmeal",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["oats", "milk"],
    pairedDishIds: [],
  },
  {
    id: "b2",
    name: "Scrambled Eggs",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["savory"],
    ingredientNames: ["eggs", "butter"],
    pairedDishIds: [],
  },
  {
    id: "l1",
    name: "Chicken Salad",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["fresh"],
    ingredientNames: ["chicken", "lettuce", "tomato"],
    pairedDishIds: [],
  },
  {
    id: "l2",
    name: "Pasta",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["umami"],
    ingredientNames: ["pasta", "tomato sauce"],
    pairedDishIds: [],
  },
  {
    id: "l3",
    name: "Rice Bowl",
    category: "SIDE",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["savory"],
    ingredientNames: ["rice", "vegetables"],
    pairedDishIds: [],
  },
  {
    id: "l4",
    name: "Sandwich",
    category: "SOUP",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["salty"],
    ingredientNames: ["bread", "ham", "cheese"],
    pairedDishIds: [],
  },
]

function makeFlavorDishes(
  count: number,
  flavor: string,
  prefix: string,
  categories: PlannerDish["category"][]
): PlannerDish[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${i + 1}`,
    category: categories[i % categories.length],
    mealTime: (prefix.startsWith("b") ? "Breakfast" : "Lunch") as
      | "Breakfast"
      | "Lunch",
    isSpecial: false,
    flavors: [flavor],
    ingredientNames: [`${prefix}_ing_${i + 1}`],
    pairedDishIds: [],
  }))
}

export const singleFlavorLibrary: PlannerDish[] = [
  ...makeFlavorDishes(3, "salty", "b", ["OTHER"]),
  ...makeFlavorDishes(6, "salty", "l", ["MAIN", "SIDE", "SOUP"]),
  {
    id: "special1",
    name: "Special Salad",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: true,
    flavors: ["salty"],
    ingredientNames: ["special_ingredient"],
    pairedDishIds: [],
  },
]

export const barelySufficientLibrary: PlannerDish[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `b${i + 1}`,
    name: `Breakfast ${i + 1}`,
    category: "OTHER" as const,
    mealTime: "Breakfast" as const,
    isSpecial: false,
    flavors: [`sweet_${i}`],
    ingredientNames: [`b_ing_${i + 1}`],
    pairedDishIds: [],
  })),
  ...Array.from({ length: 29 }, (_, i) => ({
    id: `l${i + 1}`,
    name: `Lunch ${i + 1}`,
    category: (["MAIN", "SIDE", "SOUP"] as const)[i % 3],
    mealTime: "Lunch" as const,
    isSpecial: i === 0,
    flavors: [`flavor_${i}`],
    ingredientNames: [`l_ing_${i + 1}`],
    pairedDishIds: [],
  })),
]

export const unpairedMainLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Toast",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["bread"],
    pairedDishIds: [],
  },
  {
    id: "m1",
    name: "Main One",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["umami"],
    ingredientNames: ["m1_ing"],
    pairedDishIds: [],
  },
  {
    id: "m2",
    name: "Main Two",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["spicy"],
    ingredientNames: ["m2_ing"],
    pairedDishIds: [],
  },
  {
    id: "s1",
    name: "Side One",
    category: "SIDE",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["fresh"],
    ingredientNames: ["s1_ing"],
    pairedDishIds: [],
  },
  {
    id: "s2",
    name: "Soup One",
    category: "SOUP",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["savory"],
    ingredientNames: ["s2_ing"],
    pairedDishIds: [],
  },
]

/**
 * A single Main paired to a bank of same-flavor and different-flavor
 * Side/Soup dishes — exercises both branches of the same-flavor roll,
 * with enough supply that the weekly no-repeat window never has to force
 * a relaxation, keeping the observed collision rate close to the true
 * MAIN_SIDE_SAME_FLAVOR_PROBABILITY.
 */
function makePairedMixedFlavorLibrary(): PlannerDish[] {
  const main: PlannerDish = {
    id: "m1",
    name: "Main One",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["umami"],
    ingredientNames: ["m1_ing"],
    pairedDishIds: [],
  }

  const sameFlavorSides: PlannerDish[] = Array.from({ length: 20 }, (_, i) => ({
    id: `sf${i + 1}`,
    name: `Same Flavor Side ${i + 1}`,
    category: i % 2 === 0 ? "SIDE" : "SOUP",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["umami"],
    ingredientNames: [`sf${i + 1}_ing`],
    pairedDishIds: [main.id],
  }))

  const diffFlavorSides: PlannerDish[] = Array.from({ length: 20 }, (_, i) => ({
    id: `df${i + 1}`,
    name: `Different Flavor Side ${i + 1}`,
    category: i % 2 === 0 ? "SIDE" : "SOUP",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["fresh"],
    ingredientNames: [`df${i + 1}_ing`],
    pairedDishIds: [main.id],
  }))

  main.pairedDishIds = [
    ...sameFlavorSides.map((d) => d.id),
    ...diffFlavorSides.map((d) => d.id),
  ]

  const breakfast: PlannerDish = {
    id: "b1",
    name: "Toast",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["bread"],
    pairedDishIds: [],
  }

  return [breakfast, main, ...sameFlavorSides, ...diffFlavorSides]
}

export const pairedMixedFlavorLibrary: PlannerDish[] = makePairedMixedFlavorLibrary()

/**
 * A Main + Side pairing that always collides on flavor, plus a
 * Snack/Accompaniment/Other dish paired to BOTH of them and flavor-clean
 * against both — exercises the intersection-based compensatory pick
 * deterministically.
 */
export const triplePairedLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Toast",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["bread"],
    pairedDishIds: [],
  },
  {
    id: "m1",
    name: "Main One",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["spicy"],
    ingredientNames: ["m1_ing"],
    pairedDishIds: ["s1", "c1"],
  },
  {
    id: "s1",
    name: "Side One",
    category: "SIDE",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["spicy"],
    ingredientNames: ["s1_ing"],
    pairedDishIds: ["m1", "c1"],
  },
  {
    id: "c1",
    name: "Compensatory One",
    category: "SNACK",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["herby"],
    ingredientNames: ["c1_ing"],
    pairedDishIds: ["m1", "s1"],
  },
]

/**
 * Same flavor-collision Main+Side setup as triplePairedLibrary, but the
 * only flavor-clean Snack/Accompaniment/Other dish is paired to just one
 * of the two (not both) — exercises the compensatory-dish
 * NO_PAIRED_DISH_FALLBACK path.
 */
export const compensatoryFallbackLibrary: PlannerDish[] = [
  {
    id: "b1",
    name: "Toast",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["bread"],
    pairedDishIds: [],
  },
  {
    id: "m1",
    name: "Main One",
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["spicy"],
    ingredientNames: ["m1_ing"],
    pairedDishIds: ["s1"],
  },
  {
    id: "s1",
    name: "Side One",
    category: "SIDE",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["spicy"],
    ingredientNames: ["s1_ing"],
    pairedDishIds: ["m1"],
  },
  {
    id: "c1",
    name: "Compensatory One",
    category: "SNACK",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: ["herby"],
    ingredientNames: ["c1_ing"],
    // Paired to neither Main nor Side — only reachable via fallback.
    pairedDishIds: [],
  },
]

/**
 * 7 Mains 1:1-paired to 7 Side/Soup dishes, all flavor-distinct — exactly
 * enough for one 7-day block without any relaxation, but would have
 * needed REPEAT_FORCED under Phase 4's old period-wide rule across 14+
 * days. Proves the no-repeat window actually resets every 7 days.
 */
function makeWeeklyRepeatLibrary(): PlannerDish[] {
  const mains: PlannerDish[] = Array.from({ length: 7 }, (_, i) => ({
    id: `wm${i + 1}`,
    name: `Weekly Main ${i + 1}`,
    category: "MAIN",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: [`main_flavor_${i}`],
    ingredientNames: [`wm${i + 1}_ing`],
    pairedDishIds: [`ws${i + 1}`],
  }))

  const sides: PlannerDish[] = Array.from({ length: 7 }, (_, i) => ({
    id: `ws${i + 1}`,
    name: `Weekly Side ${i + 1}`,
    category: i % 2 === 0 ? "SIDE" : "SOUP",
    mealTime: "Lunch",
    isSpecial: false,
    flavors: [`side_flavor_${i}`],
    ingredientNames: [`ws${i + 1}_ing`],
    pairedDishIds: [`wm${i + 1}`],
  }))

  const breakfast: PlannerDish = {
    id: "b1",
    name: "Toast",
    category: "OTHER",
    mealTime: "Breakfast",
    isSpecial: false,
    flavors: ["sweet"],
    ingredientNames: ["bread"],
    pairedDishIds: [],
  }

  return [breakfast, ...mains, ...sides]
}

export const weeklyRepeatLibrary: PlannerDish[] = makeWeeklyRepeatLibrary()

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
    category: "OTHER",
    mealTime: "Breakfast" as const,
    isSpecial: false,
    flavors,
    ingredientNames: [`nb_ing_${i + 1}_a`, `nb_ing_${i + 1}_b`],
    pairedDishIds: [],
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

  // Categories chosen so the regular (non-special) pool has ample Main and
  // Side/Soup supply: indices 0, 5, 10 are the special dishes (excluded
  // from regular generation entirely, per Phase 4's existing behavior).
  const lunchCategories: PlannerDish["category"][] = [
    "MAIN", // 0 special
    "MAIN",
    "SIDE",
    "SOUP",
    "MAIN",
    "SIDE", // 5 special
    "SOUP",
    "SNACK",
    "MAIN",
    "SIDE",
    "SOUP", // 10 special
    "ACCOMPANIMENTS",
    "MAIN",
    "SIDE",
    "OTHER",
  ]

  const lunches: PlannerDish[] = lunchFlavors.map((flavors, i) => ({
    id: `nl${i + 1}`,
    name: `Normal Lunch ${i + 1}`,
    category: lunchCategories[i],
    mealTime: "Lunch" as const,
    isSpecial: i === 0 || i === 5 || i === 10,
    flavors,
    ingredientNames: [`nl_ing_${i + 1}_a`, `nl_ing_${i + 1}_b`],
    pairedDishIds: [],
  }))

  return [...breakfasts, ...lunches]
}

export const normalLibrary: PlannerDish[] = makeNormalDishes()
