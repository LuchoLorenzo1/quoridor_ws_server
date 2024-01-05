import glicko2 from "glicko2-lite";

const MIN_VOL = 0.035;
const MAX_VOL = 0.045;
const MIN_RD = 50;

export const calculateNewRatings = (
  whiteRating: { rating: number; rd: number; vol: number },
  blackRating: { rating: number; rd: number; vol: number },
  whiteWins: boolean,
) => {
  let res1 = glicko2(whiteRating.rating, whiteRating.rd, whiteRating.vol, [
    [blackRating.rating, blackRating.rd, whiteWins ? 1 : 0],
  ]);
  res1.rd = Math.max(MIN_RD, res1.rd);
  res1.vol = Math.max(MIN_VOL, Math.min(res1.vol, MAX_VOL));
  res1.rating = Math.round(res1.rating);

  let res2 = glicko2(blackRating.rating, blackRating.rd, blackRating.vol, [
    [whiteRating.rating, whiteRating.rd, whiteWins ? 0 : 1],
  ]);
  res2.rd = Math.max(MIN_RD, res2.rd);
  res2.vol = Math.max(MIN_VOL, Math.min(res2.vol, MAX_VOL));
  res2.rating = Math.round(res2.rating);

  return [res1, res2];
};
