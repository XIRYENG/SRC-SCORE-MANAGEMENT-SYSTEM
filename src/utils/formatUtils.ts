
export const formatScore = (rating: number): string => {
  return (Math.round(rating * 100) / 100).toFixed(2);
};
