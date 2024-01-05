import sql from "../postgresClient";

interface Rating {
  rating: number;
  rating_deviation: number;
  volatility: number;
}

export const getRatingByUserId = async (userId: string) => {
  const res = await sql<
    Rating[]
  >`SELECT rating, rating_deviation, volatility FROM users WHERE id = ${userId}`;
  if (res.length === 0) return null;
  return res[0];
};

export const updateRatingByUserId = async (
  userId: string,
  newRating: { rd: number; rating: number; vol: number },
) => {
  await sql`UPDATE users SET rating = ${newRating.rating}, rating_deviation = ${newRating.rd}, volatility = ${newRating.vol} WHERE id = ${userId}`;
};
