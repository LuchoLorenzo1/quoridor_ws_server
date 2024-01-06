import sql from "../postgresClient";

interface UserData {
  id: string;
  name: string;
  image?: string;
  rating: number;
  rating_deviation: number;
  volatility: number;
}

export const getUserById = async (userId: string) => {
  const res = await sql<
    UserData[]
  >`SELECT id, name, image, rating, rating_deviation, volatility FROM users WHERE id = ${userId}`;
  if (res.length === 0) return null;
  return res[0];
};

export const updateRatingByUserId = async (
  userId: string,
  newRating: { rd: number; rating: number; vol: number },
) => {
  await sql`UPDATE users SET rating = ${newRating.rating}, rating_deviation = ${newRating.rd}, volatility = ${newRating.vol} WHERE id = ${userId}`;
};
