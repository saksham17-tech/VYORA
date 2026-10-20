import { foodDatabase } from './foodDatabase.js';

const foodsById = new Map(foodDatabase.map(food => [food.id, food]));

function component(foodId, baseQty = 1, unit) {
  const food = foodsById.get(foodId);
  if (!food) throw new Error(`Dish library references unknown food: ${foodId}`);
  return {
    foodId,
    baseQty,
    unit: unit || food.unit,
    kcal: Math.round(food.kcal * baseQty),
    proteinG: Number((food.proteinG * baseQty).toFixed(1)),
    carbsG: Number((food.carbsG * baseQty).toFixed(1)),
    fatG: Number((food.fatG * baseQty).toFixed(1))
  };
}

function dish(id, name, slots, diets, allergens, cuisine, mainProtein, entries, options = {}) {
  const components = entries.map(entry => component(entry[0], entry[1], entry[2]));
  const fixedUnits = components.some(item => /egg|roti|slice|fruit|cake/i.test(item.unit));
  const componentIds = new Set(components.map(item => item.foodId));
  const slot = slots[0];
  const curatedAddOns = options.addOns || (
    slot === 'Breakfast'
      ? (diets.includes('vegan')
        ? [['berries', 0.5], ['banana', 0.5], ['pumpkinseeds', 0.25]]
        : [['berries', 0.5], ['hungcurd', 0.5], ['walnuts', 0.25]])
      : slot === 'Snack'
        ? (diets.includes('vegan')
          ? [['berries', 0.5], ['banana', 0.5], ['pumpkinseeds', 0.25]]
          : [['berries', 0.5], ['guava', 0.5], ['walnuts', 0.25]])
        : /rice|pulao|quinoa|millet|roti|roti|dal|curry|rajma|chole|khichdi/i.test(name)
          ? (diets.includes('vegan')
            ? [['tomato', 0.5], ['avocado', 0.5], ['cucumber', 0.5]]
            : [['hungcurd', 0.5], ['tomato', 0.5], ['cucumber', 0.5], ['ghee', 3]])
          : [['cucumber', 0.5], ['tomato', 0.5]]
  ).filter(([foodId]) => !componentIds.has(foodId));
  const fruitIds = new Set(['banana', 'apple', 'orange', 'berries', 'mango', 'papaya', 'guava', 'kiwi']);
  const filteredAddOns = curatedAddOns.filter(([foodId]) =>
    !componentIds.has(foodId) && (slot === 'Breakfast' || slot === 'Snack' || !fruitIds.has(foodId)));
  if (!filteredAddOns.length) {
    const fallbackIds = slot === 'Breakfast' || slot === 'Snack'
      ? ['berries', 'banana', 'pumpkinseeds']
      : (diets.includes('vegan') ? ['avocado', 'roastedchana', 'pumpkinseeds'] : ['hungcurd', 'avocado', 'roastedchana']);
    for (const foodId of fallbackIds) {
      if (!componentIds.has(foodId) && (!diets.includes('vegan') || !['hungcurd', 'cheese'].includes(foodId))) {
        filteredAddOns.push([foodId, foodId === 'chapati' ? 1 : 0.5]);
        break;
      }
    }
  }
  const staple = options.staple || (
    ['rice', 'brownrice', 'quinoa', 'millet', 'jowar', 'bajra', 'chapati', 'sourdough',
      'poha', 'upma', 'dosa', 'idli', 'caulirice', 'zucchini'].find(id => componentIds.has(id)) || null
  );
  const veg = options.veg || (
    ['spinach', 'broccoli', 'mushroom', 'cucumber', 'tomato', 'capsicum', 'okra', 'beans',
      'cauliflower', 'zucchini', 'kale', 'eggplant', 'peas', 'cabbage'].find(id => componentIds.has(id)) || null
  );
  return {
    id,
    name,
    slots,
    diets,
    allergens,
    cuisine,
    mainProtein,
    staple,
    veg,
    components,
    scaleMin: options.scaleMin ?? (fixedUnits ? 0.9 : 0.75),
    scaleMax: options.scaleMax ?? (fixedUnits ? 1.1 : 1.75),
    addOns: (filteredAddOns.length > 3
      ? [...filteredAddOns.slice(0, 2), filteredAddOns[filteredAddOns.length - 1]]
      : filteredAddOns)
      .filter(([foodId]) => foodId !== 'fruit')
      .map(([foodId, baseQty, unit]) => component(foodId, baseQty, unit)),
    prepNotes: options.prepNotes || `Prepare ${name.toLowerCase()} with measured portions and serve fresh.`
  };
}

const breakfast = [
  ['veg-poha-curd', 'Vegetable Poha with Peanuts & Curd', ['veg'], ['peanuts', 'dairy'], 'south-indian', 'poha', [['poha', 1], ['peanutbutter', 0.5], ['hungcurd', 0.5]]],
  ['veg-moong-chilla', 'Moong Dal Chilla with Mint Curd', ['veg', 'vegan'], ['dairy'], 'north-indian', 'moong', [['moong', 1], ['hungcurd', 0.5]]],
  ['veg-paneer-paratha', 'Paneer Stuffed Paratha with Curd', ['veg'], ['dairy', 'gluten'], 'north-indian', 'paneer', [['chapati', 2], ['paneer', 0.75], ['hungcurd', 0.5]]],
  ['veg-upma-curd', 'Vegetable Upma with Curd', ['veg'], ['gluten', 'dairy'], 'south-indian', 'upma', [['upma', 1], ['hungcurd', 0.5]]],
  ['veg-idli-sambar', 'Idli with Sambar', ['veg', 'vegan'], [], 'south-indian', null, [['idli', 2], ['sambar', 1]]],
  ['veg-oats-yogurt', 'Savory Oats with Greek Yogurt', ['veg'], ['gluten', 'dairy'], 'international', 'oats', [['oats', 1], ['greekyogurt', 0.75], ['spinach', 1]]],
  ['veg-besan-chilla', 'Besan Chilla with Tomato Chutney', ['veg', 'vegan'], [], 'north-indian', 'chana', [['chana', 1], ['tomato', 1]]],
  ['veg-millet-upma', 'Millet Breakfast Bowl with Coconut', ['veg', 'vegan'], [], 'south-indian', 'millet', [['millet', 1], ['coconut', 0.5]]],
  ['veg-dosa-sambar', 'Masala Dosa with Sambar', ['veg', 'vegan'], [], 'south-indian', null, [['dosa', 1], ['sambar', 1]]],
  ['veg-quinoa-bowl', 'Quinoa Breakfast Bowl with Berries', ['veg', 'vegan'], [], 'international', 'quinoa', [['quinoa', 1], ['berries', 1], ['pumpkinseeds', 0.5]]],
  ['vegan-tofu-scramble', 'Tofu Scramble with Millet Toast', ['vegan'], ['soy'], 'international', 'tofu', [['tofu', 1], ['millet', 0.75], ['capsicum', 1]]],
  ['vegan-chickpea-chilla', 'Chickpea Chilla with Tomato Salsa', ['vegan', 'veg'], [], 'north-indian', 'chana', [['chana', 1], ['tomato', 1], ['avocado', 0.5]]],
  ['vegan-poha-sprouts', 'Sprouted Moong Poha', ['vegan', 'veg'], [], 'south-indian', 'moong', [['poha', 1], ['moong', 0.75], ['cucumber', 1]]],
  ['vegan-oats-soy', 'Overnight Oats with Soy Milk & Berries', ['vegan'], ['gluten', 'soy'], 'international', 'oats', [['oats', 1], ['soyMilk', 1], ['berries', 1]]],
  ['vegan-sweet-potato-chana', 'Sweet Potato Chana Breakfast Bowl', ['vegan', 'veg'], [], 'north-indian', 'chana', [['sweetpotato', 1], ['chana', 1], ['spinach', 1]]],
  ['nonveg-egg-toast', 'Egg Bhurji with Sourdough Toast', ['nonveg'], ['eggs', 'gluten'], 'north-indian', 'egg', [['egg', 3], ['sourdough', 2], ['tomato', 1]]],
  ['nonveg-egg-poha', 'Egg Bhurji with Vegetable Poha', ['nonveg'], ['eggs'], 'south-indian', 'egg', [['egg', 3], ['poha', 1]]],
  ['nonveg-chicken-toast', 'Chicken Keema Toast', ['nonveg'], ['gluten'], 'international', 'chicken', [['chicken', 1], ['sourdough', 2], ['capsicum', 1]]],
  ['nonveg-salmon-toast', 'Smoked Salmon Toast with Cucumber', ['nonveg'], ['fish', 'gluten'], 'international', 'salmon', [['salmon', 1], ['sourdough', 2], ['cucumber', 1]]],
  ['nonveg-egg-vegetable', 'Egg Vegetable Breakfast Bowl', ['nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['potato', 1], ['spinach', 1]]],
  ['keto-egg-spinach', 'Spinach Mushroom Omelette', ['keto'], ['eggs'], 'international', 'egg', [['egg', 3], ['spinach', 1], ['mushroom', 1], ['ghee', 1]]],
  ['keto-paneer-bhurji', 'Paneer Bhurji with Sautéed Greens', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1], ['spinach', 1], ['mushroom', 1], ['ghee', 1]]],
  ['keto-tofu-avocado', 'Tofu Avocado Breakfast Plate', ['keto', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 1], ['avocado', 0.5], ['spinach', 1]]],
  ['keto-salmon-avocado', 'Salmon Avocado Breakfast Plate', ['keto', 'nonveg'], ['fish'], 'international', 'salmon', [['salmon', 1], ['avocado', 0.5], ['cucumber', 1]]]
];

const lunch = [
  ['veg-rajma-rice', 'Rajma Chawal with Cucumber Raita', ['veg', 'vegan'], ['dairy'], 'north-indian', 'rajma', [['rajma', 1], ['rice', 1], ['cucumber', 1], ['hungcurd', 0.5]]],
  ['veg-chole-roti', 'Chole with 2 Rotis and Kachumber', ['veg', 'vegan'], ['gluten'], 'north-indian', 'chana', [['chana', 1], ['chapati', 2], ['tomato', 1], ['cucumber', 1]]],
  ['veg-dal-rice', 'Dal Tadka with Basmati Rice & Salad', ['veg', 'vegan'], [], 'north-indian', 'masoor', [['masoor', 1], ['rice', 1], ['cucumber', 1]]],
  ['veg-paneer-roti', 'Paneer Bhurji with 2 Rotis', ['veg'], ['dairy', 'gluten'], 'north-indian', 'paneer', [['paneer', 1], ['chapati', 2], ['capsicum', 1]]],
  ['veg-palak-paneer', 'Palak Paneer with Jeera Rice', ['veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1], ['spinach', 1], ['rice', 1]]],
  ['veg-khichdi-curd', 'Moong Dal Khichdi with Curd', ['veg'], ['dairy'], 'north-indian', 'moong', [['moong', 1], ['rice', 1], ['hungcurd', 0.75]]],
  ['veg-tofu-rice', 'Tofu Tikka with Brown Rice', ['veg', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 1], ['brownrice', 1], ['broccoli', 1]]],
  ['veg-soya-roti', 'Soya Chunk Curry with Jowar Rotis', ['veg', 'vegan'], ['gluten'], 'north-indian', 'soya', [['soya', 1], ['jowar', 2], ['cucumber', 1]]],
  ['veg-millet-dal', 'Dal with Foxtail Millet and Bhindi', ['veg', 'vegan'], [], 'north-indian', 'moong', [['moong', 1], ['millet', 1], ['okra', 1]]],
  ['veg-chana-quinoa', 'Chana Masala with Quinoa Salad', ['veg', 'vegan'], [], 'international', 'chana', [['chana', 1], ['quinoa', 1], ['tomato', 1]]],
  ['veg-blackbean-bowl', 'Black Bean Rice Bowl with Salsa', ['veg', 'vegan'], [], 'international', 'blackbeans', [['blackbeans', 1], ['brownrice', 1], ['tomato', 1], ['avocado', 0.5]]],
  ['veg-paneer-millet', 'Paneer Tikka with Millet & Greens', ['veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1], ['millet', 1], ['spinach', 1]]],
  ['veg-dal-roti', 'Masoor Dal with 2 Rotis and Salad', ['veg', 'vegan'], ['gluten'], 'north-indian', 'masoor', [['masoor', 1], ['chapati', 2], ['cucumber', 1]]],
  ['veg-mushroom-quinoa', 'Mushroom Quinoa Pilaf with Raita', ['veg'], ['dairy'], 'international', 'quinoa', [['quinoa', 1], ['mushroom', 1], ['hungcurd', 0.5]]],
  ['veg-peas-pulao', 'Peas Pulao with Cucumber Raita', ['veg'], ['dairy'], 'north-indian', 'peas', [['peas', 1], ['rice', 1], ['cucumber', 1], ['hungcurd', 0.5]]],
  ['vegan-tofu-roti', 'Tofu Bhurji with Jowar Rotis', ['vegan'], ['soy'], 'north-indian', 'tofu', [['tofu', 1], ['jowar', 2], ['capsicum', 1]]],
  ['vegan-rajma-millet', 'Rajma with Millet and Tomato Salad', ['vegan'], [], 'north-indian', 'rajma', [['rajma', 1], ['millet', 1], ['tomato', 1]]],
  ['vegan-chana-roti', 'Chana Masala with Bajra Rotis', ['vegan'], [], 'north-indian', 'chana', [['chana', 1], ['bajra', 2], ['cucumber', 1]]],
  ['vegan-dal-quinoa', 'Lentil Quinoa Bowl with Greens', ['vegan'], [], 'international', 'masoor', [['masoor', 1], ['quinoa', 1], ['spinach', 1]]],
  ['vegan-tempeh-rice', 'Tempeh Stir-Fry with Brown Rice', ['vegan'], ['soy'], 'international', 'tempeh', [['tempeh', 1], ['brownrice', 1], ['broccoli', 1]]],
  ['vegan-edamame-bowl', 'Edamame Quinoa Bowl with Avocado', ['vegan'], ['soy'], 'international', 'edamame', [['edamame', 1], ['quinoa', 1], ['avocado', 0.5]]],
  ['vegan-blackbean-tacos', 'Black Bean Tacos with Tomato Salsa', ['vegan'], ['gluten'], 'international', 'blackbeans', [['blackbeans', 1], ['chapati', 2], ['tomato', 1]]],
  ['vegan-seitan-roti', 'Seitan Curry with 2 Rotis', ['vegan'], ['gluten'], 'north-indian', 'seitan', [['seitan', 1], ['jowar', 2], ['cucumber', 1]]],
  ['vegan-sweetpotato-beans', 'Sweet Potato and Black Bean Bowl', ['vegan'], [], 'international', 'blackbeans', [['sweetpotato', 1], ['blackbeans', 1], ['lettuce', 1]]],
  ['nonveg-chicken-rice', 'Tandoori Chicken with Brown Rice & Salad', ['nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.5], ['brownrice', 1], ['cucumber', 1]]],
  ['nonveg-chicken-roti', 'Chicken Curry with 2 Rotis', ['nonveg'], ['gluten'], 'north-indian', 'chicken', [['chicken', 1.5], ['chapati', 2], ['tomato', 1]]],
  ['nonveg-fish-rice', 'Rohu Fish Curry with Steamed Rice', ['nonveg'], ['fish'], 'north-indian', 'rohu', [['rohu', 1.5], ['rice', 1], ['cucumber', 1]]],
  ['nonveg-salmon-quinoa', 'Salmon with Quinoa and Broccoli', ['nonveg'], ['fish'], 'international', 'salmon', [['salmon', 1.25], ['quinoa', 1], ['broccoli', 1]]],
  ['nonveg-prawn-rice', 'Garlic Prawns with Rice and Salad', ['nonveg'], ['shellfish'], 'international', 'prawns', [['prawns', 2], ['rice', 1], ['cucumber', 1]]],
  ['nonveg-turkey-roti', 'Roast Turkey with 2 Rotis and Beans', ['nonveg'], ['gluten'], 'international', 'turkey', [['turkey', 1.5], ['chapati', 2], ['beans', 1]]],
  ['nonveg-egg-curry', 'Egg Curry with Jeera Rice', ['nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['rice', 1], ['tomato', 1]]],
  ['keto-paneer-bowl', 'Paneer Tikka with Spinach and Avocado', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1.5], ['spinach', 1], ['avocado', 0.5]]],
  ['keto-tofu-bowl', 'Tofu Stir-Fry with Broccoli and Sesame', ['keto', 'vegan'], ['soy', 'sesame'], 'international', 'tofu', [['tofu', 1.5], ['broccoli', 1], ['tahini', 0.5]]],
  ['keto-chicken-greens', 'Grilled Chicken with Sautéed Greens', ['keto', 'nonveg'], [], 'international', 'chicken', [['chicken', 1.5], ['spinach', 1], ['mushroom', 1], ['oliveoil', 1]]],
  ['keto-salmon-broccoli', 'Salmon with Broccoli and Lemon', ['keto', 'nonveg'], ['fish'], 'international', 'salmon', [['salmon', 1.25], ['broccoli', 1], ['avocado', 0.5]]],
  ['keto-egg-caulirice', 'Egg Bhurji with Cauliflower Rice', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 4], ['caulirice', 1.5], ['spinach', 1]]],
  ['keto-tempeh-zoodles', 'Tempeh with Zucchini Noodles', ['keto', 'vegan'], ['soy'], 'international', 'tempeh', [['tempeh', 1.5], ['zucchini', 1.5], ['oliveoil', 1]]],
  ['keto-egg-paneer', 'Egg and Paneer Pepper Masala', ['keto', 'veg'], ['eggs', 'dairy'], 'north-indian', 'paneer', [['egg', 2], ['paneer', 1], ['capsicum', 1]]]
];

const dinner = [
  ['veg-paneer-bhurji', 'Paneer Bhurji with 2 Rotis', ['veg'], ['dairy', 'gluten'], 'north-indian', 'paneer', [['paneer', 1], ['chapati', 2], ['capsicum', 1]]],
  ['veg-dal-palak', 'Dal Palak with Jowar Roti', ['veg', 'vegan'], ['gluten'], 'north-indian', 'moong', [['moong', 1], ['spinach', 1], ['jowar', 1]]],
  ['veg-chole-rice', 'Chole with Brown Rice and Salad', ['veg', 'vegan'], [], 'north-indian', 'chana', [['chana', 1], ['brownrice', 1], ['cucumber', 1]]],
  ['veg-rajma-roti', 'Rajma with 2 Rotis and Kachumber', ['veg', 'vegan'], ['gluten'], 'north-indian', 'rajma', [['rajma', 1], ['chapati', 2], ['tomato', 1]]],
  ['veg-tofu-curry', 'Tofu Curry with Millet and Greens', ['veg', 'vegan'], ['soy'], 'north-indian', 'tofu', [['tofu', 1], ['millet', 1], ['spinach', 1]]],
  ['veg-khichdi', 'Vegetable Khichdi with Curd', ['veg'], ['dairy'], 'north-indian', 'moong', [['moong', 1], ['rice', 1], ['hungcurd', 0.75]]],
  ['veg-paneer-quinoa', 'Paneer Quinoa Bowl with Roasted Vegetables', ['veg'], ['dairy'], 'international', 'paneer', [['paneer', 1], ['quinoa', 1], ['cauliflower', 1]]],
  ['veg-mushroom-roti', 'Mushroom Masala with 2 Rotis', ['veg', 'vegan'], ['gluten'], 'north-indian', 'mushroom', [['mushroom', 2], ['chapati', 2], ['beans', 1]]],
  ['veg-palak-tofu', 'Palak Tofu with Brown Rice', ['veg', 'vegan'], ['soy'], 'north-indian', 'tofu', [['tofu', 1], ['brownrice', 1], ['spinach', 1]]],
  ['veg-peas-pulao-dinner', 'Peas Pulao with Raita', ['veg'], ['dairy'], 'north-indian', 'peas', [['peas', 1], ['rice', 1], ['hungcurd', 0.5]]],
  ['veg-chana-salad', 'Warm Chana Salad with Millet', ['veg', 'vegan'], [], 'international', 'chana', [['chana', 1], ['millet', 1], ['lettuce', 1]]],
  ['veg-blackbean-tacos', 'Black Bean Tacos with Avocado Salsa', ['veg', 'vegan'], ['gluten'], 'international', 'blackbeans', [['blackbeans', 1], ['chapati', 2], ['avocado', 0.5]]],
  ['veg-seitan-stirfry', 'Seitan Stir-Fry with Quinoa', ['veg', 'vegan'], ['gluten'], 'international', 'seitan', [['seitan', 1], ['quinoa', 1], ['broccoli', 1]]],
  ['veg-dal-dosa', 'Dal Dosa with Coconut Chutney', ['veg', 'vegan'], [], 'south-indian', 'moong', [['dosa', 1], ['moong', 1], ['coconut', 0.5]]],
  ['vegan-tofu-curry', 'Tofu Curry with Brown Rice', ['vegan'], ['soy'], 'north-indian', 'tofu', [['tofu', 1], ['brownrice', 1], ['broccoli', 1]]],
  ['vegan-rajma-quinoa', 'Rajma Quinoa Bowl with Greens', ['vegan'], [], 'international', 'rajma', [['rajma', 1], ['quinoa', 1], ['spinach', 1]]],
  ['vegan-lentil-roti', 'Lentil Curry with 2 Bajra Rotis', ['vegan'], [], 'north-indian', 'masoor', [['masoor', 1], ['bajra', 2], ['cucumber', 1]]],
  ['vegan-tempeh-bowl', 'Tempeh Bowl with Brown Rice and Broccoli', ['vegan'], ['soy'], 'international', 'tempeh', [['tempeh', 1], ['brownrice', 1], ['broccoli', 1]]],
  ['vegan-edamame-noodles', 'Edamame with Zucchini Noodles', ['vegan'], ['soy'], 'international', 'edamame', [['edamame', 1.5], ['zucchini', 1.5], ['tahini', 0.5]]],
  ['vegan-chickpea-stew', 'Chickpea Tomato Stew with Millet', ['vegan'], [], 'north-indian', 'chana', [['chana', 1], ['millet', 1], ['tomato', 1]]],
  ['vegan-blackbean-rice', 'Black Bean Rice Bowl with Cabbage Slaw', ['vegan'], [], 'international', 'blackbeans', [['blackbeans', 1], ['rice', 1], ['cabbage', 1]]],
  ['vegan-seitan-curry', 'Seitan Curry with Jowar Roti', ['vegan'], ['gluten'], 'north-indian', 'seitan', [['seitan', 1], ['jowar', 2], ['spinach', 1]]],
  ['nonveg-chicken-curry', 'Chicken Curry with 2 Rotis', ['nonveg'], ['gluten'], 'north-indian', 'chicken', [['chicken', 1.5], ['chapati', 2], ['tomato', 1]]],
  ['nonveg-chicken-quinoa', 'Chicken Tikka with Quinoa Salad', ['nonveg'], [], 'international', 'chicken', [['chicken', 1.5], ['quinoa', 1], ['cucumber', 1]]],
  ['nonveg-fish-curry', 'Rohu Fish Curry with Rice', ['nonveg'], ['fish'], 'north-indian', 'rohu', [['rohu', 1.5], ['rice', 1], ['okra', 1]]],
  ['nonveg-salmon-roti', 'Salmon Tikka with 2 Rotis', ['nonveg'], ['fish', 'gluten'], 'international', 'salmon', [['salmon', 1.25], ['chapati', 2], ['broccoli', 1]]],
  ['nonveg-prawn-quinoa', 'Garlic Prawns with Quinoa', ['nonveg'], ['shellfish'], 'international', 'prawns', [['prawns', 2], ['quinoa', 1], ['capsicum', 1]]],
  ['nonveg-turkey-rice', 'Turkey Keema with Brown Rice', ['nonveg'], [], 'international', 'turkey', [['turkey', 1.5], ['brownrice', 1], ['beans', 1]]],
  ['nonveg-egg-roti', 'Egg Curry with 2 Rotis', ['nonveg'], ['eggs', 'gluten'], 'north-indian', 'egg', [['egg', 4], ['chapati', 2], ['tomato', 1]]],
  ['nonveg-chicken-dal', 'Chicken Dal with Basmati Rice', ['nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.25], ['masoor', 1], ['rice', 1]]],
  ['keto-paneer-spinach', 'Paneer Spinach Curry with Mushrooms', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1.5], ['spinach', 1], ['mushroom', 1], ['ghee', 1]]],
  ['keto-tofu-broccoli', 'Tofu with Broccoli and Zucchini', ['keto', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 1.5], ['broccoli', 1], ['zucchini', 1], ['oliveoil', 1]]],
  ['keto-chicken-mushroom', 'Chicken with Mushroom Pepper Sauce', ['keto', 'nonveg'], [], 'international', 'chicken', [['chicken', 1.5], ['mushroom', 1.5], ['spinach', 1], ['oliveoil', 1]]],
  ['keto-salmon-zoodles', 'Salmon with Zucchini Noodles', ['keto', 'nonveg'], ['fish'], 'international', 'salmon', [['salmon', 1.25], ['zucchini', 1.5], ['avocado', 0.5]]],
  ['keto-egg-paneer-dinner', 'Egg Paneer Curry with Sautéed Greens', ['keto', 'veg'], ['eggs', 'dairy'], 'north-indian', 'paneer', [['egg', 2], ['paneer', 1], ['spinach', 1], ['ghee', 1]]]
];

const snacks = [
  ['snack-apple-peanut', 'Apple with Peanut Butter', ['veg', 'vegan'], ['peanuts'], 'international', null, [['apple', 1], ['peanutbutter', 1]]],
  ['snack-chana-guava', 'Roasted Chana with Guava', ['veg', 'vegan'], [], 'north-indian', null, [['roastedchana', 1], ['guava', 1]]],
  ['snack-makhana-lassi', 'Roasted Makhana with Chaas', ['veg'], ['dairy'], 'north-indian', null, [['makhana', 1], ['lassi', 1]]],
  ['snack-yogurt-berries', 'Greek Yogurt with Berries', ['veg'], ['dairy'], 'international', null, [['greekyogurt', 1], ['berries', 1]]],
  ['snack-paneer-fruit', 'Paneer Cubes with Papaya', ['veg'], ['dairy'], 'north-indian', null, [['paneer', 0.5], ['papaya', 1]]],
  ['snack-hummus-carrots', 'Hummus with Carrot Sticks', ['veg', 'vegan'], ['sesame'], 'international', null, [['hummus', 1], ['carrot', 1]]],
  ['snack-trailmix-orange', 'Seed Trail Mix with Orange', ['veg', 'vegan'], [], 'international', null, [['trailmix', 1], ['orange', 1]]],
  ['snack-edamame', 'Steamed Edamame with Lime', ['veg', 'vegan'], ['soy'], 'international', null, [['edamame', 1], ['cucumber', 1]]],
  ['snack-chana-coconut', 'Roasted Chana with Coconut Water', ['veg', 'vegan'], [], 'north-indian', null, [['roastedchana', 1], ['coconutwater', 1]]],
  ['snack-tofu-bites', 'Spiced Tofu Bites with Cucumber', ['vegan'], ['soy'], 'international', null, [['tofu', 0.75], ['cucumber', 1]]],
  ['snack-soymilk-banana', 'Soy Milk Banana Smoothie', ['vegan'], ['soy'], 'international', null, [['soyMilk', 1], ['banana', 1], ['chia', 0.5]]],
  ['snack-hummus-ricecakes', 'Hummus with Rice Cakes', ['vegan', 'veg'], ['sesame'], 'international', null, [['hummus', 1], ['ricecakes', 1]]],
  ['snack-avocado-tomato', 'Avocado Tomato Chaat', ['vegan', 'veg'], [], 'international', null, [['avocado', 0.5], ['tomato', 1]]],
  ['snack-coconut-berries', 'Coconut Berry Bowl', ['vegan', 'veg'], [], 'international', null, [['coconut', 0.5], ['berries', 1]]],
  ['snack-protein-shake', 'Protein Shake with Berries', ['veg', 'nonveg', 'keto'], ['dairy'], 'international', null, [['whey', 1], ['berries', 0.5]]],
  ['snack-egg-cucumber', 'Boiled Eggs with Cucumber', ['nonveg', 'keto'], ['eggs'], 'international', null, [['egg', 2], ['cucumber', 1]]],
  ['snack-chicken-bites', 'Chicken Bites with Tomato Salsa', ['nonveg', 'keto'], [], 'international', null, [['chicken', 0.75], ['tomato', 1]]],
  ['snack-salmon-cucumber', 'Salmon Cucumber Bites', ['nonveg', 'keto'], ['fish'], 'international', null, [['salmon', 0.5], ['cucumber', 1]]],
  ['snack-paneer-walnuts', 'Paneer and Walnuts', ['veg', 'keto'], ['dairy', 'nuts'], 'north-indian', null, [['paneer', 0.5], ['walnuts', 0.5]]],
  ['snack-cheese-berries', 'Cheese with Berries', ['veg', 'keto'], ['dairy'], 'international', null, [['cheese', 1], ['berries', 0.5]]],
  ['snack-avocado-egg', 'Egg and Avocado Salad', ['nonveg', 'keto'], ['eggs'], 'international', null, [['egg', 2], ['avocado', 0.5]]],
  ['snack-coconut-chia', 'Coconut Chia Pudding', ['vegan', 'keto'], [], 'international', null, [['coconutMilk', 1], ['chia', 1], ['berries', 0.5]]],
  ['snack-tofu-seeds', 'Tofu with Pumpkin Seeds', ['vegan', 'keto'], ['soy'], 'international', null, [['tofu', 0.75], ['pumpkinseeds', 0.5]]],
  ['snack-nutritional-yeast', 'Savory Nutritional Yeast Popcorn', ['vegan', 'keto'], [], 'international', null, [['nutritionalyeast', 1], ['coconut', 0.5]]]
];

const extraKeto = [
  ['keto-paneer-avocado', 'Paneer Avocado Breakfast Plate', ['keto'], ['dairy'], 'international', 'paneer', [['paneer', 1.5], ['avocado', 1], ['spinach', 1]]],
  ['keto-chicken-avocado', 'Chicken Avocado Salad', ['keto', 'nonveg'], [], 'international', 'chicken', [['chicken', 1.5], ['avocado', 1], ['cucumber', 1]]],
  ['keto-paneer-cheese', 'Paneer and Cheese Spinach Bowl', ['keto', 'veg'], ['dairy'], 'international', 'paneer', [['paneer', 1.5], ['cheese', 1], ['spinach', 1]]],
  ['keto-salmon-avocado-bowl', 'Salmon Avocado Greens Bowl', ['keto', 'nonveg'], ['fish'], 'international', 'salmon', [['salmon', 1.5], ['avocado', 1], ['cucumber', 1]]],
  ['keto-tofu-avocado-bowl', 'Tofu Avocado Greens Bowl', ['keto', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 1.5], ['avocado', 1], ['cucumber', 1]]],
  ['keto-paneer-coconut', 'Paneer with Coconut Greens', ['keto', 'veg'], ['dairy'], 'south-indian', 'paneer', [['paneer', 1.5], ['coconut', 0.5], ['spinach', 1]]],
  ['snack-cheese-avocado', 'Cheese and Avocado Bites', ['keto', 'veg'], ['dairy'], 'international', null, [['cheese', 1], ['avocado', 0.5]]],
  ['snack-chicken-avocado', 'Chicken Avocado Snack Bowl', ['keto', 'nonveg'], [], 'international', null, [['chicken', 0.75], ['avocado', 0.5]]]
];
const extraNonvegSnacks = [
  ['snack-egg-tomato', 'Egg Tomato Chaat', ['nonveg'], ['eggs'], 'north-indian', null, [['egg', 2], ['tomato', 1]]],
  ['snack-chicken-cucumber', 'Chicken Cucumber Bites', ['nonveg'], [], 'international', null, [['chicken', 0.5], ['cucumber', 1]]]
];
const extraKetoDinner = [
  ['keto-chicken-avocado-dinner', 'Chicken Avocado Dinner Bowl', ['keto', 'nonveg'], [], 'international', 'chicken', [['chicken', 1.5], ['avocado', 1], ['cucumber', 1]]],
  ['keto-salmon-avocado-dinner', 'Salmon Avocado Dinner Bowl', ['keto', 'nonveg'], ['fish'], 'international', 'salmon', [['salmon', 1.5], ['avocado', 1], ['cucumber', 1]]]
];
const extraKetoBreakfast = [
  ['keto-egg-cheese', 'Egg and Cheese Spinach Plate', ['keto', 'nonveg'], ['eggs', 'dairy'], 'international', 'egg', [['egg', 3], ['cheese', 1], ['spinach', 1]]],
  ['keto-chicken-egg', 'Chicken and Egg Breakfast Skillet', ['keto', 'nonveg'], ['eggs'], 'international', 'chicken', [['chicken', 1], ['egg', 2], ['spinach', 1]]],
  ['keto-tofu-cheese-breakfast', 'Tofu Cheese Breakfast Plate', ['keto'], ['soy', 'dairy'], 'international', 'tofu', [['tofu', 1.5], ['cheese', 1], ['spinach', 1]]]
];
const extraKetoLunch = [
  ['keto-chicken-cheese-lunch', 'Chicken Cheese Greens Bowl', ['keto', 'nonveg'], ['dairy'], 'international', 'chicken', [['chicken', 1.5], ['cheese', 1], ['cucumber', 1]]],
  ['keto-egg-avocado-lunch', 'Egg Avocado Lunch Salad', ['keto', 'nonveg'], ['eggs'], 'international', 'egg', [['egg', 3], ['avocado', 1], ['cucumber', 1]]],
  ['keto-tofu-cheese-lunch', 'Tofu Cheese Greens Bowl', ['keto'], ['soy', 'dairy'], 'international', 'tofu', [['tofu', 1.5], ['cheese', 1], ['spinach', 1]]],
  ['keto-salmon-cheese-lunch', 'Salmon Cheese Greens Bowl', ['keto', 'nonveg'], ['fish', 'dairy'], 'international', 'salmon', [['salmon', 1.5], ['cheese', 1], ['cucumber', 1]]]
];
const extraKetoDinnerTwo = [
  ['keto-chicken-cheese', 'Chicken and Cheese Greens Bowl', ['keto', 'nonveg'], ['dairy'], 'international', 'chicken', [['chicken', 1.5], ['cheese', 1], ['spinach', 1]]],
  ['keto-egg-avocado-dinner', 'Egg Avocado Dinner Salad', ['keto', 'nonveg'], ['eggs'], 'international', 'egg', [['egg', 3], ['avocado', 1], ['cucumber', 1]]],
  ['keto-tofu-cheese-dinner', 'Tofu Cheese Dinner Bowl', ['keto'], ['soy', 'dairy'], 'international', 'tofu', [['tofu', 1.5], ['cheese', 1], ['spinach', 1]]],
  ['keto-salmon-cheese-dinner', 'Salmon Cheese Dinner Bowl', ['keto', 'nonveg'], ['fish', 'dairy'], 'international', 'salmon', [['salmon', 1.5], ['cheese', 1], ['cucumber', 1]]]
];
const ketoPoolExpansion = {
  Breakfast: [
    ['keto-egg-avocado-breakfast', 'Egg Avocado Breakfast Bowl', ['keto'], ['eggs'], 'international', 'egg', [['egg', 3], ['avocado', 0.5], ['cucumber', 1]]],
    ['keto-paneer-egg-breakfast', 'Paneer and Egg Breakfast Skillet', ['keto'], ['eggs', 'dairy'], 'north-indian', 'paneer', [['paneer', 1], ['egg', 2], ['spinach', 1]]],
    ['keto-chicken-spinach-breakfast', 'Chicken Spinach Breakfast Bowl', ['keto'], [], 'international', 'chicken', [['chicken', 1], ['spinach', 1], ['avocado', 0.5]]],
    ['keto-salmon-egg-breakfast', 'Salmon Egg Breakfast Plate', ['keto'], ['fish', 'eggs'], 'international', 'salmon', [['salmon', 0.75], ['egg', 2], ['cucumber', 1]]],
    ['keto-cheese-egg-breakfast', 'Cheese Egg Breakfast Plate', ['keto'], ['eggs', 'dairy'], 'international', 'egg', [['cheese', 1], ['egg', 3], ['cucumber', 1]]]
  ],
  Lunch: [
    ['keto-paneer-cheese-lunch-2', 'Paneer and Cheese Salad Bowl', ['keto'], ['dairy'], 'international', 'paneer', [['paneer', 1.5], ['cheese', 1], ['cucumber', 1]]],
    ['keto-chicken-avocado-lunch-2', 'Chicken Avocado Salad Bowl', ['keto'], [], 'international', 'chicken', [['chicken', 1.5], ['avocado', 0.5], ['spinach', 1]]],
    ['keto-egg-cheese-lunch-2', 'Egg, Cheese and Spinach Bowl', ['keto'], ['eggs', 'dairy'], 'international', 'egg', [['egg', 4], ['cheese', 1], ['spinach', 1]]],
    ['keto-tofu-avocado-lunch-2', 'Tofu Avocado Salad Bowl', ['keto'], ['soy'], 'international', 'tofu', [['tofu', 1.5], ['avocado', 0.5], ['cucumber', 1]]],
    ['keto-cheese-egg-lunch-2', 'Cheese and Egg Greens Bowl', ['keto'], ['eggs', 'dairy'], 'international', 'egg', [['cheese', 1], ['egg', 3], ['spinach', 1]]]
  ],
  Dinner: [
    ['keto-paneer-avocado-dinner-2', 'Paneer Avocado Dinner Plate', ['keto'], ['dairy'], 'international', 'paneer', [['paneer', 1.5], ['avocado', 0.5], ['spinach', 1]]],
    ['keto-chicken-spinach-dinner-2', 'Chicken Spinach Dinner Plate', ['keto'], [], 'international', 'chicken', [['chicken', 1.5], ['spinach', 1], ['cucumber', 1]]],
    ['keto-egg-cheese-dinner-2', 'Egg Cheese Dinner Plate', ['keto'], ['eggs', 'dairy'], 'international', 'egg', [['egg', 4], ['cheese', 1], ['cucumber', 1]]],
    ['keto-tofu-avocado-dinner-2', 'Tofu Avocado Dinner Plate', ['keto'], ['soy'], 'international', 'tofu', [['tofu', 1.5], ['avocado', 0.5], ['cucumber', 1]]],
    ['keto-cheese-egg-dinner-2', 'Cheese Egg Dinner Plate', ['keto'], ['eggs', 'dairy'], 'international', 'egg', [['cheese', 1], ['egg', 3], ['spinach', 1]]]
  ],
  Snack: [
    ['keto-cheese-cucumber-snack', 'Cheese Cucumber Bites', ['keto'], ['dairy'], 'international', null, [['cheese', 1], ['cucumber', 1]]],
    ['keto-egg-cheese-snack', 'Egg Cheese Bites', ['keto'], ['eggs', 'dairy'], 'international', null, [['egg', 2], ['cheese', 0.5]]],
    ['keto-chicken-cucumber-snack', 'Chicken Cucumber Bites', ['keto'], [], 'international', null, [['chicken', 0.5], ['cucumber', 1]]],
    ['keto-salmon-cucumber-snack', 'Salmon Cucumber Bites', ['keto'], ['fish'], 'international', null, [['salmon', 0.5], ['cucumber', 1]]],
    ['keto-paneer-cucumber-snack', 'Paneer Cucumber Bites', ['keto'], ['dairy'], 'international', null, [['paneer', 0.5], ['cucumber', 1]]],
    ['keto-tofu-cucumber-snack', 'Tofu Cucumber Bites', ['keto'], ['soy'], 'international', null, [['tofu', 0.5], ['cucumber', 1]]]
  ]
};

const withSlot = (slot, entries) => entries.map(([id, name, diets, allergens, cuisine, mainProtein, components, options]) =>
  [id, name, [slot], diets, allergens, cuisine, mainProtein, components, options]);

const nonvegLunchExpansion = [
  ['nonveg-chicken-quinoa-lunch', 'Chicken Tikka with Quinoa Salad', ['nonveg'], [], 'international', 'chicken', [['chicken', 1.5], ['quinoa', 1], ['cucumber', 1]]],
  ['nonveg-fish-rice-lunch', 'Fish Curry with Brown Rice', ['nonveg'], ['fish'], 'south-indian', 'fish', [['rohu', 1.5], ['brownrice', 1], ['tomato', 1]]],
  ['nonveg-egg-roti-lunch', 'Egg Curry with Rotis', ['nonveg'], ['eggs', 'gluten'], 'north-indian', 'egg', [['egg', 3], ['chapati', 2], ['tomato', 1]]],
  ['nonveg-chicken-rice-lunch-2', 'Chicken Curry with Rice', ['nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.5], ['rice', 1], ['cucumber', 1]]],
  ['nonveg-prawn-quinoa-lunch', 'Prawn Quinoa Bowl', ['nonveg'], ['shellfish'], 'international', 'prawns', [['prawns', 1.5], ['quinoa', 1], ['spinach', 1]]]
];

const nonvegDinnerExpansion = [
  ['nonveg-fish-quinoa-dinner', 'Grilled Salmon with Quinoa Salad', ['nonveg'], ['fish'], 'international', 'fish', [['salmon', 1.25], ['quinoa', 1], ['cucumber', 1]]],
  ['nonveg-chicken-millet-dinner', 'Chicken Curry with Millet', ['nonveg'], [], 'south-indian', 'chicken', [['chicken', 1.5], ['millet', 1], ['spinach', 1]]],
  ['nonveg-egg-rice-dinner', 'Egg Curry with Jeera Rice', ['nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['rice', 1], ['tomato', 1]]],
  ['nonveg-chicken-roti-dinner-2', 'Chicken Curry with Rotis', ['nonveg'], ['gluten'], 'north-indian', 'chicken', [['chicken', 1.5], ['chapati', 2], ['cucumber', 1]]],
  ['nonveg-prawn-rice-dinner', 'Prawn Curry with Rice', ['nonveg'], ['shellfish'], 'south-indian', 'prawns', [['prawns', 1.5], ['rice', 1], ['spinach', 1]]]
];

const ketoSnackExpansion = [
  ['keto-salmon-avocado-snack', 'Salmon Avocado Bites', ['keto'], ['fish'], 'international', null, [['salmon', 0.5], ['avocado', 0.5]]],
  ['keto-cheese-avocado-snack', 'Cheese Avocado Bites', ['keto'], ['dairy'], 'international', null, [['cheese', 0.75], ['avocado', 0.5]]]
];

const ketoIndianExpansion = [
  ['keto-methi-chicken', 'Methi Chicken with Sautéed Greens', ['keto', 'nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.5], ['spinach', 1], ['ghee', 1]]],
  ['keto-fish-tikka', 'Fish Tikka with Cucumber Salad', ['keto', 'nonveg'], ['fish'], 'north-indian', 'rohu', [['rohu', 1.5], ['cucumber', 1], ['oliveoil', 1]]],
  ['keto-mushroom-pepper-fry', 'Mushroom Pepper Fry with Paneer', ['keto', 'veg'], ['dairy'], 'south-indian', 'paneer', [['mushroom', 1], ['paneer', 1], ['coconut', 0.5]]],
  ['keto-palak-paneer-no-rice', 'Palak Paneer without Rice', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1.5], ['spinach', 1], ['ghee', 1]]],
  ['keto-egg-cauliflower-mash', 'Egg Curry with Cauliflower Mash', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['cauliflower', 1.5], ['ghee', 1]]],
  ['keto-paneer-tikka-mint', 'Paneer Tikka with Mint Chutney', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1.5], ['cucumber', 1], ['oliveoil', 1]]],
  ['keto-masala-omelette', 'Masala Omelette with Sautéed Spinach', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['spinach', 1], ['capsicum', 1]]],
  ['keto-coconut-chia-pudding', 'Coconut Chia Pudding with Berries', ['keto', 'vegan'], [], 'south-indian', null, [['chia', 1], ['coconutMilk', 1], ['berries', 0.5]]]
];

const ketoVarietyExpansion = [
  ['keto-paneer-mushroom-dinner', 'Paneer Mushroom Pepper Fry', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1.25], ['mushroom', 1], ['ghee', 1]]],
  ['keto-egg-spinach-dinner', 'Egg Curry with Spinach', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['spinach', 1], ['ghee', 1]]],
  ['keto-tofu-cucumber-dinner', 'Tofu with Cucumber Salad', ['keto', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 1.5], ['cucumber', 1], ['oliveoil', 1]]],
  ['keto-chicken-broccoli-dinner', 'Tandoori Chicken with Broccoli', ['keto', 'nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.5], ['broccoli', 0.75], ['ghee', 1]]],
  ['keto-tempeh-mushroom-dinner', 'Tempeh Mushroom Stir-Fry', ['keto', 'vegan'], ['soy'], 'international', 'tempeh', [['tempeh', 1.25], ['mushroom', 1], ['oliveoil', 1]]],
  ['keto-paneer-cucumber-lunch', 'Paneer Tikka with Cucumber Salad', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 1.25], ['cucumber', 1], ['ghee', 1]]],
  ['keto-chicken-capsicum-lunch', 'Chicken Capsicum Saute', ['keto', 'nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.5], ['capsicum', 0.5], ['ghee', 1]]],
  ['keto-egg-mushroom-lunch', 'Egg Mushroom Masala', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 3], ['mushroom', 1], ['ghee', 1]]]
  ,['keto-paneer-kale-dinner', 'Paneer with Kale and Ghee', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 2], ['kale', 0.5], ['ghee', 1]]]
  ,['keto-tofu-spinach-dinner', 'Tofu with Spinach and Sesame', ['keto', 'vegan'], ['soy', 'sesame'], 'international', 'tofu', [['tofu', 2], ['spinach', 1], ['tahini', 0.25]]]
  ,['keto-tofu-ghee-dinner', 'Garlic Ghee Tofu Bowl', ['keto', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 2], ['ghee', 1]]]
  ,['keto-paneer-ghee-dinner', 'Garlic Ghee Paneer Bowl', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 2], ['ghee', 1]]]
  ,['keto-egg-ghee-dinner', 'Masala Eggs in Garlic Ghee', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 4], ['ghee', 1]]]
  ,['keto-chicken-ghee-dinner', 'Tandoori Chicken with Garlic Ghee Gravy', ['keto', 'nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.75], ['ghee', 1]]]
  ,['keto-egg-ghee-lunch', 'Masala Egg Bhurji with Garlic Ghee', ['keto', 'nonveg'], ['eggs'], 'north-indian', 'egg', [['egg', 4], ['ghee', 1]]]
  ,['keto-tofu-ghee-lunch', 'Tofu Stir-Fry with Garlic Ghee', ['keto', 'vegan'], ['soy'], 'international', 'tofu', [['tofu', 2], ['ghee', 1]]]
  ,['keto-paneer-ghee-lunch', 'Paneer Tikka with Garlic Ghee', ['keto', 'veg'], ['dairy'], 'north-indian', 'paneer', [['paneer', 2], ['ghee', 1]]]
  ,['keto-chicken-ghee-lunch', 'Tandoori Chicken Thighs with Garlic Ghee', ['keto', 'nonveg'], [], 'north-indian', 'chicken', [['chicken', 1.75], ['ghee', 1]]]
];

const lightSnackExpansion = [
  ['veg-apple-curd-snack', 'Apple with Curd', ['veg'], ['dairy'], 'international', null, [['apple', 1], ['hungcurd', 0.5]]],
  ['vegan-apple-berries-snack', 'Apple and Berry Bowl', ['vegan'], [], 'international', null, [['apple', 1], ['berries', 0.5]]],
  ['veg-banana-snack', 'Banana Chaat', ['veg', 'vegan'], [], 'international', null, [['banana', 1]]],
  ['vegan-orange-snack', 'Orange and Berries', ['vegan'], [], 'international', null, [['orange', 1], ['berries', 0.5]]]
  ,['veg-berries-curd-snack', 'Berries with Curd', ['veg'], ['dairy'], 'international', null, [['berries', 1], ['hungcurd', 0.5]]]
  ,['veg-apple-cucumber-snack', 'Apple Cucumber Chaat', ['veg', 'vegan'], [], 'international', null, [['apple', 1], ['cucumber', 1]]]
  ,['veg-banana-curd-snack', 'Banana with Curd', ['veg'], ['dairy'], 'international', null, [['banana', 0.75], ['hungcurd', 0.5]]]
  ,['veg-berries-snack', 'Seasonal Berry Bowl', ['veg', 'vegan'], [], 'international', null, [['berries', 1]]]
];

const ketoSnackVariety = [
  ['keto-egg-avocado-snack', 'Egg Avocado Bites', ['keto', 'nonveg'], ['eggs'], 'international', null, [['egg', 2], ['avocado', 0.5]]],
  ['keto-tofu-olive-snack', 'Tofu Olive Bites', ['keto', 'vegan'], ['soy'], 'international', null, [['tofu', 0.75], ['oliveoil', 0.5]]],
  ['keto-paneer-cucumber-snack-2', 'Paneer Cucumber Cups', ['keto', 'veg'], ['dairy'], 'international', null, [['paneer', 0.75], ['cucumber', 1]]],
  ['keto-chicken-cucumber-snack-2', 'Chicken Cucumber Bites', ['keto', 'nonveg'], [], 'international', null, [['chicken', 0.5], ['cucumber', 1]]],
  ['keto-egg-spinach-snack', 'Egg Spinach Bites', ['keto', 'nonveg'], ['eggs'], 'international', null, [['egg', 2], ['spinach', 1]]]
];

const definitions = [
  ...withSlot('Breakfast', breakfast),
  ...withSlot('Lunch', lunch),
  ...withSlot('Lunch', nonvegLunchExpansion),
  ...withSlot('Lunch', extraKetoLunch),
  ...withSlot('Dinner', dinner),
  ...withSlot('Dinner', nonvegDinnerExpansion),
  ...snacks.map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Snack'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...withSlot('Breakfast', extraKeto.slice(0, 1)),
  ...withSlot('Breakfast', extraKetoBreakfast),
  ...withSlot('Lunch', extraKeto.slice(1, 5)),
  ...withSlot('Dinner', extraKeto.slice(5, 6)),
  ...withSlot('Dinner', extraKetoDinner),
  ...withSlot('Dinner', extraKetoDinnerTwo),
  ...extraKeto.slice(6).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Snack'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...extraNonvegSnacks.map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Snack'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoSnackExpansion.map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Snack'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoIndianExpansion.slice(0, 1).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Dinner'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoIndianExpansion.slice(1, 4).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Lunch'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoIndianExpansion.slice(4, 7).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Dinner'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoIndianExpansion.slice(7).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Breakfast'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoVarietyExpansion.slice(0, 5).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Dinner'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoVarietyExpansion.slice(8, 10).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Dinner'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoVarietyExpansion.slice(10).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Lunch'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoVarietyExpansion.slice(5, 8).map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Lunch'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...lightSnackExpansion.map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Snack'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...ketoSnackVariety.map(([id, name, diets, allergens, cuisine, mainProtein, entries, options]) =>
    [id, name, ['Snack'], diets, allergens, cuisine, mainProtein, entries, options]),
  ...Object.entries(ketoPoolExpansion).flatMap(([slot, entries]) => withSlot(slot, entries))
];
export const dishLibrary = definitions.map(([id, name, slots, diets, allergens, cuisine, mainProtein, entries, options]) =>
  dish(
    id,
    name,
    slots,
    ['chicken', 'fish', 'mutton', 'prawns'].includes(mainProtein) && !diets.includes('nonveg')
      ? [...diets, 'nonveg']
      : diets,
    allergens,
    cuisine,
    mainProtein,
    entries,
    options
  )
);

const largeVariantFood = item => {
  if (item.diets.includes('vegan')) return 'oliveoil';
  return 'ghee';
};
const hasNonGheeFatTopping = item => item.components.some(part =>
  ['avocado', 'oliveoil', 'peanutbutter', 'almonds', 'walnuts', 'pumpkinseeds', 'chia', 'flax', 'tahini']
    .includes(part.foodId));

for (const base of [...dishLibrary]) {
  if (!base.slots.some(slot => ['Lunch', 'Dinner'].includes(slot))) continue;
  const extraFoodId = largeVariantFood(base);
  if (extraFoodId === 'ghee' && hasNonGheeFatTopping(base)) continue;
  const extraFood = foodsById.get(extraFoodId);
  if (!extraFood || base.components.length >= 5) continue;
  const extra = component(extraFoodId, 3);
  dishLibrary.push({
    ...base,
    id: `${base.id}-large`,
    name: `${base.name} (Large Portion)`,
    allergens: [...new Set([...base.allergens, ...extraFood.allergens])],
    components: [...base.components, extra],
    addOns: base.addOns.filter(addOn => addOn.foodId !== extraFoodId),
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Use the larger serving only when additional energy is needed.`
  });
}

for (const base of [...dishLibrary]) {
  if (base.id.endsWith('-protein') ||
    !base.diets.includes('keto') ||
    !base.slots.some(slot => ['Breakfast', 'Lunch', 'Dinner'].includes(slot))) continue;
  const proteinComponent = base.components.find(part =>
    ['paneer', 'tofu', 'egg', 'eggwhite', 'chicken', 'fish', 'salmon', 'prawns', 'tempeh'].includes(part.foodId));
  if (!proteinComponent || base.components.length >= 5) continue;
  const boostedProtein = {
    ...proteinComponent,
    baseQty: proteinComponent.baseQty * 1.45,
    kcal: proteinComponent.kcal * 1.45,
    proteinG: proteinComponent.proteinG * 1.45,
    carbsG: proteinComponent.carbsG * 1.45,
    fatG: proteinComponent.fatG * 1.45
  };
  dishLibrary.push({
    ...base,
    id: `${base.id}-protein`,
    name: `${base.name} (High Protein)`,
    components: base.components.map(part => part === proteinComponent ? boostedProtein : part),
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Use the higher protein serving when required by the daily target.`
  });
}

for (const base of [...dishLibrary]) {
  if (base.id.includes('-balanced') ||
    !['chicken', 'fish', 'mutton', 'prawns'].includes(base.mainProtein) ||
    !base.slots.some(slot => ['Lunch', 'Dinner'].includes(slot))) continue;
  const ghee = foodsById.get('ghee');
  const proteinComponent = base.components.find(part => part.foodId === base.mainProtein || part.foodId === 'salmon');
  if (!ghee || !proteinComponent || base.components.length >= 5) continue;
  const reducedProtein = {
    ...proteinComponent,
    baseQty: proteinComponent.baseQty * 0.35,
    kcal: proteinComponent.kcal * 0.35,
    proteinG: proteinComponent.proteinG * 0.35,
    carbsG: proteinComponent.carbsG * 0.35,
    fatG: proteinComponent.fatG * 0.35
  };
  dishLibrary.push({
    ...base,
    id: `${base.id}-lean`,
    name: `${base.name} (Lean Energy)`,
    components: [...base.components.map(part => part === proteinComponent ? reducedProtein : part), component('ghee', 8)],
    allergens: [...new Set([...base.allergens, ...ghee.allergens])],
    addOns: base.addOns.filter(addOn => addOn.foodId !== 'ghee'),
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Use the lean protein and energy portion for a lower-protein calorie target.`
  });
}

for (const base of [...dishLibrary]) {
  if (base.id.endsWith('-large') ||
    !['chicken', 'fish', 'mutton', 'prawns'].includes(base.mainProtein) ||
    !base.slots.some(slot => ['Lunch', 'Dinner'].includes(slot))) continue;
  const ghee = foodsById.get('ghee');
  if (hasNonGheeFatTopping(base)) continue;
  const proteinComponent = base.components.find(part => part.foodId === base.mainProtein || part.foodId === 'salmon');
  if (!ghee || !proteinComponent || base.components.length >= 5) continue;
  const reducedProtein = {
    ...proteinComponent,
    baseQty: proteinComponent.baseQty * 0.5,
    kcal: proteinComponent.kcal * 0.5,
    proteinG: proteinComponent.proteinG * 0.5,
    carbsG: proteinComponent.carbsG * 0.5,
    fatG: proteinComponent.fatG * 0.5
  };
  const components = base.components.map(part => part === proteinComponent ? reducedProtein : part);
  components.push(component('ghee', 6));
  dishLibrary.push({
    ...base,
    id: `${base.id}-balanced`,
    name: `${base.name} (Energy Balanced)`,
    components,
    allergens: [...new Set([...base.allergens, ...ghee.allergens])],
    addOns: base.addOns.filter(addOn => addOn.foodId !== 'ghee'),
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Use the balanced protein and energy portions for larger calorie targets.`
  });
}

for (const base of [...dishLibrary]) {
  if (base.id.includes('-') && (base.id.endsWith('-large') || base.id.endsWith('-balanced'))) continue;
  if (base.diets.includes('keto') && base.slots.some(slot => ['Breakfast', 'Lunch', 'Dinner'].includes(slot))) {
    const ghee = foodsById.get('ghee');
    const proteinComponent = base.components.find(part =>
      ['paneer', 'tofu', 'egg', 'eggwhite', 'chicken', 'fish', 'salmon', 'prawns'].includes(part.foodId));
    const existingFat = base.components.find(part =>
      ['avocado', 'oliveoil', 'peanutbutter', 'almonds', 'walnuts', 'pumpkinseeds', 'chia', 'flax', 'tahini'].includes(part.foodId));
    const energyFood = existingFat ? foodsById.get(existingFat.foodId) : ghee;
    const energyFoodId = existingFat ? existingFat.foodId : 'ghee';
    if (!energyFood || !proteinComponent || base.components.length >= 5) continue;
    const reducedProtein = {
      ...proteinComponent,
      baseQty: proteinComponent.baseQty * 0.5,
      kcal: proteinComponent.kcal * 0.5,
      proteinG: proteinComponent.proteinG * 0.5,
      carbsG: proteinComponent.carbsG * 0.5,
      fatG: proteinComponent.fatG * 0.5
    };
    dishLibrary.push({
      ...base,
      id: `${base.id}-energy`,
      name: `${base.name} (Keto Energy)`,
      components: [...base.components.map(part => part === proteinComponent ? reducedProtein : part),
        component(energyFoodId, energyFoodId === 'ghee' ? 8 : 2)],
      allergens: [...new Set([...base.allergens, ...energyFood.allergens])],
      addOns: base.addOns.filter(addOn => addOn.foodId !== energyFoodId),
      scaleMax: 1.75,
      prepNotes: `${base.prepNotes} Use the energy-balanced portion for higher calorie needs.`
    });
  }
}

for (const base of [...dishLibrary]) {
  if (base.id.includes('-') && (base.id.endsWith('-large') || base.id.endsWith('-balanced') || base.id.endsWith('-energy'))) continue;
  if (!base.diets.includes('veg') && !base.diets.includes('vegan')) continue;
  const proteinComponent = base.components.find(part =>
    ['paneer', 'tofu', 'dal', 'rajma', 'chana', 'moong', 'soya', 'tempeh', 'quinoa'].includes(part.foodId));
  if (!proteinComponent || base.components.length >= 5) continue;
  const extraProtein = {
    ...proteinComponent,
    baseQty: proteinComponent.baseQty * 0.5,
    kcal: proteinComponent.kcal * 0.5,
    proteinG: proteinComponent.proteinG * 0.5,
    carbsG: proteinComponent.carbsG * 0.5,
    fatG: proteinComponent.fatG * 0.5
  };
  dishLibrary.push({
    ...base,
    id: `${base.id}-protein`,
    name: `${base.name} (Extra Protein)`,
    components: [...base.components, extraProtein],
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Add the extra protein serving when needed to meet the daily target.`
  });
}

const fullYogurtSnack = dishLibrary.find(item => item.id === 'snack-yogurt-berries');
if (fullYogurtSnack) {
  dishLibrary.push({
    ...fullYogurtSnack,
    id: 'snack-yogurt-berries-full',
    name: 'Greek Yogurt with Berries (Full Protein Serving)',
    scaleMin: 1,
    scaleMax: 1.1
  });
}

for (const base of [...dishLibrary]) {
  if (!base.diets.includes('nonveg') ||
    /-(large|balanced|lean|energy|protein)$/.test(base.id) ||
    !['chicken', 'fish', 'mutton', 'prawns', 'egg'].includes(base.mainProtein) ||
    !base.slots.some(slot => ['Breakfast', 'Lunch', 'Dinner'].includes(slot))) continue;
  const proteinComponent = base.components.find(part => part.foodId === base.mainProtein);
  if (!proteinComponent || base.components.length >= 5) continue;
  const extraProtein = {
    ...proteinComponent,
    baseQty: proteinComponent.baseQty * 0.45,
    kcal: proteinComponent.kcal * 0.45,
    proteinG: proteinComponent.proteinG * 0.45,
    carbsG: proteinComponent.carbsG * 0.45,
    fatG: proteinComponent.fatG * 0.45
  };
  dishLibrary.push({
    ...base,
    id: `${base.id}-protein`,
    name: `${base.name} (Extra Protein)`,
    components: [...base.components, extraProtein],
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Add the extra lean protein serving when required.`
  });
}

for (const base of [...dishLibrary]) {
  if (base.id.includes('-carb') ||
    !['veg', 'vegan'].some(diet => base.diets.includes(diet)) ||
    !base.slots.some(slot => ['Lunch', 'Dinner'].includes(slot))) continue;
  const proteinComponent = base.components.find(part =>
    ['paneer', 'tofu', 'dal', 'rajma', 'chana', 'moong', 'masoor', 'soya', 'tempeh', 'quinoa', 'blackbeans'].includes(part.foodId));
  const rice = foodsById.get('rice');
  if (!proteinComponent || !rice || base.components.length >= 5) continue;
  const reducedProtein = {
    ...proteinComponent,
    baseQty: proteinComponent.baseQty * 0.55,
    kcal: proteinComponent.kcal * 0.55,
    proteinG: proteinComponent.proteinG * 0.55,
    carbsG: proteinComponent.carbsG * 0.55,
    fatG: proteinComponent.fatG * 0.55
  };
  dishLibrary.push({
    ...base,
    id: `${base.id}-carb`,
    name: `${base.name} (Carb Balanced)`,
    components: [
      ...base.components.map(part => part === proteinComponent ? reducedProtein : part),
      component('rice', 1)
    ],
    scaleMax: 1.75,
    prepNotes: `${base.prepNotes} Use the higher-carbohydrate serving for endurance or higher-energy days.`
  });
}


// Stage nutrition: curated extreme-profile dishes (low-cal high-protein / high-cal low-protein)
const curatedExtreme = [
  dish('curated-greek-yogurt-bowl', 'Greek Yogurt Protein Bowl', ['Breakfast', 'Snack'], ['veg', 'nonveg'], ['dairy'], 'international', 'dairy',
    [['greekyogurt', 1.5], ['berries', 0.5], ['pumpkinseeds', 0.25]], { scaleMin: 0.7, scaleMax: 1.8 }),
  dish('curated-egg-white-omelette', 'Egg White Omelette with Spinach', ['Breakfast'], ['nonveg', 'keto'], ['egg'], 'international', 'egg',
    [['eggwhite', 3], ['spinach', 1], ['paneer', 0.25]], { scaleMin: 0.75, scaleMax: 2.0 }),
  dish('curated-soya-chunk-salad', 'Soya Chunk Salad Bowl', ['Lunch', 'Dinner'], ['veg', 'vegan'], [], 'north-indian', 'soya',
    [['soya', 1.25], ['cucumber', 1], ['tomato', 0.5], ['cucumber', 0.5]], { scaleMin: 0.75, scaleMax: 1.9 }),
  dish('curated-tofu-scramble', 'High-Protein Tofu Scramble', ['Breakfast', 'Lunch'], ['vegan', 'veg'], ['soy'], 'international', 'tofu',
    [['tofu', 1.5], ['spinach', 1], ['tomato', 0.5]], { scaleMin: 0.75, scaleMax: 1.9 }),
  dish('curated-rice-ghee-banana', 'Rice with Ghee and Banana', ['Lunch', 'Dinner'], ['veg', 'vegan'], [], 'south-indian', null,
    [['rice', 1.5], ['ghee', 0.5], ['banana', 1]], { scaleMin: 0.8, scaleMax: 2.0 }),
  dish('curated-roti-ghee-stack', 'Roti Stack with Ghee', ['Lunch', 'Dinner'], ['veg'], ['gluten'], 'north-indian', null,
    [['chapati', 3], ['ghee', 0.75], ['potato', 0.75]], { scaleMin: 0.8, scaleMax: 2.0 }),
  dish('curated-peanut-banana-toast', 'Peanut Banana Toast Energy', ['Breakfast', 'Snack'], ['veg', 'vegan'], ['nuts', 'gluten'], 'international', null,
    [['sourdough', 2], ['peanutbutter', 1], ['banana', 1]], { scaleMin: 0.75, scaleMax: 2.0 }),
  dish('curated-chicken-breast-light', 'Light Grilled Chicken with Salad', ['Lunch', 'Dinner'], ['nonveg', 'keto'], [], 'international', 'chicken',
    [['chicken', 1.25], ['cucumber', 1], ['spinach', 1]], { scaleMin: 0.75, scaleMax: 1.9 }),
  dish('curated-whey-water', 'Whey Protein Water', ['Snack'], ['veg', 'nonveg'], ['dairy'], 'international', null,
    [['whey', 1.25]], { scaleMin: 0.75, scaleMax: 2.0 }),
  dish('curated-dal-rice-energy', 'Dal Rice Energy Bowl', ['Lunch', 'Dinner'], ['veg', 'vegan'], [], 'north-indian', null,
    [['moong', 1], ['rice', 1.5], ['ghee', 0.35]], { scaleMin: 0.8, scaleMax: 2.0 })
];
for (const item of curatedExtreme) {
  if (!dishLibrary.some(existing => existing.id === item.id)) dishLibrary.push(item);
}

export default dishLibrary;

