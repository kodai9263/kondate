import { detectRecipeAllergens } from "@/lib/family/allergies";

export type StandardSideDish = {
  key: string;
  name: string;
  ingredientsText: string;
  steps: string[];
  allergens: string[];
};

// v1の定番副菜はすべて4人分。保存済みレシピの基準人数は変更しない。
export const standardSideServings = 4;
export const standardSideDishes: StandardSideDish[] = [
  {
    key: "spinach-ohitashi", name: "ほうれん草のおひたし", allergens: ["小麦", "大豆"],
    ingredientsText: "ほうれん草 200g\nかつお節 4g\n【A：つけだれ】しょうゆ 大さじ1\n【A：つけだれ】水 大さじ2",
    steps: ["ほうれん草は根元の土を流水で洗う。鍋に湯を沸かし、茎を先に入れて30秒、葉も入れてさらに30秒〜1分ゆでる。", "冷水に取り、水気をしぼって4cm幅に切る。", "ボウルでAを混ぜ、ほうれん草を和える。器に盛り、かつお節をのせる。"],
  },
  {
    key: "bean-sprout-namul", name: "もやしのナムル", allergens: ["ごま"],
    ingredientsText: "もやし 200g\n【A：和えだれ】ごま油 小さじ2\n【A：和えだれ】白すりごま 大さじ1\n【A：和えだれ】塩 小さじ1/4",
    steps: ["もやしを洗って耐熱ボウルに入れる。ふんわりラップをかけ、600Wで3分加熱する。全体を混ぜ、硬い部分があれば30秒ずつ追加で加熱する。", "ざるに上げて粗熱を取り、水気をよく切る。ボウルでAを混ぜ、もやしを和える。"],
  },
  {
    key: "chilled-tofu", name: "冷ややっこ", allergens: ["小麦", "大豆"],
    ingredientsText: "絹ごし豆腐 300g\n小ねぎ 2本\nかつお節 4g\nしょうゆ 小さじ2",
    steps: ["豆腐はパックの水を切り、4等分にして器に盛る。小ねぎは洗って小口切りにする。", "豆腐に小ねぎとかつお節をのせ、食べる直前にしょうゆをかける。"],
  },
  {
    key: "cucumber-salted-kelp", name: "きゅうりの塩こんぶ和え", allergens: ["小麦", "大豆", "ごま"],
    ingredientsText: "きゅうり 2本\n塩こんぶ 10g\nごま油 小さじ1",
    steps: ["きゅうりは洗って両端を落とし、薄い輪切りにする。", "ボウルにきゅうり、塩こんぶ、ごま油を入れて和える。5分ほど置き、出た水気を軽く切って盛り付ける。"],
  },
  {
    key: "carrot-sesame", name: "にんじんのごま和え", allergens: ["小麦", "大豆", "ごま"],
    ingredientsText: "にんじん 200g\n【A：ごまだれ】白すりごま 大さじ2\n【A：ごまだれ】しょうゆ 小さじ2\n【A：ごまだれ】砂糖 小さじ1",
    steps: ["にんじんは洗って皮をむき、細切りにする。耐熱ボウルに入れ、ふんわりラップをかけて600Wで3分加熱する。混ぜて硬ければ30秒ずつ追加で加熱する。", "水気を切り、粗熱を取る。別のボウルでAを混ぜ、にんじんを和える。"],
  },
  {
    key: "broccoli-bonito", name: "ブロッコリーのおかか和え", allergens: ["小麦", "大豆"],
    ingredientsText: "ブロッコリー 200g\nかつお節 4g\nしょうゆ 小さじ2",
    steps: ["ブロッコリーを洗い、小房に分ける。茎は硬い皮をむいて薄切りにする。", "鍋に湯を沸かし、ブロッコリーを2〜3分ゆでる。茎に竹串がすっと通ったらざるに上げ、粗熱を取る。", "水気をよく切り、しょうゆとかつお節で和える。"],
  },
  {
    key: "cabbage-tuna", name: "キャベツとツナのサラダ", allergens: ["卵", "大豆"],
    ingredientsText: "キャベツ 200g\nツナ缶 1缶\nマヨネーズ 大さじ2\nこしょう 少々",
    steps: ["キャベツは洗って細切りにする。耐熱ボウルに入れ、ふんわりラップをかけて600Wで2分加熱する。", "粗熱を取って水気をしぼる。ツナ缶の汁気を切り、キャベツ、ツナ、マヨネーズ、こしょうを和える。"],
  },
  {
    key: "tomato-salad", name: "トマトのさっぱりサラダ", allergens: [],
    ingredientsText: "トマト 2個\n【A：ドレッシング】オリーブ油 小さじ2\n【A：ドレッシング】酢 小さじ2\n【A：ドレッシング】砂糖 小さじ1\n【A：ドレッシング】塩 小さじ1/4",
    steps: ["トマトは洗ってへたを取り、一口大に切る。", "ボウルでAをよく混ぜ、トマトを加えてやさしく和える。"],
  },
  {
    key: "komatsuna-mushroom", name: "小松菜としめじのレンジ蒸し", allergens: ["小麦", "大豆"],
    ingredientsText: "小松菜 200g\nしめじ 100g\nしょうゆ 小さじ2\nかつお節 4g",
    steps: ["小松菜は根元をよく洗い、根を落として4cm幅に切る。しめじは石づきを切り落としてほぐす。", "耐熱ボウルに小松菜の茎、しめじ、葉の順に入れ、ふんわりラップをかけて600Wで4分加熱する。混ぜて、しめじと茎がしんなりするまで30秒ずつ追加で加熱する。", "水気を切り、しょうゆとかつお節で和える。"],
  },
  {
    key: "wakame-cucumber", name: "きゅうりとわかめの酢の物", allergens: [],
    ingredientsText: "きゅうり 2本\n乾燥わかめ 4g\n塩 小さじ1/4\n【A：合わせ酢】酢 大さじ2\n【A：合わせ酢】砂糖 小さじ2",
    steps: ["乾燥わかめを袋の表示どおりに水で戻し、水気を切る。長ければ食べやすく切る。", "きゅうりは洗って両端を落とし、薄切りにする。塩をまぶして5分置き、水気をしぼる。", "ボウルでAを混ぜ、きゅうりとわかめを和える。"],
  },
];

export function availableStandardSideDishes(allergies: string[]) {
  return standardSideDishes.filter((dish) => detectRecipeAllergens({
    name: dish.name, ingredientsText: `${dish.ingredientsText}\n${dish.allergens.join(" ")}`,
  }, allergies).length === 0);
}
