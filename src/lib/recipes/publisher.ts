type PublisherUser = {
  id: string;
};

export function isRecipePublisher(user: PublisherUser | null | undefined) {
  if (!user) return false;

  const allowedUserIds = (process.env.RECIPE_PUBLISHER_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedUserIds.includes(user.id);
}
