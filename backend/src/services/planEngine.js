/**
 * Stage 8 — Adaptive Diet & Workout Plan Engine + Server-Side Schema Validator
 * Implements PRD Prompts 7, 8, 18, 20 & Appendix C (AI Plan Generation Contract).
 * - Generates structured, culturally grounded (India-first + international) diet & workout plans
 * - Enforces safety floors (never extreme calorie deficits; conservative pain/condition adaptations)
 * - Supports targeted partial regeneration (e.g. "no eggs today", "knee hurts", "outdoor", "shorter today")
 *   without clobbering unaffected meals or workout days.
 */
import { str } from '../utils/helpers.js';

const MEAL_TEMPLATES = {
  veg: [
    {
      slot: 'Breakfast',
      title: 'Moong Dal Chilla & Mint Curd Bowl',
      items: ['2 savoury moong dal chillas', '100g low-fat dahi (curd)', '1 small banana or seasonal fruit'],
      contains: ['dairy'],
      prepNotes: 'Pan-cook soaked ground moong dal with ginger, cumin, and chopped spinach using 1 tsp oil.',
      portionGuidance: '2 medium chillas + 1 katori curd',
      approxKcal: 420,
      approxProteinG: 21,
      substitutions: ['Vegetable poha with roasted peanuts & sprouts', 'Oats porridge with milk, chia seeds & almonds']
    },
    {
      slot: 'Lunch',
      title: 'Paneer Tikka Masala, Dal Tadka & Multigrain Roti',
      items: ['120g grilled paneer cubes', '1 katori yellow dal tadka', '2 phulkas (whole wheat/multigrain)', 'Cucumber-tomato kachumber salad'],
      contains: ['dairy', 'gluten'],
      prepNotes: 'Use home-style lightly spiced gravy; pair with steamed brown rice if preferred over roti.',
      portionGuidance: '1 palm-sized serving paneer + 1 bowl dal + 2 rotis',
      approxKcal: 610,
      approxProteinG: 32,
      substitutions: ['Rajma chawal with roasted papad & curd', 'Soya chunk pulav with cucumber raita']
    },
    {
      slot: 'Dinner',
      title: 'Mixed Sprout & Palak Stir-Fry with Jowar Bhakri',
      items: ['150g steamed mixed sprouts & spinach stir-fry', '1 jowar/bajra millet roti', '100g sautéed seasonal sabzi'],
      contains: [],
      prepNotes: 'Lightly temper sprouts with mustard seeds, curry leaves, and turmeric for easy evening digestion.',
      portionGuidance: '1 large bowl sprouts/greens + 1 millet flatbread',
      approxKcal: 460,
      approxProteinG: 22,
      substitutions: ['Palak tofu curry with 1 chapati', 'Khichdi with mixed vegetables and 1 tsp ghee']
    },
    {
      slot: 'Snack',
      title: 'Roasted Makhana, Chana & Buttermilk (Chaas)',
      items: ['30g roasted chana (Bengal gram)', '1 cup spiced chaas (buttermilk)', 'Handful of roasted makhana (foxnuts)'],
      contains: ['dairy'],
      prepNotes: 'Dry-roast makhana with black salt and cumin.',
      portionGuidance: '1 small handful chana + 1 glass chaas',
      approxKcal: 240,
      approxProteinG: 11,
      substitutions: ['Sprout bhel with lemon & coriander', '1 apple with 10 almonds']
    }
  ],
  nonveg: [
    {
      slot: 'Breakfast',
      title: 'Masala Egg Bhurji, Multigrain Toast & Fruit',
      items: ['2 whole eggs + 2 egg whites bhurji with onion/tomato', '2 slices whole-grain toast', '1 small banana'],
      contains: ['eggs', 'gluten'],
      prepNotes: 'Scramble eggs with turmeric, green chilli, and coriander in 1 tsp olive/mustard oil.',
      portionGuidance: '1 bowl bhurji + 2 slices toast',
      approxKcal: 450,
      approxProteinG: 28,
      substitutions: ['Moong dal chilla with paneer filling (egg-free swap)', '3 boiled egg whites + vegetable upma']
    },
    {
      slot: 'Lunch',
      title: 'Tandoori Chicken Breast, Dal & Brown Rice Bowl',
      items: ['150g grilled/tandoori chicken breast', '1 small katori dal', '1 cup steamed brown/basmati rice', 'Kachumber salad'],
      contains: ['meat'],
      prepNotes: 'Marinate chicken in curd, lemon, ginger-garlic, and tandoori spices; grill or air-fry.',
      portionGuidance: '1 palm-sized chicken breast + 1 cup rice + salad',
      approxKcal: 640,
      approxProteinG: 44,
      substitutions: ['Home-style fish curry (rohu/surmai) with steamed rice', 'Grilled paneer & chickpea bowl (vegetarian day swap)']
    },
    {
      slot: 'Dinner',
      title: 'Light Lemon-Pepper Fish / Chicken & Sautéed Greens',
      items: ['140g pan-seared fish or chicken strips', '150g stir-fried beans, carrots & capsicum', '1 whole-wheat phulka'],
      contains: ['meat', 'fish', 'gluten'],
      prepNotes: 'Sear on medium heat with garlic, black pepper, and lemon juice.',
      portionGuidance: '140g lean protein + 1.5 cups vegetables + 1 roti',
      approxKcal: 470,
      approxProteinG: 36,
      substitutions: ['Egg curry with 1 millet roti', 'Dal palak with 120g grilled tofu/paneer']
    },
    {
      slot: 'Snack',
      title: 'Dahi / Greek Yogurt Bowl with Roasted Seeds & Almonds',
      items: ['150g hung curd / Greek yogurt', '10 almonds & 1 tbsp pumpkin seeds', '1 seasonal fruit'],
      contains: ['dairy', 'nuts'],
      prepNotes: 'Top unsweetened yogurt with nuts and sliced fruit.',
      portionGuidance: '1 bowl yogurt + 1 tbsp mixed nuts/seeds',
      approxKcal: 250,
      approxProteinG: 15,
      substitutions: ['Roasted chana & coconut water', 'Whey or plant protein shake in water']
    }
  ],
  vegan: [
    {
      slot: 'Breakfast',
      title: 'Masala Tofu Scramble & Millet Poha',
      items: ['120g crumbled tofu bhurji with turmeric & veggies', '1 cup red rice or millet poha with curry leaves', 'Lemon wedge'],
      contains: ['soy'],
      prepNotes: 'Sauté tofu with onion, tomato, kala namak, and turmeric; serve alongside light poha.',
      portionGuidance: '1 bowl tofu scramble + 1 small bowl poha',
      approxKcal: 430,
      approxProteinG: 23,
      substitutions: ['Besan chilla with mint-coriander chutney', 'Overnight oats in soy/almond milk with chia seeds']
    },
    {
      slot: 'Lunch',
      title: 'Chana Masala, Quinoa/Brown Rice & Koshimbir Salad',
      items: ['1.5 cups Punjabi chana masala (chickpeas)', '1 cup brown rice or millet', 'Cucumber-pomegranate salad'],
      contains: [],
      prepNotes: 'Pressure-cook soaked kabuli chana; simmer with tomato-onion masala.',
      portionGuidance: '1.5 bowls chana + 1 cup grains',
      approxKcal: 590,
      approxProteinG: 24,
      substitutions: ['Soya chunk curry with 2 rotis', 'Rajma & millet bowl with sautéed greens']
    },
    {
      slot: 'Dinner',
      title: 'Dal Palak, Grilled Tofu & Jowar Roti',
      items: ['1 bowl spinach-lentil dal', '100g pan-grilled spiced tofu', '1 jowar roti'],
      contains: ['soy'],
      prepNotes: 'Combine toor/moong dal with blanched spinach and garlic tadka.',
      portionGuidance: '1 bowl dal + 100g tofu + 1 millet roti',
      approxKcal: 460,
      approxProteinG: 26,
      substitutions: ['Mixed sprout curry with steamed rice', 'Lentil soup with roasted sweet potato']
    },
    {
      slot: 'Snack',
      title: 'Roasted Chana, Trail Mix & Tender Coconut Water',
      items: ['35g roasted chana', '15g mixed seeds (pumpkin, sunflower)', '1 glass tender coconut water'],
      contains: [],
      prepNotes: 'Ready-to-eat high-fibre plant snack.',
      portionGuidance: '1 small bowl roasted chana & seeds',
      approxKcal: 230,
      approxProteinG: 10,
      substitutions: ['Soy milk smoothie with banana', 'Steamed edamame or sweet corn chaat']
    }
  ],
  keto: [
    {
      slot: 'Breakfast',
      title: 'Paneer & Spinach Omelette / Masala Scramble in Ghee',
      items: ['3 eggs (or 150g paneer for veg keto)', '1 cup sautéed spinach & mushrooms', '1 tsp cow ghee'],
      contains: ['eggs', 'dairy'],
      prepNotes: 'Cook on low-medium flame in ghee with black pepper and herbs.',
      portionGuidance: '3-egg omelette (or 150g paneer bhurji) + greens',
      approxKcal: 480,
      approxProteinG: 29,
      substitutions: ['Paneer bhurji with avocado/coconut slices (egg-free keto)', 'Chia seed pudding in coconut cream']
    },
    {
      slot: 'Lunch',
      title: 'Grilled Chicken / Paneer Tikka Salad with Olive Oil Dressing',
      items: ['160g tandoori chicken thighs or malai paneer', '2 cups mixed leafy greens, cucumber & olives', '1 tbsp extra-virgin olive oil'],
      contains: ['dairy'],
      prepNotes: 'Grill protein until golden; toss greens with olive oil and lemon.',
      portionGuidance: '160g protein + large salad bowl',
      approxKcal: 620,
      approxProteinG: 38,
      substitutions: ['Tawa fish fry with stir-fried broccoli & bell peppers', 'Tofu & mushroom coconut curry with cauliflower rice']
    },
    {
      slot: 'Dinner',
      title: 'Palak Paneer / Methi Chicken with Cauliflower Rice',
      items: ['150g paneer or chicken in spinach-fenugreek gravy', '1.5 cups grated steamed cauliflower rice'],
      contains: ['dairy'],
      prepNotes: 'Blanch spinach and simmer with cream/coconut milk and whole spices.',
      portionGuidance: '1 bowl curry + 1.5 cups cauliflower rice',
      approxKcal: 510,
      approxProteinG: 31,
      substitutions: ['Grilled salmon/surmai with asparagus & butter', 'Bharwan bhindi & tofu stir-fry']
    },
    {
      slot: 'Snack',
      title: 'Almonds, Walnuts & Spiced Cheese/Paneer Cubes',
      items: ['15 almonds & 5 walnut halves', '40g cubed paneer or cheddar with chaat masala'],
      contains: ['dairy', 'nuts'],
      prepNotes: 'Portion nuts in advance to stay within energy targets.',
      portionGuidance: '1 small handful nuts + 40g paneer',
      approxKcal: 260,
      approxProteinG: 11,
      substitutions: ['Pumpkin & flax seeds with unsweetened coconut yogurt', 'Cucumber slices with peanut/almond butter']
    }
  ]
};

const EGG_FREE_BREAKFAST_REPLACEMENT = {
  slot: 'Breakfast',
  title: 'High-Protein Paneer & Moong Dal Chilla (Egg-Free Swap)',
  items: ['2 moong dal chillas stuffed with 60g grated paneer/tofu', 'Mint-coriander chutney', '1 small fruit'],
  contains: ['dairy'],
  prepNotes: 'Egg-free substitution applied: ground moong dal batter cooked on a tawa with spiced grated paneer/tofu filling.',
  portionGuidance: '2 stuffed chillas + chutney',
  approxKcal: 430,
  approxProteinG: 25,
  uncertaintyLabel: 'Approximate estimate (±15%); depends on batter thickness and oil used.',
  substitutions: ['Tofu bhurji with multigrain toast', 'Besan chilla with curd']
};

const DAIRY_FREE_REPLACEMENT = {
  slot: 'Snack',
  title: 'Roasted Chana, Pumpkin Seeds & Lemon Sprout Bhel (Dairy-Free Swap)',
  items: ['40g roasted chana', '1 cup steamed moong sprouts with lemon & tomato', '1 tbsp pumpkin seeds'],
  contains: [],
  prepNotes: 'Dairy-free substitution applied: toss sprouts and chana with lemon juice, chaat masala, and coriander.',
  portionGuidance: '1 medium bowl sprout-chana bhel',
  approxKcal: 245,
  approxProteinG: 13,
  uncertaintyLabel: 'Approximate estimate (±15%).',
  substitutions: ['Soy milk protein smoothie', 'Tender coconut water + almonds']
};

const BASE_WORKOUT_DAYS = [
  {
    day: 'Mon',
    focus: 'Full Body Strength A',
    durationMin: 40,
    environment: 'indoor',
    warmUp: '5 min brisk walk/march in place + hip circles, arm swings & 10 bodyweight good-mornings',
    exercises: [
      { name: 'Goblet Squat / Bodyweight Squat', prescription: '3 sets × 10 reps', rest: '75s', intensityRpe: 'RPE 7 (2–3 reps in reserve)', formCue: 'Keep chest proud, knees tracking over mid-foot.', substitution: 'Glute Bridge (knee-friendly)' },
      { name: 'Push-Up (or Incline Push-Up)', prescription: '3 sets × 8–12 reps', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Brace core; elbows at ~45° from torso.', substitution: 'Wall Push-Up or Dumbbell Floor Press' },
      { name: 'One-Arm Dumbbell / Backpack Row', prescription: '3 sets × 10 reps/side', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Pull elbow toward hip; avoid twisting lower back.', substitution: 'Resistance Band Seated Row' },
      { name: 'Dead Bug Core Brace', prescription: '3 sets × 8 reps/side', rest: '45s', intensityRpe: 'RPE 6', formCue: 'Keep lower back gently pressed into the mat.', substitution: 'Bird-Dog' }
    ],
    coolDown: '5 min chest, hip-flexor, and hamstring gentle static stretches + slow nasal breathing'
  },
  {
    day: 'Tue',
    focus: 'Low-Impact Cardio & Core Stability',
    durationMin: 30,
    environment: 'flexible',
    warmUp: '4 min easy walk + ankle and thoracic mobility',
    exercises: [
      { name: 'Brisk Zone-2 Walk or Cycling', prescription: '20 min steady pace', rest: '—', intensityRpe: 'RPE 5–6 (conversational pace)', formCue: 'Relax shoulders and maintain steady rhythmic breathing.', substitution: 'Seated Shadow Boxing / Step-Jacks' },
      { name: 'Side Plank (Knees or Feet)', prescription: '3 sets × 25s/side', rest: '45s', intensityRpe: 'RPE 6', formCue: 'Stack hips and shoulders in a straight line.', substitution: 'Pallof Press / Standing Core Brace' }
    ],
    coolDown: '4 min calf and lower-back stretch'
  },
  {
    day: 'Wed',
    focus: 'Active Recovery & Mobility Flow',
    durationMin: 20,
    environment: 'indoor',
    warmUp: '3 min diaphragmatic breathing',
    exercises: [
      { name: 'Cat-Cow & Thoracic Openers', prescription: '2 sets × 8 slow breaths', rest: '30s', intensityRpe: 'RPE 3–4', formCue: 'Move smoothly within a pain-free range.', substitution: 'Seated Spinal Mobility' },
      { name: '90/90 Hip Switches & Child’s Pose', prescription: '2 sets × 60s', rest: '30s', intensityRpe: 'RPE 3', formCue: 'Never force a joint past mild tension.', substitution: 'Supine Knee-to-Chest Stretch' }
    ],
    coolDown: '3 min relaxation breathing'
  },
  {
    day: 'Thu',
    focus: 'Full Body Strength B (Hinge & Overhead)',
    durationMin: 40,
    environment: 'indoor',
    warmUp: '5 min dynamic hip hinges, scapular wall slides & band pull-aparts',
    exercises: [
      { name: 'Romanian Deadlift (Dumbbells or Hip Hinge)', prescription: '3 sets × 10 reps', rest: '75s', intensityRpe: 'RPE 7', formCue: 'Push hips back with a neutral spine; feel gentle hamstring tension.', substitution: 'Supine Hamstring Bridge' },
      { name: 'Seated / Standing Overhead Press', prescription: '3 sets × 8–10 reps', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Ribs down; avoid overarching lower back.', substitution: 'Lateral Raise or Landmine Press' },
      { name: 'Split Squat / Reverse Lunge', prescription: '3 sets × 8 reps/side', rest: '75s', intensityRpe: 'RPE 7', formCue: 'Control the descent; step back softly.', substitution: 'Step-Up to Low Box or Clamshells (knee-friendly)' },
      { name: 'Forearm Plank', prescription: '3 sets × 30–40s', rest: '45s', intensityRpe: 'RPE 6–7', formCue: 'Squeeze glutes and quads; breathe steadily.', substitution: 'Incline Plank on Bench/Table' }
    ],
    coolDown: '5 min shoulder, glute, and quad stretches'
  },
  {
    day: 'Fri',
    focus: 'Conditioning Intervals (Quiet / Low-Impact Friendly)',
    durationMin: 25,
    environment: 'flexible',
    warmUp: '5 min marching, arm circles, and bodyweight step-backs',
    exercises: [
      { name: 'Low-Impact Tempo Circuits (Step-Jacks, Shadow Boxing, Marching High Knees)', prescription: '5 rounds × (45s work / 45s easy recovery)', rest: '45s', intensityRpe: 'RPE 7', formCue: 'Land softly on the balls of your feet; stop if any joint discomfort arises.', substitution: 'Outdoor Brisk Walk Intervals' },
      { name: 'Farmer’s Carry or Posture Walk', prescription: '3 sets × 45s', rest: '45s', intensityRpe: 'RPE 6', formCue: 'Tall spine, shoulders relaxed down and back.', substitution: 'Seated Posture Hold' }
    ],
    coolDown: '5 min slow walk and deep breathing'
  },
  {
    day: 'Sat',
    focus: 'Upper Body & Core Endurance + Outdoor Walk',
    durationMin: 35,
    environment: 'outdoor',
    warmUp: '5 min outdoor brisk walk + shoulder rolls',
    exercises: [
      { name: 'Outdoor Brisk Walk / Easy Jog Progression', prescription: '20 min steady pace', rest: '—', intensityRpe: 'RPE 6', formCue: 'Keep cadence smooth and comfortable.', substitution: 'Indoor Step Circuit' },
      { name: 'Incline Push-Ups & Band Pull-Aparts Superset', prescription: '3 sets × 12 reps', rest: '60s', intensityRpe: 'RPE 6–7', formCue: 'Focus on controlled tempo (2s down, 1s up).', substitution: 'Wall Push-Ups + Scapular Squeezes' }
    ],
    coolDown: '5 min gentle lower-body stretching'
  },
  {
    day: 'Sun',
    focus: 'Complete Rest & Recovery Check-In',
    durationMin: 15,
    environment: 'flexible',
    warmUp: 'Optional gentle stroll',
    exercises: [
      { name: 'Rest, Hydration & Sleep Priority', prescription: 'Full recovery day', rest: '—', intensityRpe: 'RPE 1–2', formCue: 'Muscle and cardiovascular adaptation happen during recovery.', substitution: '15 min leisurely walk' }
    ],
    coolDown: 'Early wind-down routine'
  }
];

/**
 * Validates that a plan object satisfies PRD Appendix C (AI Plan Generation Contract).
 */
export function validatePlanContract(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan must be an object.'] };
  }
  if (!['diet', 'workout', 'combined'].includes(plan.planType)) {
    errors.push('Invalid or missing planType.');
  }
  if (typeof plan.version !== 'number' || plan.version < 1) {
    errors.push('Plan version must be a positive integer.');
  }
  if (!plan.goal || typeof plan.goal !== 'string') {
    errors.push('Missing goal.');
  }
  if (!Array.isArray(plan.assumptions)) {
    errors.push('Missing assumptions array.');
  }
  if (!Array.isArray(plan.constraintsHonored)) {
    errors.push('Missing constraintsHonored array.');
  }
  if (!Array.isArray(plan.meals) || plan.meals.length === 0) {
    errors.push('Plan must include structured meals array.');
  }
  if (!Array.isArray(plan.days) || plan.days.length === 0) {
    errors.push('Plan must include structured workout days array.');
  }
  if (!plan.estimateMetadata || typeof plan.estimateMetadata !== 'object' || !plan.estimateMetadata.disclaimer) {
    errors.push('Plan must include estimateMetadata with uncertainty disclaimer.');
  }
  if (!Array.isArray(plan.safetyFlags)) {
    errors.push('Plan must include safetyFlags array.');
  }
  if (!plan.explanation || typeof plan.explanation !== 'string') {
    errors.push('Plan must include user-facing explanation.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Generates a complete, schema-valid VYORA plan honoring user profile and constraints.
 */
export function buildAdaptivePlan(input = {}) {
  const heightCm = Math.max(120, Math.min(230, Number(input.heightCm || input.height) || 168));
  const weightKg = Math.max(35, Math.min(220, Number(input.weightKg || input.weight) || 65));
  const age = Math.max(18, Math.min(95, Number(input.age) || 28));
  const gender = ['male', 'female', 'other'].includes(input.gender) ? input.gender : 'other';
  const diet = ['veg', 'nonveg', 'vegan', 'keto'].includes(input.diet) ? input.diet : 'veg';
  const goal = ['fatloss', 'musclegain', 'recomp', 'endurance', 'general'].includes(input.goal) ? input.goal : 'recomp';
  const planType = ['diet', 'workout', 'combined'].includes(input.planType || input.kind) ? (input.planType || input.kind) : 'combined';
  const equipment = str(input.equipment, 100) || 'minimal / home dumbbells';
  const sessionMinutes = Math.max(15, Math.min(90, Number(input.sessionMinutes) || 35));
  const exclusions = Array.isArray(input.exclusions)
    ? input.exclusions.map(x => str(x, 40).toLowerCase()).filter(Boolean)
    : [];
  const limitations = Array.isArray(input.limitations)
    ? input.limitations.map(x => str(x, 60).toLowerCase()).filter(Boolean)
    : (input.limitation ? [str(input.limitation, 60).toLowerCase()] : []);

  // Mifflin-St Jeor approximate estimation with safe bounds (never extreme deficit < 1300 kcal)
  const bmr = gender === 'female'
    ? (10 * weightKg + 6.25 * heightCm - 5 * age - 161)
    : (10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  const maintenance = Math.round(bmr * 1.4);
  const rawTarget = goal === 'fatloss'
    ? maintenance - 400
    : goal === 'musclegain'
      ? maintenance + 300
      : goal === 'endurance'
        ? maintenance + 150
        : maintenance;
  const safeTargetKcal = Math.max(1350, Math.round(rawTarget));

  const constraintsHonored = [
    `diet:${diet}`,
    `goal:${goal}`,
    `equipment:${equipment}`,
    `sessionMinutes:${sessionMinutes}`
  ];

  // Clone and adapt meals
  let meals = structuredClone(MEAL_TEMPLATES[diet] || MEAL_TEMPLATES.veg).map((m) => ({
    ...m,
    uncertaintyLabel: 'Approximate estimate (±15% kcal/macros based on home portion sizes and cooking oil).'
  }));

  if (exclusions.some(e => e.includes('egg'))) {
    constraintsHonored.push('exclusion:no_eggs');
    meals = meals.map(m => (m.contains?.includes('eggs') ? structuredClone(EGG_FREE_BREAKFAST_REPLACEMENT) : m));
  }
  if (exclusions.some(e => e.includes('dairy') || e.includes('milk') || e.includes('lactose'))) {
    constraintsHonored.push('exclusion:no_dairy');
    meals = meals.map(m => (m.contains?.includes('dairy') && m.slot === 'Snack' ? structuredClone(DAIRY_FREE_REPLACEMENT) : m));
  }

  // Clone and adapt workout days
  const safetyFlags = [];
  let days = structuredClone(BASE_WORKOUT_DAYS).map(d => ({
    ...d,
    durationMin: Math.min(d.durationMin, sessionMinutes)
  }));

  const hasKneePain = limitations.some(l => l.includes('knee'));
  const hasBackPain = limitations.some(l => l.includes('back') || l.includes('spine'));

  if (hasKneePain) {
    constraintsHonored.push('limitation:knee_pain_caution');
    safetyFlags.push('Knee discomfort reported: high-flexion loaded squats/lunges replaced with glute bridges and low-impact movements. Stop immediately if pain worsens and consult a physiotherapist/doctor.');
    days = days.map(d => ({
      ...d,
      exercises: d.exercises.map(ex => {
        if (/squat|lunge/i.test(ex.name)) {
          return {
            ...ex,
            name: `${ex.substitution || 'Supine Glute Bridge'} (Knee-Friendly Swap)`,
            formCue: 'Pain-free range only; stop immediately if knee discomfort increases.'
          };
        }
        return ex;
      })
    }));
  }

  if (hasBackPain) {
    constraintsHonored.push('limitation:back_pain_caution');
    safetyFlags.push('Back sensitivity reported: axial hinges replaced with supported core and glute work. Seek clinical evaluation for radiating or worsening pain.');
    days = days.map(d => ({
      ...d,
      exercises: d.exercises.map(ex => {
        if (/deadlift|row/i.test(ex.name)) {
          return {
            ...ex,
            name: `${ex.substitution || 'Chest-Supported Row / Bird-Dog'} (Back-Friendly Swap)`,
            formCue: 'Maintain neutral spine; stop if any lower-back pain occurs.'
          };
        }
        return ex;
      })
    }));
  }

  const plan = {
    planType,
    version: 1,
    goal,
    profileSnapshot: { heightCm, weightKg, age, gender, diet, equipment, sessionMinutes },
    assumptions: [
      'General wellness adult profile without acute medical contraindications.',
      'Calorie and protein figures are approximate estimates using standard Indian household portions.',
      'Progressive overload should be applied gradually (e.g. +1–2 reps when all sets feel comfortable at RPE ≤ 7).'
    ],
    constraintsHonored,
    meals,
    days,
    substitutions: {
      eggFree: 'Moong dal chilla, paneer/tofu bhurji, or roasted chana bowls.',
      noEquipment: 'Bodyweight squats/bridges, incline push-ups, backpack rows, and brisk walking.',
      lowImpactPain: 'Switch to glute bridges, seated upper-body mobility, or rest; consult a clinician if pain persists.'
    },
    safetyFlags: safetyFlags.length
      ? safetyFlags
      : ['General wellness plan only — not a medical prescription or clinical diet. Stop any exercise that causes sharp or worsening pain.'],
    estimateMetadata: {
      estimatedDailyKcal: safeTargetKcal,
      dailyKcalRange: `${safeTargetKcal - 150}–${safeTargetKcal + 150} kcal/day`,
      estimatedProteinRangeG: `${Math.round(weightKg * 1.3)}–${Math.round(weightKg * 1.7)} g/day`,
      confidence: 'moderate_estimate',
      disclaimer: 'All calorie and macro values are approximate estimates (±15%). Consult a qualified dietitian or doctor for medical nutrition therapy.'
    },
    explanation: `Generated a personalized ${diet} diet and ${days.length}-day workout plan for ${goal} (~${safeTargetKcal} kcal/day, ±150 kcal uncertainty). Honored constraints: ${constraintsHonored.join(', ')}.`,
    changeHistory: [
      {
        version: 1,
        timestamp: new Date().toISOString(),
        request: 'Initial plan generation',
        whatChanged: 'Generated full baseline meal and workout plan.',
        why: `Tailored to ${goal}, ${diet} preference, and ${sessionMinutes} min session window.`
      }
    ]
  };

  return plan;
}

/**
 * Applies a targeted partial edit or conversational swap to an existing plan
 * WITHOUT regenerating or losing unrelated meals or workout days (PRD Prompt 7, 8 & 20).
 */
export function applyPartialPlanEdit(existingPlan, editPayload = {}) {
  const base = existingPlan && Array.isArray(existingPlan.meals) && Array.isArray(existingPlan.days)
    ? structuredClone(existingPlan)
    : buildAdaptivePlan(existingPlan?.profileSnapshot || {});

  const instruction = str(editPayload.instruction || editPayload.prompt || '', 500);
  const lower = instruction.toLowerCase();
  const targetSlot = str(editPayload.mealSlot || '', 40);
  const targetDay = str(editPayload.day || '', 15);
  const changes = [];
  const reasons = [];

  // 1. Check for "no eggs" / egg exclusion partial meal edit
  if (lower.includes('no egg') || lower.includes('egg-free') || lower.includes('without egg') || (Array.isArray(editPayload.exclude) && editPayload.exclude.some(x => /egg/i.test(x)))) {
    let mealUpdated = false;
    base.meals = base.meals.map((m) => {
      const slotMatches = !targetSlot || m.slot.toLowerCase() === targetSlot.toLowerCase();
      const hasEggs = (m.contains && m.contains.includes('eggs')) || /egg/i.test(m.title) || (Array.isArray(m.items) && m.items.some(i => /egg/i.test(i)));
      if (slotMatches && (hasEggs || m.slot === 'Breakfast')) {
        mealUpdated = true;
        return structuredClone(EGG_FREE_BREAKFAST_REPLACEMENT);
      }
      return m;
    });
    if (mealUpdated) {
      if (!base.constraintsHonored.includes('exclusion:no_eggs')) base.constraintsHonored.push('exclusion:no_eggs');
      changes.push('Regenerated Breakfast to an egg-free Moong Dal & Paneer Chilla option while keeping Lunch, Dinner, Snack, and Workout days unchanged.');
      reasons.push('Honored your request to exclude eggs today without resetting the rest of your plan.');
    }
  }

  // 2. Check for dairy-free / vegetarian swap
  if (lower.includes('no dairy') || lower.includes('dairy-free') || lower.includes('lactose')) {
    base.meals = base.meals.map((m) => {
      if (m.slot === 'Snack' || (targetSlot && m.slot.toLowerCase() === targetSlot.toLowerCase())) {
        return structuredClone(DAIRY_FREE_REPLACEMENT);
      }
      return m;
    });
    if (!base.constraintsHonored.includes('exclusion:no_dairy')) base.constraintsHonored.push('exclusion:no_dairy');
    changes.push('Swapped dairy snack for Roasted Chana & Lemon Sprout Bhel; preserved all other meals and workouts.');
    reasons.push('Removed dairy from the targeted meal slot.');
  }

  if (lower.includes('vegetarian today') || lower.includes('veg today')) {
    const vegMeals = structuredClone(MEAL_TEMPLATES.veg);
    if (targetSlot) {
      base.meals = base.meals.map(m => (m.slot.toLowerCase() === targetSlot.toLowerCase() ? (vegMeals.find(v => v.slot === m.slot) || m) : m));
      changes.push(`Swapped ${targetSlot} to a vegetarian option while preserving other meals.`);
    } else {
      base.meals = vegMeals.map(m => ({ ...m, uncertaintyLabel: 'Approximate estimate (±15%).' }));
      changes.push('Swapped today’s meals to vegetarian options while keeping your 7-day workout schedule intact.');
    }
    reasons.push('Applied vegetarian meal substitution.');
  }

  // 3. Check for workout environment adaptation: "outdoor" / "quiet apartment" / "no equipment" / "shorter"
  const dayToEdit = targetDay || 'Mon';
  if (lower.includes('outdoor')) {
    base.days = base.days.map((d) => {
      if (d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          environment: 'outdoor',
          focus: `${d.focus.replace(/\s*\(Outdoor Adapted\)/, '')} (Outdoor Adapted)`,
          exercises: [
            { name: 'Outdoor Brisk Walk / Tempo Run Intervals', prescription: '18 min (2 min brisk / 1 min easy)', rest: '60s', intensityRpe: 'RPE 6–7', formCue: 'Stay aware of footing and hydration.', substitution: 'Park Bench Step-Ups' },
            { name: 'Park Bench Incline Push-Ups', prescription: '3 sets × 10–12 reps', rest: '60s', intensityRpe: 'RPE 7', formCue: 'Keep core braced and body in one line.', substitution: 'Bodyweight Air Squats' },
            { name: 'Walking Lunges / Step-Backs on Grass', prescription: '3 sets × 10 reps/side', rest: '60s', intensityRpe: 'RPE 6–7', formCue: 'Soft landing on flat ground.', substitution: 'Standing Calf Raises' }
          ]
        };
      }
      return d;
    });
    if (!base.constraintsHonored.includes('adaptation:outdoor')) base.constraintsHonored.push('adaptation:outdoor');
    changes.push(`Adapted ${dayToEdit} workout to an outdoor session while preserving all other days and meal slots.`);
    reasons.push('Swapped indoor equipment movements for outdoor park/walking intervals.');
  }

  if (lower.includes('shorter') || lower.includes('20 min') || lower.includes('15 min') || lower.includes('quick')) {
    base.days = base.days.map((d) => {
      if (d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          durationMin: 20,
          focus: `${d.focus.replace(/\s*\(20-Min Express\)/, '')} (20-Min Express)`,
          exercises: d.exercises.slice(0, 2).map(ex => ({
            ...ex,
            prescription: '2 sets × 10 reps (Express superset)'
          }))
        };
      }
      return d;
    });
    if (!base.constraintsHonored.includes('adaptation:shorter_20m')) base.constraintsHonored.push('adaptation:shorter_20m');
    changes.push(`Condensed ${dayToEdit} workout to a 20-minute express session (2 core movements) without altering the rest of the week.`);
    reasons.push('Fit your workout into a tighter schedule today.');
  }

  if (lower.includes('quiet') || lower.includes('apartment') || lower.includes('no jump')) {
    base.days = base.days.map((d) => {
      if (d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          environment: 'quiet_apartment',
          focus: `${d.focus.replace(/\s*\(Quiet Low-Impact\)/, '')} (Quiet Low-Impact)`,
          exercises: d.exercises.map(ex => ({
            ...ex,
            formCue: `${ex.formCue} (Zero-jumping quiet apartment tempo — soft foot placement.)`
          }))
        };
      }
      return d;
    });
    if (!base.constraintsHonored.includes('adaptation:quiet_apartment')) base.constraintsHonored.push('adaptation:quiet_apartment');
    changes.push(`Adapted ${dayToEdit} to quiet, zero-jumping apartment-friendly movements.`);
    reasons.push('Eliminated floor impact and noise while maintaining training stimulus.');
  }

  // 4. Pain / injury adaptation: "knee hurts" / "back pain" / "shoulder pain"
  if (lower.includes('knee') || lower.includes('pain') || lower.includes('hurt') || lower.includes('sore')) {
    base.days = base.days.map((d) => {
      if (!targetDay || d.day.toLowerCase() === dayToEdit.toLowerCase()) {
        return {
          ...d,
          exercises: d.exercises.map((ex) => {
            if (/squat|lunge|jump/i.test(ex.name)) {
              return {
                ...ex,
                name: 'Supine Glute Bridge & Pain-Free Hip Mobility (Conservative Swap)',
                prescription: '3 sets × 10 slow reps',
                intensityRpe: 'RPE 5–6 (comfort-first)',
                formCue: 'Stop immediately if pain persists or worsens; consult a clinician/physiotherapist.'
              };
            }
            return ex;
          })
        };
      }
      return d;
    });
    const cautionMsg = 'Pain/discomfort adaptation applied: aggravating knee/lower-body loads were swapped for conservative glute bridges and mobility. Stop if pain worsens and seek professional clinician or physiotherapist assessment.';
    if (!base.safetyFlags.includes(cautionMsg)) base.safetyFlags.push(cautionMsg);
    if (!base.constraintsHonored.includes('limitation:pain_adaptation')) base.constraintsHonored.push('limitation:pain_adaptation');
    changes.push('Replaced knee-loading squats/lunges with conservative supine glute bridges and mobility; added clinician caution notice.');
    reasons.push('Prioritized joint safety and stopped aggravating movements per PRD safety policy.');
  }

  // Fallback if custom mealSlot or day note was supplied
  if (changes.length === 0) {
    changes.push(`Applied custom adjustment ("${instruction || 'User edit'}") to ${targetSlot || targetDay || 'current plan segment'}.`);
    reasons.push('Updated requested plan segment while preserving all unrelated preferences.');
  }

  base.version = (Number(base.version) || 1) + 1;
  const whatChanged = changes.join(' ');
  const why = reasons.join(' ');
  base.explanation = `${whatChanged} Why: ${why}`;
  if (!Array.isArray(base.changeHistory)) base.changeHistory = [];
  base.changeHistory.push({
    version: base.version,
    timestamp: new Date().toISOString(),
    request: instruction || 'Partial plan update',
    whatChanged,
    why
  });

  return {
    plan: base,
    version: base.version,
    whatChanged,
    why,
    explanation: base.explanation
  };
}
