const foods = [
  ['paneer', 'Paneer', 'protein', ['veg', 'keto'], ['dairy'], '100 g', 265, 18, 6, 20, 50, 250],
  ['tofu', 'Firm tofu', 'protein', ['veg', 'vegan', 'keto'], ['soy'], '100 g', 144, 15, 3, 9, 50, 250],
  ['tempeh', 'Tempeh', 'protein', ['vegan', 'keto'], ['soy'], '100 g', 195, 20, 8, 11, 50, 200],
  ['chicken', 'Grilled chicken breast', 'protein', ['nonveg', 'keto'], [], '100 g', 165, 31, 0, 4, 50, 300],
  ['turkey', 'Roast turkey breast', 'protein', ['nonveg', 'keto'], [], '100 g', 135, 29, 0, 2, 50, 300],
  ['salmon', 'Atlantic salmon', 'protein', ['nonveg', 'keto'], ['fish'], '100 g', 208, 20, 0, 13, 50, 250],
  ['rohu', 'Rohu fish curry fillet', 'protein', ['nonveg', 'keto'], ['fish'], '100 g', 145, 21, 0, 6, 50, 250],
  ['prawns', 'Garlic prawns', 'protein', ['nonveg', 'keto'], ['shellfish'], '100 g', 99, 24, 0, 1, 50, 250],
  ['egg', 'Whole egg', 'protein', ['nonveg', 'keto'], ['eggs'], '1 egg', 72, 6, 0, 5, 1, 5],
  ['eggwhite', 'Egg whites', 'protein', ['nonveg', 'keto'], ['eggs'], '3 whites', 51, 11, 1, 0, 1, 6],
  ['idli', 'Steamed idli', 'carb', ['veg', 'vegan'], [], '1 idli', 65, 2, 13, 0, 1, 6],
  ['sambar', 'Vegetable sambar', 'protein', ['veg', 'vegan'], [], '1 katori', 120, 6, 18, 2, 0.5, 3],
  ['dosa', 'Plain dosa', 'carb', ['veg', 'vegan'], [], '1 dosa', 170, 4, 28, 5, 1, 3],
  ['moong', 'Cooked moong dal', 'protein', ['veg', 'vegan'], [], '1 katori', 170, 12, 30, 1, 1, 3],
  ['masoor', 'Cooked masoor dal', 'protein', ['veg', 'vegan'], [], '1 katori', 180, 13, 30, 1, 1, 3],
  ['chana', 'Cooked chickpeas', 'protein', ['veg', 'vegan'], [], '1 katori', 240, 13, 40, 4, 1, 3],
  ['rajma', 'Cooked rajma', 'protein', ['veg', 'vegan'], [], '1 katori', 225, 14, 39, 1, 1, 3],
  ['blackbeans', 'Black beans', 'protein', ['vegan', 'veg'], [], '1 katori', 225, 15, 41, 1, 1, 3],
  ['edamame', 'Shelled edamame', 'protein', ['vegan', 'keto'], ['soy'], '100 g', 121, 12, 9, 5, 50, 250],
  ['seitan', 'Seitan strips', 'protein', ['veg', 'vegan'], ['gluten'], '100 g', 141, 25, 12, 2, 50, 200],
  ['soya', 'Soya chunks', 'protein', ['veg', 'vegan'], ['soy'], '50 g', 172, 26, 16, 1, 25, 150],
  ['greekyogurt', 'Greek yogurt', 'protein', ['veg', 'keto'], ['dairy'], '150 g', 120, 15, 6, 3, 50, 300],
  ['hungcurd', 'Hung curd', 'protein', ['veg', 'keto'], ['dairy'], '150 g', 145, 14, 8, 5, 50, 300],
  ['whey', 'Whey protein', 'protein', ['veg', 'keto'], ['dairy'], '1 scoop', 120, 24, 4, 2, 0.5, 2],
  ['rice', 'Steamed basmati rice', 'carb', ['veg', 'nonveg', 'vegan'], [], '1 cup', 205, 4, 45, 0, 0.5, 2],
  ['brownrice', 'Brown rice', 'carb', ['veg', 'nonveg', 'vegan'], [], '1 cup', 215, 5, 45, 2, 0.5, 2],
  ['quinoa', 'Cooked quinoa', 'carb', ['veg', 'nonveg', 'vegan', 'keto'], [], '1 cup', 222, 8, 39, 4, 0.5, 2],
  ['oats', 'Rolled oats', 'carb', ['veg', 'vegan'], ['gluten'], '50 g', 190, 7, 34, 4, 0.5, 3],
  ['poha', 'Vegetable poha', 'carb', ['veg', 'vegan'], [], '1 bowl', 240, 5, 42, 6, 0.5, 3],
  ['upma', 'Rava vegetable upma', 'carb', ['veg'], ['gluten'], '1 bowl', 250, 7, 40, 7, 0.5, 3],
  ['millet', 'Cooked millet', 'carb', ['veg', 'vegan'], [], '1 cup', 207, 6, 41, 2, 0.5, 2],
  ['jowar', 'Jowar roti', 'carb', ['veg', 'vegan'], [], '1 roti', 120, 4, 24, 1, 1, 4],
  ['bajra', 'Bajra roti', 'carb', ['veg', 'vegan'], [], '1 roti', 130, 4, 25, 2, 1, 4],
  ['chapati', 'Whole wheat chapati', 'carb', ['veg', 'nonveg', 'vegan'], ['gluten'], '1 roti', 110, 4, 20, 2, 1, 4],
  ['sourdough', 'Sourdough toast', 'carb', ['veg', 'vegan'], ['gluten'], '1 slice', 90, 4, 17, 1, 1, 5],
  ['sweetpotato', 'Roasted sweet potato', 'carb', ['veg', 'vegan'], [], '150 g', 135, 3, 31, 0, 50, 300],
  ['potato', 'Boiled potato', 'carb', ['veg', 'vegan'], [], '150 g', 116, 3, 26, 0, 50, 300],
  ['corn', 'Sweet corn', 'carb', ['veg', 'vegan'], [], '1 cup', 143, 5, 31, 2, 0.5, 3],
  ['buckwheat', 'Buckwheat kasha', 'carb', ['veg', 'vegan', 'keto'], [], '1 cup', 155, 6, 33, 1, 0.5, 2],
  ['caulirice', 'Cauliflower rice', 'carb', ['veg', 'vegan', 'keto'], [], '1 cup', 25, 2, 5, 0, 1, 4],
  ['zucchini', 'Zucchini noodles', 'carb', ['veg', 'vegan', 'keto'], [], '1 bowl', 35, 2, 6, 1, 1, 4],
  ['spinach', 'Baby spinach', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 7, 1, 1, 0, 1, 6],
  ['broccoli', 'Steamed broccoli', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 55, 4, 11, 1, 1, 5],
  ['beans', 'French beans', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 44, 2, 10, 0, 1, 5],
  ['capsicum', 'Bell peppers', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 39, 1, 9, 0, 1, 5],
  ['mushroom', 'Button mushrooms', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 22, 3, 3, 0, 1, 5],
  ['cauliflower', 'Roasted cauliflower', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 45, 3, 9, 1, 1, 5],
  ['carrot', 'Carrot salad', 'veg', ['veg', 'vegan'], [], '1 cup', 50, 1, 12, 0, 1, 5],
  ['cucumber', 'Cucumber salad', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 16, 1, 4, 0, 1, 6],
  ['tomato', 'Tomato kachumber', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 32, 2, 7, 0, 1, 5],
  ['kale', 'Kale salad', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 33, 3, 6, 1, 1, 5],
  ['okra', 'Bhindi masala', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 80, 4, 11, 3, 1, 4],
  ['eggplant', 'Baingan bharta', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 85, 2, 15, 3, 1, 4],
  ['peas', 'Green peas', 'veg', ['veg', 'vegan'], [], '1 cup', 134, 9, 25, 1, 0.5, 3],
  ['cabbage', 'Cabbage stir-fry', 'veg', ['veg', 'vegan', 'keto'], [], '1 cup', 45, 2, 10, 0, 1, 5],
  ['lettuce', 'Romaine lettuce', 'veg', ['veg', 'vegan', 'keto'], [], '2 cups', 16, 1, 3, 0, 1, 6],
  ['avocado', 'Avocado', 'fat', ['veg', 'vegan', 'keto'], [], 'half fruit', 160, 2, 9, 15, 0.5, 2],
  ['oliveoil', 'Extra virgin olive oil', 'fat', ['veg', 'nonveg', 'vegan', 'keto'], [], '1 tsp', 40, 0, 0, 4.5, 1, 6],
  ['ghee', 'Ghee', 'fat', ['veg', 'nonveg', 'keto'], ['dairy'], '1 tsp', 45, 0, 0, 5, 1, 6],
  ['coconut', 'Coconut flakes', 'fat', ['vegan', 'keto'], [], '20 g', 132, 1, 5, 13, 5, 60],
  ['peanutbutter', 'Peanut butter', 'fat', ['veg', 'vegan', 'keto'], ['peanuts'], '1 tbsp', 95, 4, 3, 8, 0.5, 4],
  ['almonds', 'Almonds', 'fat', ['veg', 'vegan', 'keto'], ['nuts'], '20 g', 116, 4, 4, 10, 5, 60],
  ['walnuts', 'Walnuts', 'fat', ['veg', 'vegan', 'keto'], ['nuts'], '20 g', 131, 3, 3, 13, 5, 60],
  ['pumpkinseeds', 'Pumpkin seeds', 'fat', ['veg', 'vegan', 'keto'], [], '20 g', 112, 6, 3, 9, 5, 60],
  ['chia', 'Chia seeds', 'fat', ['veg', 'vegan', 'keto'], [], '20 g', 97, 3, 8, 6, 5, 50],
  ['flax', 'Ground flaxseed', 'fat', ['veg', 'vegan', 'keto'], [], '15 g', 80, 3, 4, 6, 5, 50],
  ['tahini', 'Tahini', 'fat', ['veg', 'vegan', 'keto'], ['sesame'], '1 tbsp', 89, 3, 3, 8, 0.5, 4],
  ['banana', 'Banana', 'fruit', ['veg', 'vegan'], [], '1 small', 90, 1, 23, 0, 0.5, 3],
  ['apple', 'Apple', 'fruit', ['veg', 'vegan', 'keto'], [], '1 medium', 95, 0, 25, 0, 0.5, 2],
  ['orange', 'Orange', 'fruit', ['veg', 'vegan', 'keto'], [], '1 medium', 62, 1, 15, 0, 0.5, 3],
  ['berries', 'Mixed berries', 'fruit', ['veg', 'vegan', 'keto'], [], '1 cup', 70, 1, 17, 0, 0.5, 3],
  ['mango', 'Mango', 'fruit', ['veg', 'vegan'], [], '1 cup', 100, 1, 25, 1, 0.5, 2],
  ['papaya', 'Papaya', 'fruit', ['veg', 'vegan', 'keto'], [], '1 cup', 55, 1, 14, 0, 0.5, 3],
  ['guava', 'Guava', 'fruit', ['veg', 'vegan', 'keto'], [], '1 medium', 68, 3, 14, 1, 0.5, 3],
  ['kiwi', 'Kiwi', 'fruit', ['veg', 'vegan', 'keto'], [], '2 fruits', 84, 2, 20, 1, 0.5, 3],
  ['makhana', 'Roasted makhana', 'snack', ['veg', 'vegan', 'keto'], [], '30 g', 105, 3, 20, 1, 5, 90],
  ['roastedchana', 'Roasted chana', 'snack', ['veg', 'vegan'], [], '30 g', 120, 6, 18, 2, 5, 90],
  ['hummus', 'Hummus', 'snack', ['veg', 'vegan', 'keto'], ['sesame'], '3 tbsp', 100, 4, 9, 6, 1, 6],
  ['ricecakes', 'Rice cakes', 'snack', ['veg', 'vegan'], [], '2 cakes', 70, 1, 15, 0, 1, 6],
  ['darkchocolate', 'Dark chocolate 80%', 'snack', ['veg', 'vegan', 'keto'], ['dairy'], '15 g', 90, 1, 6, 7, 5, 45],
  ['coconutwater', 'Tender coconut water', 'snack', ['veg', 'vegan', 'keto'], [], '1 glass', 45, 0, 11, 0, 1, 4],
  ['trailmix', 'Seed trail mix', 'snack', ['veg', 'vegan', 'keto'], [], '25 g', 140, 5, 6, 11, 5, 75],
  ['lassi', 'Unsweetened lassi', 'dairy', ['veg', 'keto'], ['dairy'], '1 glass', 100, 7, 8, 4, 1, 4],
  ['milk', 'Low-fat milk', 'dairy', ['veg', 'keto'], ['dairy'], '1 glass', 110, 8, 12, 3, 1, 4],
  ['soyMilk', 'Unsweetened soy milk', 'dairy', ['vegan', 'keto'], ['soy'], '1 glass', 80, 7, 4, 4, 1, 4],
  ['coconutMilk', 'Unsweetened coconut milk', 'dairy', ['vegan', 'keto'], [], '1 glass', 45, 0, 2, 4, 1, 4],
  ['cheese', 'Cheddar cheese', 'dairy', ['veg', 'keto'], ['dairy'], '30 g', 120, 7, 1, 10, 5, 90],
  ['feta', 'Feta cheese', 'dairy', ['veg', 'keto'], ['dairy'], '30 g', 80, 4, 1, 6, 5, 90],
  ['parmesan', 'Parmesan', 'dairy', ['veg', 'keto'], ['dairy'], '20 g', 86, 8, 1, 6, 5, 60],
  ['nutritionalyeast', 'Nutritional yeast', 'dairy', ['vegan', 'keto'], [], '15 g', 55, 8, 5, 1, 5, 45]
];

const supplementIds = new Set(['whey', 'nutritionalyeast']);
const beverageIds = new Set(['lassi', 'milk', 'soyMilk', 'coconutMilk', 'coconutwater']);
const sideIds = new Set(['greekyogurt', 'hungcurd', 'cheese', 'feta', 'parmesan', 'hummus', 'roastedchana', 'makhana', 'trailmix', 'ricecakes', 'darkchocolate']);
const fatIds = new Set(['avocado', 'oliveoil', 'ghee', 'coconut', 'peanutbutter', 'almonds', 'walnuts', 'pumpkinseeds', 'chia', 'flax', 'tahini']);
const fruitIds = new Set(['banana', 'apple', 'orange', 'berries', 'mango', 'papaya', 'guava', 'kiwi']);
const internationalIds = new Set(['tofu', 'tempeh', 'chicken', 'turkey', 'salmon', 'prawns', 'blackbeans', 'edamame', 'seitan', 'greekyogurt', 'quinoa', 'oats', 'sourdough', 'zucchini', 'kale', 'lettuce', 'avocado', 'hummus', 'ricecakes', 'darkchocolate', 'soyMilk', 'coconutMilk', 'nutritionalyeast']);
const southIndianIds = new Set(['moong', 'poha', 'upma', 'idli', 'coconut', 'sambar', 'dosa']);

function metadataFor(id, category) {
  const role = supplementIds.has(id)
    ? 'supplement'
    : beverageIds.has(id)
      ? 'beverage'
      : sideIds.has(id)
        ? 'side'
        : fatIds.has(id)
          ? 'fat_topping'
          : fruitIds.has(id)
            ? 'fruit'
            : category === 'protein'
              ? 'main_protein'
              : category === 'carb'
                ? 'staple'
                : category === 'veg'
                  ? 'vegetable'
                  : category === 'fruit'
                    ? 'fruit'
                    : 'side';
  const mealSlots = role === 'main_protein'
    ? ['Breakfast', 'Lunch', 'Dinner']
    : role === 'staple'
      ? (['poha', 'upma', 'oats', 'sourdough'].includes(id) ? ['Breakfast'] : ['Breakfast', 'Lunch', 'Dinner'])
      : role === 'vegetable'
        ? ['Breakfast', 'Lunch', 'Dinner']
        : role === 'fat_topping'
          ? ['Breakfast', 'Lunch', 'Dinner', 'Snack']
          : role === 'fruit' || role === 'beverage'
            ? ['Breakfast', 'Snack']
            : role === 'supplement'
              ? ['Snack']
              : ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const cuisine = internationalIds.has(id)
    ? ['international']
    : southIndianIds.has(id)
      ? ['south-indian', 'north-indian']
      : ['north-indian', 'south-indian'];
  return { role, mealSlots, cuisine };
}

export const foodDatabase = foods.map(([id, name, category, diets, allergens, unit, kcal, proteinG, carbsG, fatG, minQty, maxQty]) => ({
  id, name, category, ...metadataFor(id, category), diets, allergens, unit, kcal, proteinG, carbsG, fatG, minQty, maxQty
}));

export default foodDatabase;
