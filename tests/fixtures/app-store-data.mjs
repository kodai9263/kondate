// 掲載素材専用の架空データ。本番の家族・メール・契約情報は使用しない。
export const today = '2026-11-02';
const fetchedAt = '2026-11-02T00:41:00.000Z';
export const recipes = [
  ['鶏肉と野菜の照り焼き', '小松菜のおひたし', 30],
  ['鮭のホイル焼き', '豆腐とわかめのみそ汁', 25],
  ['豚肉とキャベツの蒸し煮', 'トマトのサラダ', 20],
  ['わが家のキーマカレー', 'きゅうりのサラダ', 35],
  ['豆腐ハンバーグ', 'にんじんのきんぴら', 35],
  ['卵とほうれん草の炒めもの', 'じゃがいものみそ汁', 20],
].map(([name, side, minutes], index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name, side, minutes, kind: 'custom', customized: false,
}));

export const todaySnapshot = {
  version: 1, fetchedAt,
  today: {
    date: today, dow: '月',
    breakfast: { name: 'おにぎりとみそ汁', tasks: ['おにぎりを用意する。', 'みそ汁と季節の果物を添える。'] },
    dinner: {
      dinner: recipes[0].name, side: recipes[0].side, cookMin: 30, totalMin: 30,
      morning: [], seasonings: ['鶏もも肉 600g', '玉ねぎ 1個', 'ピーマン 3個', 'しょうゆ・みりん 各大さじ2'],
      evening: ['野菜と鶏肉を食べやすい大きさに切る。', '鶏肉を焼き、野菜を加えて炒める。鶏肉の中心まで十分に火を通す。', 'しょうゆとみりんを加えて、全体にからめる。'],
      sideSteps: ['小松菜をゆでて水気をしぼり、食べやすく切って味を調える。'],
    },
  },
};

export function plannerSnapshot(view = 'week') {
  const dates = Array.from({ length: view === 'month' ? 30 : 7 }, (_, index) => `2026-11-${String(index + (view === 'month' ? 1 : 2)).padStart(2, '0')}`);
  return {
    version: 1, date: today, view, today,
    label: view === 'month' ? '2026年11月' : '11月2日〜11月8日',
    previousDate: '2026-10-26', nextDate: '2026-11-09',
    days: dates.map(date => {
      const recipe = recipes[(Number(date.slice(-2)) - 2 + recipes.length) % recipes.length];
      return { date, revision: 'preview-1', recipeId: recipe.id, name: recipe.name,
        side: recipe.side, minutes: recipe.minutes, skipped: ['2026-11-03', '2026-11-14', '2026-11-22'].includes(date),
        locked: date === today, sideMode: 'default', sideDishId: null,
        alternatives: recipes.filter(item => item.id !== recipe.id),
      };
    }),
    sideDishes: [{ id: 'preview-side-1', name: '小松菜のおひたし' }, { id: 'preview-side-2', name: 'トマトのサラダ' }],
  };
}

const shoppingGroup = (category, names) => ({ category, items: names.map((name, position) => ({
  source: 'auto', category, name, label: name, position, checked: false,
})) });
export const shoppingSnapshot = {
  version: 1, fetchedAt, householdId: '20000000-0000-4000-8000-000000000001',
  period: { storageWeekStart: today, start: today, end: '2026-11-08', mode: 'week' },
  groups: [shoppingGroup('野菜', ['玉ねぎ 2個', 'ピーマン 3個', '小松菜 1束', 'キャベツ 1/2個']),
    shoppingGroup('肉・魚', ['鶏もも肉 600g', '鮭 4切れ', '豚薄切り肉 400g'])],
  manualItems: [{ source: 'manual', id: 'preview-milk', category: 'その他', name: '牛乳 1本', position: 0, checked: false }],
  warnings: [], hasDismissedSeasonings: false, latestCompletion: null,
};

export function menuDetail(id) {
  const recipe = recipes.find(item => item.id === id) ?? recipes[0];
  const details = [
    { ingredients: todaySnapshot.today.dinner.seasonings, steps: todaySnapshot.today.dinner.evening },
    { ingredients: ['鮭 4切れ', '玉ねぎ 1個', 'しめじ 1袋', 'バター 20g'], steps: ['玉ねぎを薄切りにし、しめじをほぐす。', '鮭と野菜、バターをホイルで包んで加熱し、魚の中心まで十分に火を通す。'] },
    { ingredients: ['豚薄切り肉 400g', 'キャベツ 1/2個', '水 適量'], steps: ['キャベツと豚肉を食べやすく切る。', '鍋に材料と水を入れて蒸し煮にし、豚肉に十分に火を通す。'] },
    { ingredients: ['合いびき肉 400g', '玉ねぎ 1個', 'にんじん 1/2本', 'カレールウ 4皿分', '水 適量'], steps: ['玉ねぎとにんじんをみじん切りにする。', 'ひき肉と野菜を炒め、肉に十分に火を通す。', '水を加えて煮たら火を止め、ルウを溶かす。使用するルウの分量と加熱時間は商品の表示に合わせる。'] },
    { ingredients: ['木綿豆腐 1丁', '鶏ひき肉 300g', '玉ねぎ 1/2個', 'パン粉 適量'], steps: ['豆腐の水気を切り、玉ねぎをみじん切りにする。', '材料を混ぜて成形し、両面を焼いて中心まで十分に火を通す。'] },
    { ingredients: ['卵 4個', 'ほうれん草 1束', '油 適量'], steps: ['ほうれん草をゆでて水気を切り、食べやすく切る。', '卵とほうれん草を炒め、卵に十分に火を通す。'] },
  ][recipes.indexOf(recipe)];
  return { version: 1, recipe: { ...recipe, servings: 4,
    ...details, morning: [],
    notes: [], sourceUrl: null,
  } };
}

export function editorData(id) {
  const recipe = recipes.find(item => item.id === id) ?? recipes[3];
  return { version: 1, revision: 'preview-1', fields: {
    name: recipe.name, side: recipe.side, cookMinutes: recipe.minutes, servings: 4, proteinSource: 'meat',
    ingredients: menuDetail(recipe.id).recipe.ingredients.join('\n'), morning: '', steps: menuDetail(recipe.id).recipe.steps.join('\n'),
  } };
}
