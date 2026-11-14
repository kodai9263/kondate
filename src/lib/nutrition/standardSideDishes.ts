import { detectRecipeAllergens } from "@/lib/family/allergies";

export type StandardSideDish = {
  key: string;
  name: string;
  ingredientsText: string;
  steps: string[];
  allergens: string[];
};

// 定番副菜はすべて4人分。保存済みレシピの基準人数は変更しない。
export const standardSideServings = 4;
export const standardSideDishes: StandardSideDish[] = [
  {
    "key": "reviewed-tomato-corn",
    "name": "トマトとコーンの小鉢",
    "ingredientsText": "トマト 300g\nコーン（水煮） 100g\nオリーブ油 小さじ2\n酢 小さじ2\n塩 ひとつまみ",
    "steps": [
      "トマトを洗ってへたを取り、2cmほどの角切りにする。コーンはざるに移して汁を切る。",
      "ボウルに油、酢、塩を入れて混ぜる。トマトとコーンを加えて軽く混ぜ、4つの器に分ける。"
    ],
    "allergens": []
  },
  {
    "key": "reviewed-potato-butter",
    "name": "じゃがいものバター和え",
    "ingredientsText": "じゃがいも 400g\nバター 15g\n塩 ひとつまみ\nこしょう 少々",
    "steps": [
      "じゃがいもは皮をむき、芽と緑色の部分を十分に取り除く。2cm角に切り、鍋に入れてかぶる量の水を注ぐ。",
      "中火で沸かしたら弱めの中火にし、竹串が中心まで抵抗なく通るまで10〜15分ほどゆでる。",
      "湯を捨てて火を止め、熱いうちにバター、塩、こしょうをからめる。"
    ],
    "allergens": []
  },
  {
    "key": "reviewed-cabbage-egg",
    "name": "キャベツと卵の炒めもの",
    "ingredientsText": "キャベツ 250g\n卵 3個\n油 小さじ2\nしょうゆ 小さじ2",
    "steps": [
      "キャベツは洗って水気を切り、2cm角に切る。卵はボウルに割り入れて溶く。",
      "フライパンに油を入れて中火で温め、キャベツを3〜4分炒める。硬い場合は少量の水を加え、ふたをしてやわらかくする。",
      "溶き卵を回し入れ、へらで大きく混ぜる。卵が全体に固まるまで加熱し、しょうゆを加えて混ぜる。"
    ],
    "allergens": []
  },
  {
    "key": "reviewed-carrot-lemon",
    "name": "にんじんのレモン和え",
    "ingredientsText": "にんじん 300g\nレモン汁 大さじ1\nオリーブ油 小さじ2\n砂糖 小さじ1\n塩 ひとつまみ",
    "steps": [
      "にんじんは洗って皮をむき、長さ4cmの細切りにする。",
      "沸騰した湯に入れ、好みのやわらかさになるまで2〜4分ゆでる。ざるに上げて水気を十分に切る。",
      "ボウルでレモン汁、油、砂糖、塩を混ぜる。にんじんを加えて和え、粗熱を取って盛る。"
    ],
    "allergens": []
  },
  {
    "key": "reviewed-mushroom-soy",
    "name": "しめじとえのきのしょうゆ蒸し",
    "ingredientsText": "しめじ 200g\nえのき 200g\n水 大さじ3\nしょうゆ 小さじ2\nごま油 小さじ1",
    "steps": [
      "しめじとえのきは根元の硬い部分を切り落とし、ほぐす。えのきは長さを半分に切る。",
      "鍋にきのこと水を入れ、ふたをして中火にかける。蒸気が出たら弱火にし、時々混ぜながら全体がしんなりするまで5〜7分加熱する。",
      "しょうゆとごま油を加えて混ぜる。水分が多ければふたを外し、焦がさないよう混ぜながら少し煮詰める。"
    ],
    "allergens": []
  },
  {
    "key": "reviewed-beans-cucumber",
    "name": "大豆ときゅうりのサラダ",
    "ingredientsText": "大豆（水煮） 200g\nきゅうり 2本\n酢 大さじ1\nオリーブ油 大さじ1\n塩 ひとつまみ",
    "steps": [
      "大豆は商品の表示に従って水気を切る。きゅうりは洗って両端を落とし、1cm角に切る。",
      "ボウルに酢、油、塩を入れてよく混ぜ、大豆ときゅうりを加えて和える。食べるまで冷蔵庫に入れ、当日中に食べる。"
    ],
    "allergens": []
  }
];

// 保存済みの家庭内副菜は元の4人分として扱う。旧本文を候補一覧へ戻さない。
export const standardSideStorageKeys = ["spinach-ohitashi", "bean-sprout-namul", "chilled-tofu", "cucumber-salted-kelp", "carrot-sesame", "broccoli-bonito", "cabbage-tuna", "tomato-salad", "komatsuna-mushroom", "wakame-cucumber", "microwave-potato-salad", "coleslaw", "burdock-kinpira", "pepper-jako", "mushroom-butter-soy", "pumpkin-simmered", "eggplant-soaked", "napa-aburaage-simmered", "hijiki-soybeans", "sweet-potato-simmered"] .concat(standardSideDishes.map((dish) => dish.key));

export function availableStandardSideDishes(allergies: string[]) {
  return standardSideDishes.filter((dish) => detectRecipeAllergens({
    name: dish.name, ingredientsText: `${dish.ingredientsText}\n${dish.allergens.join(" ")}`,
  }, allergies).length === 0);
}
